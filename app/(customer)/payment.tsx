import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { paymentService } from '@/services/paymentService';
import { Invoice } from '@/types';

export default function PaymentScreen() {
  const router = useRouter();
  const { invoiceId, reference } = useLocalSearchParams<{
    invoiceId: string;
    reference: string;
  }>();
  const { user } = useAuthStore();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'flutterwave'>('paystack');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      const invoices = await firebaseService.getInvoices();
      const invoiceData = invoices.find((inv) => inv.id === invoiceId);
      if (invoiceData) {
        setInvoice(invoiceData);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!invoice || !user) return;

    setProcessing(true);
    try {
      const paymentData = {
        amount: invoice.total,
        email: user.email,
        reference: reference || paymentService.generatePaymentReference(),
        metadata: {
          invoiceId: invoice.id,
          userId: user.id,
        },
      };

      let result: { success: boolean; transactionId?: string; message: string };
      if (paymentMethod === 'paystack') {
        result = await paymentService.initializePaystackPayment(paymentData);
      } else {
        result = await paymentService.initializeFlutterwavePayment(paymentData);
      }

      if (result.success && result.transactionId) {
        const transactionId = result.transactionId;
        Alert.alert(
          'Payment Initiated',
          'Please complete the payment. We will verify it shortly.',
          [
            {
              text: 'OK',
              onPress: async () => {
                setTimeout(async () => {
                  try {
                    const verifyResult =
                      paymentMethod === 'paystack'
                        ? await paymentService.verifyPaystackPayment(
                            transactionId
                          )
                        : await paymentService.verifyFlutterwavePayment(
                            transactionId
                          );

                    if (verifyResult.success) {
                      await firebaseService.updateInvoice(invoice.id, {
                        paymentStatus: 'paid',
                        paymentMethod: paymentMethod,
                        paymentDate: new Date(),
                      });

                      Alert.alert(
                        'Payment Successful',
                        'Your payment has been processed successfully.',
                        [
                          {
                            text: 'OK',
                            onPress: () => router.back(),
                          },
                        ]
                      );
                    } else {
                      Alert.alert('Payment Failed', verifyResult.message);
                    }
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  }
                }, 2000);
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment initialization failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
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
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Invoice Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Invoice Number</Text>
              <Text style={styles.summaryValue}>
                #{invoice.id.slice(0, 8)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.amountValue}>
                ₦{invoice.total.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.paymentMethodCard,
              paymentMethod === 'paystack' && styles.paymentMethodCardActive,
            ]}
            onPress={() => setPaymentMethod('paystack')}
          >
            <View style={styles.paymentMethodContent}>
              <Ionicons
                name="card-outline"
                size={24}
                color={paymentMethod === 'paystack' ? '#007AFF' : '#666'}
              />
              <View style={styles.paymentMethodInfo}>
                <Text
                  style={[
                    styles.paymentMethodName,
                    paymentMethod === 'paystack' && styles.paymentMethodNameActive,
                  ]}
                >
                  Paystack
                </Text>
                <Text style={styles.paymentMethodDesc}>
                  Pay with card, bank transfer, or USSD
                </Text>
              </View>
              {paymentMethod === 'paystack' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentMethodCard,
              paymentMethod === 'flutterwave' && styles.paymentMethodCardActive,
            ]}
            onPress={() => setPaymentMethod('flutterwave')}
          >
            <View style={styles.paymentMethodContent}>
              <Ionicons
                name="card-outline"
                size={24}
                color={paymentMethod === 'flutterwave' ? '#007AFF' : '#666'}
              />
              <View style={styles.paymentMethodInfo}>
                <Text
                  style={[
                    styles.paymentMethodName,
                    paymentMethod === 'flutterwave' && styles.paymentMethodNameActive,
                  ]}
                >
                  Flutterwave
                </Text>
                <Text style={styles.paymentMethodDesc}>
                  Pay with card, mobile money, or bank transfer
                </Text>
              </View>
              {paymentMethod === 'flutterwave' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Payment Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay ₦{invoice.total.toLocaleString()}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#666" />{' '}
            Your payment is secure and encrypted
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  paymentMethodCard: {
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  paymentMethodCardActive: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  paymentMethodNameActive: {
    color: '#007AFF',
  },
  paymentMethodDesc: {
    fontSize: 12,
    color: '#999',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  securityNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

