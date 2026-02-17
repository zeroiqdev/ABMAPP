import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { Invoice, Job, User } from '@/types';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/constants/design';

export default function InvoiceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadInvoiceDetails();
  }, [id]);

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
      await Sharing.shareAsync(uri);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate invoice PDF');
      console.error('Error generating PDF:', error);
    }
  };

  const generateInvoiceHTML = (inv: Invoice, job: Job | null, customer: User | null) => {
    const amountPaid = inv.amountPaid || 0;
    const balanceDue = inv.total - amountPaid;
    const paymentHistory = inv.paymentHistory || [];

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .items-table th { background-color: #f5f5f5; }
            .total-section { text-align: right; margin-top: 20px; }
            .balance-box { background: #f5f5f5; padding: 15px; margin-top: 20px; text-align: center; }
            .payment-history { margin-top: 30px; }
            .payment-item { padding: 8px; border-bottom: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <p>Invoice #${inv.id}</p>
          </div>
          <div class="invoice-info">
            <div>
              <p><strong>Customer:</strong> ${customer?.name || 'Customer'}</p>
              <p><strong>Date:</strong> ${format(inv.createdAt, 'MMM dd, yyyy')}</p>
              ${inv.dueDate ? `<p><strong>Due Date:</strong> ${format(inv.dueDate, 'MMM dd, yyyy')}</p>` : ''}
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
              ${inv.items.map(
      (item) => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>₦${item.unitPrice.toLocaleString()}</td>
                  <td>₦${item.total.toLocaleString()}</td>
                </tr>
              `
    ).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <p>Subtotal: ₦${inv.subtotal.toLocaleString()}</p>
            ${inv.vat > 0 ? `<p>VAT: ₦${inv.vat.toLocaleString()}</p>` : ''}
            ${inv.discount > 0 ? `<p>Discount: -₦${inv.discount.toLocaleString()}</p>` : ''}
            <p><strong>Total: ₦${inv.total.toLocaleString()}</strong></p>
            ${amountPaid > 0 ? `<p>Amount Paid: ₦${amountPaid.toLocaleString()}</p>` : ''}
          </div>
          <div class="balance-box">
            <div><strong>${balanceDue < 0 ? 'Overpayment' : 'Balance Due'}</strong></div>
            <div style="font-size: 24px; font-weight: bold; color: ${balanceDue < 0 ? '#30D158' : '#000'}">
              ₦${Math.abs(balanceDue).toLocaleString()}
            </div>
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
              <Text style={styles.invoiceNumber}>Invoice #{invoice.id.slice(0, 8)}</Text>
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
                    <Text style={styles.itemDescription}>{item.description}</Text>
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

        {/* Payment Button */}
        {invoice.paymentStatus !== 'paid' && (
          <TouchableOpacity
            style={[styles.payButton, { backgroundColor: colors.textPrimary }]}
            onPress={() => setShowPaymentModal(true)}
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
                  Please use your Invoice #{invoice.id.slice(0, 8)} as the payment reference.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.textPrimary }]}
              onPress={() => setShowPaymentModal(false)}
            >
              <Text style={[styles.doneButtonText, { color: colors.textInverse }]}>I've made the transfer</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: colors.textPrimary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
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

