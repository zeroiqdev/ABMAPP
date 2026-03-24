import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { useAuthStore } from '@/store/authStore';
import { Invoice, Job, User } from '@/types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { amountToWords } from '@/utils/formatUtils';

import { useColors } from '@/constants/design';

export default function InvoiceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadInvoiceDetails();
    }, [id])
  );

  const loadInvoiceDetails = async () => {
    try {
      if (!id) return;
      const invoiceData = await firebaseService.getInvoice(id);

      if (invoiceData) {
        setInvoice(invoiceData);


        // Fetch Job
        if (invoiceData.jobId) {
          try {
            const jobData = await firebaseService.getJob(invoiceData.jobId);
            if (jobData) {
              setJob(jobData);
              if (jobData.vehicleId) {
                try {
                  const v = await firebaseService.getVehicle(jobData.vehicleId);
                  if (v) setVehicle(v);
                } catch (e) {
                  console.log('Could not load vehicle:', e);
                }
              }
            }
          } catch (jobError) {
            console.log('Error fetching job details (non-fatal):', jobError);
            // Non-fatal error, continue loading other details
          }
        }

        // Fetch Customer (User)
        if (invoiceData.userId) {
          try {
            const userData = await firebaseService.getUser(invoiceData.userId);
            if (userData) {
              setCustomer(userData);
            }
          } catch (userError) {
            console.log('Error fetching customer details (non-fatal):', userError);
          }
        }
      }
    } catch (error) {
      console.error('Error loading invoice main details:', error);
      Alert.alert('Error', 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;

    try {
      const html = generateInvoiceHTML(invoice, job, customer);
      const { uri } = await Print.printToFileAsync({ html });
      
      // Custom Filename
      const displayNumber = (invoice as any).invoiceNumber || `INV-${invoice.id.slice(-8).toUpperCase()}`;
      const pdfName = `${displayNumber}.pdf`;
      const newUri = FileSystem.cacheDirectory + pdfName;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      await Sharing.shareAsync(newUri);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate invoice PDF');
      console.error('Error generating PDF:', error);
    }
  };

  const generateInvoiceHTML = (inv: Invoice, job: Job | null, customer: User | null) => {
    const amountPaid = inv.amountPaid || 0;
    const balanceDue = Math.max(0, inv.total - amountPaid);
    const displayNumber = (inv as any).invoiceNumber || `INV-${inv.id.slice(-8).toUpperCase()}`;
    const logoUrl = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1772036824/ABM_BLACK_g6i4dm.png';
    const amountInWords = amountToWords(inv.total);

    const vehicleHtml = vehicle ? `
      <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
        <p style="margin: 0; font-size: 13px; color: #666;">VEHICLE DETAILS</p>
        <p style="margin: 5px 0 0 0; font-size: 15px; font-weight: 600;">
          ${vehicle.year} ${vehicle.make} ${vehicle.model} • ${vehicle.licensePlate || 'N/A'}
        </p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header-split { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
            .header-left h1 { margin: 0; font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .header-left p { margin: 5px 0 0 0; color: #666; font-size: 14px; font-family: monospace; }
            .logo { height: 60px; object-fit: contain; }
            
            .divider { height: 1px; background: #eee; margin: 20px 0; }
            
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .info-block { flex: 1; }
            .info-label { font-size: 12px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 8px; }
            .info-value { font-size: 16px; font-weight: 600; margin: 0; }
            .info-date { font-size: 14px; margin: 4px 0; display: flex; justify-content: flex-end; }
            .info-date span { color: #000; width: 100px; text-align: right; margin-right: 15px; }
            
            .section-title { font-size: 12px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 0.5px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 8px; overflow: hidden; }
            th { background: #f8f9fa; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 700; color: #000; border-bottom: 2px solid #eee; }
            td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 14px; }
            .text-right { text-align: right; }
            
            .totals-container { display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals-table { width: 300px; margin-bottom: 0; }
            .totals-table td { border-bottom: none; padding: 5px 0; }
            .totals-table .grand-total { border-top: 2px solid #333; padding-top: 15px; margin-top: 10px; font-size: 24px; font-weight: 800; }
            .totals-table .paid { color: #30D158; font-weight: 600; }
            .totals-table .balance { color: #FF9500; font-weight: 700; font-size: 18px; }
            
            .words-section { margin-top: 40px; }
            .words-label { font-size: 11px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 5px; }
            .words-value { font-size: 15px; font-weight: 600; }
            
            .footer-card { margin-top: 60px; background: #f8f9fa; padding: 25px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
            .bank-details { display: flex; gap: 40px; }
            .bank-detail-item { font-size: 14px; }
            .bank-detail-label { color: #000; margin-bottom: 4px; }
            .bank-detail-value { font-weight: 700; font-size: 16px; }
            .thanks { margin-top: 15px; color: #000; font-style: italic; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header-split">
            <div class="header-left">
              <h1>INVOICE</h1>
              <p>#${displayNumber}</p>
            </div>
            <img src="${logoUrl}" class="logo" alt="ABM Logo" />
          </div>
          
          <div class="divider"></div>
          
          <div class="info-grid">
            <div class="info-block">
              <p class="info-label">BILL TO</p>
              <p class="info-value">${customer?.name || inv.customerName || 'Direct Customer'}</p>
              ${customer?.phone ? `<p style="margin:4px 0; color:#666;">${customer.phone}</p>` : ''}
              ${vehicleHtml}
            </div>
            <div class="info-block" style="max-width: 300px;">
              <p class="info-label" style="text-align: right;">INVOICE DETAILS</p>
              <div class="info-date"><span>Issued:</span><strong>${format(inv.createdAt, 'MMM dd, yyyy')}</strong></div>
              <div class="info-date"><span>Due Date:</span><strong style="color: ${inv.dueDate ? '#333' : '#999'}">${inv.dueDate ? format(inv.dueDate, 'MMM dd, yyyy') : 'N/A'}</strong></div>
            </div>
          </div>
          
          <p class="section-title">LINE ITEMS</p>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right" style="width: 60px;">Qty</th>
                <th class="text-right" style="width: 120px;">Unit Price</th>
                <th class="text-right" style="width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${inv.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">₦${item.unitPrice.toLocaleString()}</td>
                  <td class="text-right">₦${item.total.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals-container">
            <table class="totals-table">
              <tr>
                <td style="color:#666;">Subtotal</td>
                <td class="text-right">₦${inv.subtotal.toLocaleString()}</td>
              </tr>
              ${inv.vat > 0 ? `
                <tr>
                  <td style="color:#666;">VAT (${inv.vatRate || 0}%)</td>
                  <td class="text-right">₦${inv.vat.toLocaleString()}</td>
                </tr>
              ` : ''}
              ${inv.discount > 0 ? `
                <tr>
                  <td style="color:#666;">Discount</td>
                  <td class="text-right">-₦${inv.discount.toLocaleString()}</td>
                </tr>
              ` : ''}
              <tr class="grand-total">
                <td>Total</td>
                <td class="text-right">₦${inv.total.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="paid">Amount Paid</td>
                <td class="text-right paid">₦${amountPaid.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="balance">Balance Due</td>
                <td class="text-right balance">₦${balanceDue.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div class="words-section">
            <p class="words-label">AMOUNT IN WORDS</p>
            <p class="words-value">${amountInWords}</p>
          </div>
          
          <div class="footer-card">
            <div style="flex:1;">
              <div class="bank-details">
                <div class="bank-detail-item">
                  <div class="bank-detail-label">Bank</div>
                  <div class="bank-detail-value">MONIEPOINT MFB</div>
                </div>
                <div class="bank-detail-item">
                  <div class="bank-detail-label">Acc No</div>
                  <div class="bank-detail-value">5071154448</div>
                </div>
                <div class="bank-detail-item">
                  <div class="bank-detail-label">Name</div>
                  <div class="bank-detail-value">ABDULLATEEF BABA MUSTAPHA</div>
                </div>
              </div>
              <p class="thanks">Thank you for your business!</p>
            </div>
            <img src="${logoUrl}" style="height: 30px; opacity: 0.2; transform: grayscale(1);" />
          </div>
        </body>
      </html>
    `;
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'partially_paid': return colors.primary; // Or specific purple if available, but primary is safe
      case 'failed': return colors.error;
      default: return colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invoice Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Invoice not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice Details</Text>
        <TouchableOpacity onPress={handleDownload} style={styles.downloadButton}>
          <Text style={styles.downloadButtonText}>Download</Text>
          <Ionicons name="download-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: (Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 20)) + 80 }}
      >

        {/* Invoice Info Card */}
        <View style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.invoiceNumber}>{(invoice as any).invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}</Text>
              <Text style={styles.invoiceDate}>{format(invoice.createdAt, 'MMM dd, yyyy')}</Text>
              {invoice.dueDate && (
                <Text style={[styles.invoiceDate, { color: colors.error, marginTop: 4 }]}>
                  Due: {format(invoice.dueDate, 'MMM dd, yyyy')}
                </Text>
              )}
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: getPaymentStatusColor(invoice.paymentStatus) + '15',
              borderWidth: 1,
              borderColor: getPaymentStatusColor(invoice.paymentStatus) + '30'
            }]}>
              <Text style={[styles.statusText, { color: getPaymentStatusColor(invoice.paymentStatus) }]}>
                {invoice.paymentStatus === 'pending' ? 'UNPAID' : invoice.paymentStatus.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.invoiceAmount}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>₦{invoice.total.toLocaleString()}</Text>
          </View>

          {(invoice.amountPaid || 0) > 0 && (
            <View style={styles.paymentInfo}>
              <Text style={styles.paidText}>Paid: ₦{(invoice.amountPaid || 0).toLocaleString()}</Text>
              <Text style={styles.remainingText}>Remaining: ₦{Math.max(0, invoice.total - (invoice.amountPaid || 0)).toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.itemsSection}>
            {invoice.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfoContainer}>
                  <View style={styles.itemInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      {item.isNewAddition && (
                        <View style={{ backgroundColor: '#4CAF50', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemDetails}>
                      {item.quantity} × ₦{item.unitPrice.toLocaleString()} = ₦{item.total.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>
              ₦{invoice.subtotal.toLocaleString()}
            </Text>
          </View>
          {invoice.vat > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VAT {invoice.vatRate ? `(${invoice.vatRate}%)` : ''}:</Text>
              <Text style={styles.summaryValue}>₦{invoice.vat.toLocaleString()}</Text>
            </View>
          )}
          {invoice.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount:</Text>
              <Text style={styles.summaryValue}>-₦{invoice.discount.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total:</Text>
            <Text style={styles.summaryValue}>
              ₦{invoice.total.toLocaleString()}
            </Text>
          </View>
          {(invoice.amountPaid || 0) > 0 && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount Paid:</Text>
                <Text style={styles.summaryValue}>
                  ₦{(invoice.amountPaid || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {(invoice.total - (invoice.amountPaid || 0)) <= 0 ? 'Status:' : 'Balance Due:'}
                </Text>
                {(invoice.total - (invoice.amountPaid || 0)) <= 0 ? (
                  <Text style={[styles.summaryValue, { color: colors.success }]}>
                    Fully Paid {(invoice.total - (invoice.amountPaid || 0)) < 0 ? `(Credit ₦${Math.abs(invoice.total - (invoice.amountPaid || 0)).toLocaleString()})` : ''}
                  </Text>
                ) : (
                  <Text style={[styles.summaryValue, styles.balanceDue]}>
                    ₦{Math.abs(invoice.total - (invoice.amountPaid || 0)).toLocaleString()}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Payment History */}
        {invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={styles.itemsSection}>
              {invoice.paymentHistory.map((payment, index) => {
                const d: any = payment.date; const paymentDate = d?.toDate ? d.toDate() : d?.seconds ? new Date(d.seconds * 1000) : d instanceof Date ? d : new Date(d || Date.now());
                return (
                  <View key={index} style={[styles.itemRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemDescription}>
                        ₦{payment.amount.toLocaleString()}
                      </Text>
                      <Text style={styles.itemDetails}>
                        {format(paymentDate, 'MMM dd, yyyy')} - {payment.method?.replace('_', ' ')}
                      </Text>
                    </View>
                    {payment.receiptUrl && (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                        onPress={() => setProofModalUrl(payment.receiptUrl!)}
                      >
                        <Ionicons name="download-outline" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Receipt</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Pending Payments */}
        {invoice.pendingPayments && invoice.pendingPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Payments</Text>
            <View style={styles.itemsSection}>
              {invoice.pendingPayments.map((pp: any, index: number) => {
                const pd: any = pp.date; const ppDate = pd?.toDate ? pd.toDate() : pd?.seconds ? new Date(pd.seconds * 1000) : pd instanceof Date ? pd : new Date(pd || Date.now());
                return (
                  <View key={pp.id || index} style={[styles.itemRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemDescription, { color: colors.primary, fontWeight: '600' }]}>
                        Awaiting Confirmation
                      </Text>
                      <Text style={styles.itemDetails}>
                        Submitted on {format(ppDate, 'MMM dd, yyyy')}
                      </Text>
                    </View>
                    {pp.proofUrl && (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                        onPress={() => setProofModalUrl(pp.proofUrl)}
                      >
                        <Ionicons name="image-outline" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>View Proof</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Payment Button */}
        {(invoice.paymentStatus !== 'paid' || (invoice.total - (invoice.amountPaid || 0) > 0.01)) && (
          <TouchableOpacity
            style={[styles.payButton, { backgroundColor: colors.textPrimary }]}
            onPress={() => {
              setShowPaymentModal(true);
            }}
          >
            <Text style={[styles.payButtonText, { color: colors.textInverse }]}>Pay Now</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Bank Details Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bank Transfer</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.bankDetailsContainer}>
              <Text style={styles.bankLabel}>Account Name</Text>
              <Text style={styles.bankValue}>ABM TEK Solutions</Text>

              <Text style={styles.bankLabel}>Bank Name</Text>
              <Text style={styles.bankValue}>Moniepoint MFB</Text>

              <Text style={styles.bankLabel}>Account Number</Text>
              <View style={styles.accountNumberContainer}>
                <Text style={styles.accountNumber}>1234567890</Text>
                <TouchableOpacity onPress={() => {
                  // Copy logic could be here
                  Alert.alert('Copied', 'Account number copied to clipboard');
                }}>
                  <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.instructionContainer}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.instructionText}>
                  Please use your {(invoice as any).invoiceNumber || `INV-${invoice.id.slice(0, 8)}`} as the payment reference.
                </Text>
              </View>
            </View>

            <View style={styles.instructionContainer}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.instructionText}>
                Once you've made the transfer, please upload the receipt below. Our team will verify the amount and update your balance.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.textPrimary, marginBottom: 10 }]}
              onPress={() => setShowPaymentModal(false)}
            >
              <Text style={[styles.doneButtonText, { color: colors.textInverse }]}>I've made the transfer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary }, uploading && { opacity: 0.5 }]}
              disabled={uploading}
              onPress={async () => {
                try {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.7,
                  });
                  if (!result.canceled && result.assets[0]) {
                    setUploading(true);
                    const uploadUrl = await firebaseService.uploadFile(
                      result.assets[0].uri,
                      `payment_proofs/${invoice.id}/proof_${Date.now()}`
                    );
                    const pendingPayment = {
                      id: `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      amount: 0, // Staff will verify and enter manually
                      method: 'bank_transfer',
                      recordedBy: user?.id || '',
                      recordedByName: user?.name || 'Customer',
                      date: new Date(),
                      status: 'pending' as const,
                      proofUrl: uploadUrl,
                    };
                    const pendingPayments = [...(invoice.pendingPayments || []), pendingPayment];
                    await firebaseService.updateInvoice(invoice.id, { pendingPayments });
                    const updated = await firebaseService.getInvoice(invoice.id);
                    if (updated) setInvoice(updated);
                    setShowPaymentModal(false);
                    Alert.alert('Success', 'Payment proof uploaded. Staff will confirm your payment shortly.');
                  }
                } catch (err: any) {
                  Alert.alert('Error', 'Failed to upload payment proof');
                  console.error(err);
                } finally {
                  setUploading(false);
                }
              }}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                  <Text style={[styles.doneButtonText, { color: colors.primary, marginLeft: 8 }]}>Upload Payment Proof</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Proof Viewer Modal */}
      <Modal
        visible={!!proofModalUrl}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setProofModalUrl(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 60, right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Document Viewer</Text>
            <TouchableOpacity onPress={() => setProofModalUrl(null)}>
              <Ionicons name="close-circle" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
          {proofModalUrl && (
            <Image
              source={{ uri: proofModalUrl }}
              style={{
                width: Dimensions.get('window').width * 0.9,
                height: Dimensions.get('window').height * 0.7,
                borderRadius: 12,
                backgroundColor: '#222'
              }}
              resizeMode="contain"
            />
          )}
        </View>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  downloadButtonText: {
    marginRight: 8,
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.textPrimary,
  },
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  paymentInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paidText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  remainingText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
  },

  // Item Styles
  itemsSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 15,
  },
  itemRow: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 15,
  },
  itemInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Summary Styles
  summarySection: {
    backgroundColor: colors.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  balanceDue: {
    color: colors.error,
    fontSize: 18,
  },

  // Pay Button
  payButton: {
    backgroundColor: colors.textPrimary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  payButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  bankDetailsContainer: {
    marginBottom: 20,
  },
  bankLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  bankValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 15,
  },
  accountNumberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  accountNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  instructionContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.background, // Or a blue tint? Keeping it simple for dark mode safe
    padding: 15,
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  instructionText: {
    fontSize: 12,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
  },
  doneButton: {
    flexDirection: 'row',
    backgroundColor: colors.textPrimary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});

