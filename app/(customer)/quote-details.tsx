import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    Platform,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Quote, Invoice } from '@/types';
import { format } from 'date-fns';
import { useColors } from '@/constants/design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function CustomerQuoteDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const router = useRouter();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const [quote, setQuote] = useState<Quote | null>(null);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paying, setPaying] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const navigatingAway = useRef(false);

    useFocusEffect(
        useCallback(() => {
            if (!navigatingAway.current) {
                loadQuote();
            }
        }, [id])
    );

    const loadQuote = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const quoteData = await firebaseService.getQuote(id);
            setQuote(quoteData);

            // If quote is converted, load the invoice (but not if we're navigating away)
            if (quoteData?.convertedToInvoiceId && !navigatingAway.current) {
                const invoiceData = await firebaseService.getInvoice(quoteData.convertedToInvoiceId);
                if (!navigatingAway.current) setInvoice(invoiceData);
            }
        } catch (error) {
            console.error('Error loading quote:', error);
            Alert.alert('Error', 'Failed to load quote');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!quote || !user) return;

        Alert.alert(
            'Approve Quote',
            `You are approving a total of ₦${quote.total.toLocaleString()}. This will create an invoice. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        setApproving(true);
                        try {
                            const invoiceId = await firebaseService.approveQuote(
                                quote.id,
                                user.id,
                                user.name,
                                (quote.total) // Pass the expected total
                            );
                            // Prevent any re-render from loading/showing the invoice view
                            navigatingAway.current = true;
                            setApproving(false);
                            router.replace('/(customer)/invoices');
                            Alert.alert('Success', 'Quote approved! Invoice has been created.');
                            return; // Exit early, skip finally block
                        } catch (error: any) {
                            if (error.message.includes('Price Mismatch')) {
                                Alert.alert(
                                    'Quote Updated',
                                    error.message,
                                    [{ text: 'Review Changes', onPress: () => loadQuote() }]
                                );
                            } else {
                                Alert.alert('Error', error.message || 'Failed to approve quote');
                            }
                        } finally {
                            setApproving(false);
                        }
                    }
                }
            ]
        );
    };

    const handleReject = async () => {
        if (!quote) return;
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!quote) return;
        setRejecting(true);
        try {
            console.log('[confirmReject] Rejecting quote:', quote.id, 'reason:', rejectionReason);
            await firebaseService.rejectQuote(
                quote.id,
                user?.id || '',
                user?.name || 'Customer',
                rejectionReason || undefined
            );
            console.log('[confirmReject] Quote rejected successfully');
            setShowRejectModal(false);
            setRejectionReason('');
            Alert.alert(
                'Quote Rejected',
                'The workshop will be notified and can revise the quote.',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        } catch (error: any) {
            console.error('[confirmReject] Error rejecting quote:', error);
            Alert.alert('Error', error.message || 'Failed to reject quote');
        } finally {
            setRejecting(false);
        }
    };

    const handleMakePayment = async () => {
        if (!invoice || !user) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        const balance = invoice.total - (invoice.amountPaid || 0);
        if (amount > balance) {
            Alert.alert('Error', `Amount exceeds outstanding balance of ₦${balance.toLocaleString()}`);
            return;
        }

        setPaying(true);
        try {
            await firebaseService.recordPayment(invoice.id, {
                amount,
                method: 'bank_transfer',
                recordedBy: user.id,
                recordedByName: user.name,
            }, true); // isCustomerPayment - staff must independently confirm
            Alert.alert('Payment Submitted', 'Your payment is pending confirmation by the workshop. You will be notified once it is confirmed.');
            setShowPaymentModal(false);
            setPaymentAmount('');
            loadQuote(); // Reload to get updated invoice
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to record payment');
        } finally {
            setPaying(false);
        }
    };

    const handleDownloadQuote = async () => {
        if (!quote) return;
        try {
            // Use invoice data if converted, otherwise use quote data
            const sourceData = isConverted && invoice ? invoice : quote;
            const items = quote.items;
            const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
            const vatAmount = subtotal * (quote.vatRate || 0) / 100;
            const discount = quote.discount || 0;
            const total = subtotal + vatAmount - discount;
            const docType = isConverted ? 'INVOICE' : 'QUOTATION';
            const docId = isConverted && invoice ? invoice.id : quote.id;

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                        .header h1 { margin: 0; font-size: 28px; color: #000; }
                        .header p { margin: 5px 0; color: #666; }
                        .info-grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
                        .info-block p { margin: 4px 0; }
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .items-table th { background-color: #f0f0f0; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; }
                        .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
                        .total-section { text-align: right; margin-top: 20px; }
                        .total-section p { margin: 5px 0; }
                        .total-section .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
                        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${docType}</h1>
                        <p>${docType} #${docId.slice(-8).toUpperCase()}</p>
                    </div>
                    <div class="info-grid">
                        <div class="info-block">
                            <p><strong>Customer:</strong> ${quote.customerName || 'N/A'}</p>
                            ${quote.customerEmail ? `<p><strong>Email:</strong> ${quote.customerEmail}</p>` : ''}
                            ${quote.customerPhone ? `<p><strong>Phone:</strong> ${quote.customerPhone}</p>` : ''}
                        </div>
                        <div class="info-block">
                            <p><strong>Date:</strong> ${format(quote.createdAt, 'MMM dd, yyyy')}</p>
                        </div>
                    </div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item: any) => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.quantity}</td>
                                    <td>₦${Number(item.unitPrice).toLocaleString()}</td>
                                    <td>₦${(item.quantity * item.unitPrice).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="total-section">
                        <p>Subtotal: ₦${subtotal.toLocaleString()}</p>
                        ${quote.vatRate > 0 ? `<p>VAT (${quote.vatRate}%): ₦${vatAmount.toLocaleString()}</p>` : ''}
                        ${discount > 0 ? `<p>Discount: -₦${discount.toLocaleString()}</p>` : ''}
                        <p class="grand-total">Total: ₦${total.toLocaleString()}</p>
                    </div>
                    ${isConverted && invoice ? `
                        <div class="total-section">
                            <p>Amount Paid: ₦${(invoice.amountPaid || 0).toLocaleString()}</p>
                            <p class="grand-total" style="color: ${balance > 0 ? '#FF3B30' : '#30D158'}">Balance: ₦${balance.toLocaleString()}</p>
                        </div>
                    ` : ''}
                    <div class="footer">
                        <p>This is a computer-generated document.</p>
                    </div>
                </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to generate PDF');
            console.error('Error generating PDF:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!quote) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>Quote not found</Text>
            </View>
        );
    }

    const balance = invoice ? invoice.total - (invoice.amountPaid || 0) : quote.total;
    const isPending = quote.status === 'pending_approval';
    const isRejected = quote.status === 'rejected';
    const isConverted = quote.status === 'converted' && invoice;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isPending ? 'Quote Approval' : isRejected ? 'Rejected Quote' : 'Invoice'}
                </Text>
                <TouchableOpacity onPress={handleDownloadQuote}>
                    <Ionicons name="download-outline" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Status Banner */}
                {isPending && (
                    <View style={styles.approvalBanner}>
                        <Ionicons name="alert-circle" size={24} color={colors.warning} />
                        <View style={styles.bannerText}>
                            <Text style={styles.bannerTitle}>Approval Required</Text>
                            <Text style={styles.bannerSubtitle}>Please review and approve this quote</Text>
                        </View>
                    </View>
                )}

                {isRejected && (
                    <View style={[styles.approvalBanner, { backgroundColor: colors.error + '20' }]}>
                        <Ionicons name="close-circle" size={24} color={colors.error} />
                        <View style={styles.bannerText}>
                            <Text style={[styles.bannerTitle, { color: colors.error }]}>Quote Rejected</Text>
                            <Text style={styles.bannerSubtitle}>
                                See History & Activity at bottom for details
                            </Text>
                        </View>
                    </View>
                )}

                {isConverted && invoice && (
                    <View style={styles.invoiceBanner}>
                        <View style={styles.bannerRow}>
                            <View>
                                <Text style={styles.invoiceLabel}>Invoice Balance</Text>
                                <Text style={styles.invoiceBalance}>₦{balance.toLocaleString()}</Text>
                            </View>
                            <View style={[
                                styles.paymentStatusBadge,
                                { backgroundColor: invoice.paymentStatus === 'paid' ? colors.success + '20' : colors.warning + '20' }
                            ]}>
                                <Text style={[
                                    styles.paymentStatusText,
                                    { color: invoice.paymentStatus === 'paid' ? colors.success : colors.warning }
                                ]}>
                                    {invoice.paymentStatus === 'paid' ? 'Paid' :
                                        invoice.paymentStatus === 'partially_paid' ? 'Partial' : 'Unpaid'}
                                </Text>
                            </View>
                        </View>
                        {(invoice.amountPaid || 0) > 0 && (
                            <Text style={styles.paidAmount}>
                                ₦{(invoice.amountPaid || 0).toLocaleString()} paid of ₦{invoice.total.toLocaleString()}
                            </Text>
                        )}
                        {invoice.pendingPayments && invoice.pendingPayments.length > 0 && (
                            <View style={{ marginTop: 10, padding: 10, backgroundColor: colors.warning + '15', borderRadius: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.warning, marginBottom: 4 }}>
                                    ⏳ Pending Confirmation
                                </Text>
                                {invoice.pendingPayments.map((pp: any, i: number) => (
                                    <Text key={i} style={{ fontSize: 12, color: colors.textSecondary }}>
                                        ₦{pp.amount.toLocaleString()} — awaiting workshop confirmation
                                    </Text>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Line Items */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Items</Text>
                    {quote.items.map((item, index) => (
                        <View key={item.id || index} style={styles.lineItem}>
                            <View style={styles.lineItemInfo}>
                                <Text style={styles.lineItemDesc}>{item.description}</Text>
                                <Text style={styles.lineItemQty}>
                                    {item.quantity} × ₦{item.unitPrice.toLocaleString()}
                                </Text>
                            </View>
                            <Text style={styles.lineItemTotal}>₦{item.total.toLocaleString()}</Text>
                        </View>
                    ))}
                </View>

                {/* Invoice Pending Items */}
                {invoice?.pendingItems && invoice.pendingItems.length > 0 && (
                    <View style={[styles.card, styles.pendingCard]}>
                        <View style={styles.pendingHeader}>
                            <Ionicons name="alert-circle" size={18} color={colors.warning} />
                            <Text style={styles.pendingTitle}>Additional Items (Pending Approval)</Text>
                        </View>
                        {invoice.pendingItems.map((item, index) => (
                            <View key={index} style={styles.lineItem}>
                                <View style={styles.lineItemInfo}>
                                    <Text style={styles.lineItemDesc}>{item.description}</Text>
                                    <Text style={styles.lineItemQty}>
                                        {item.quantity} × ₦{item.unitPrice.toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={styles.lineItemTotal}>₦{item.total.toLocaleString()}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Summary */}
                <View style={styles.card}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>₦{quote.subtotal.toLocaleString()}</Text>
                    </View>
                    {(quote.vatRate || 0) > 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>VAT ({quote.vatRate}%)</Text>
                            <Text style={styles.summaryValue}>₦{(quote.vat || 0).toLocaleString()}</Text>
                        </View>
                    )}
                    {(quote.discount || 0) > 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Discount</Text>
                            <Text style={[styles.summaryValue, { color: colors.error }]}>-₦{(quote.discount || 0).toLocaleString()}</Text>
                        </View>
                    )}
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₦{quote.total.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
                {isPending && (
                    <>
                        <TouchableOpacity
                            style={[styles.button, styles.rejectButton]}
                            onPress={handleReject}
                        >
                            <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.approveButton]}
                            onPress={handleApprove}
                            disabled={approving}
                        >
                            {approving ? (
                                <ActivityIndicator color={colors.textInverse} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.textInverse} />
                                    <Text style={styles.approveButtonText}>Approve</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                {isConverted && balance > 0 && (
                    <TouchableOpacity
                        style={[styles.button, styles.payButton]}
                        onPress={() => {
                            setPaymentAmount(balance.toString());
                            setShowPaymentModal(true);
                        }}
                    >
                        <Ionicons name="card-outline" size={20} color={colors.textInverse} />
                        <Text style={styles.approveButtonText}>Make Payment</Text>
                    </TouchableOpacity>
                )}

                {isConverted && balance === 0 && (
                    <View style={styles.paidBanner}>
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                        <Text style={styles.paidText}>Fully Paid</Text>
                    </View>
                )}
            </View>

            {/* Payment Modal */}
            <Modal visible={showPaymentModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Make Payment</Text>
                        <Text style={styles.modalSubtitle}>
                            Outstanding: ₦{balance.toLocaleString()}
                        </Text>
                        <TextInput
                            style={styles.paymentInput}
                            value={paymentAmount}
                            onChangeText={setPaymentAmount}
                            placeholder="Amount (₦)"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowPaymentModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={handleMakePayment}
                                disabled={paying}
                            >
                                {paying ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Rejection Modal */}
            <Modal visible={showRejectModal} transparent animationType="fade">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.rejectModalContent}>
                                <Text style={styles.modalTitle}>Reject Quote</Text>
                                <Text style={styles.modalSubtitle}>
                                    Provide a reason (optional) to help the workshop revise the quote.
                                </Text>
                                <TextInput
                                    style={styles.reasonInput}
                                    placeholder="e.g., Price too high, need fewer items..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={rejectionReason}
                                    onChangeText={setRejectionReason}
                                    multiline
                                    numberOfLines={3}
                                />
                                <View style={styles.modalButtons}>
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.cancelButton]}
                                        onPress={() => setShowRejectModal(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.rejectButton]}
                                        onPress={confirmReject}
                                        disabled={rejecting}
                                    >
                                        {rejecting ? (
                                            <ActivityIndicator color={colors.textPrimary} size="small" />
                                        ) : (
                                            <Text style={styles.rejectButtonText}>Reject Quote</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}


const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    errorText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    approvalBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '20', // Light warning bg
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        gap: 12,
    },
    bannerText: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    bannerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    invoiceBanner: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    bannerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    invoiceLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    invoiceBalance: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    paymentStatusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    paymentStatusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    paidAmount: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 8,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    pendingCard: {
        borderWidth: 2,
        borderColor: colors.warning + '30',
    },
    pendingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    pendingTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.warning,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    lineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    lineItemInfo: {
        flex: 1,
    },
    lineItemDesc: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    lineItemQty: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    lineItemTotal: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 8,
        paddingTop: 16,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.primary,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: (Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 20)) + 76, // 60 (tab bar) + 16 (padding)
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 12,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    rejectButton: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.textPrimary,
    },
    rejectButtonText: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    approveButton: {
        backgroundColor: colors.textPrimary,
    },
    approveButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
    payButton: {
        backgroundColor: colors.textPrimary,
    },
    paidBanner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        backgroundColor: colors.success + '20',
        borderRadius: 12,
        gap: 8,
    },
    paidText: {
        color: colors.success,
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        padding: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 20,
        textAlign: 'center',
    },
    paymentInput: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: colors.primary,
    },
    confirmButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
    // Rejection Modal Styles
    rejectModalContent: {
        backgroundColor: colors.surface,
        padding: 24,
        margin: 20,
        borderRadius: 24,
    },
    reasonInput: {
        backgroundColor: colors.background,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    confirmRejectButton: {
        backgroundColor: colors.error,
    },
    confirmRejectButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});
