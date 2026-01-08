import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { paymentService } from '@/services/paymentService';
import { Invoice } from '@/types';
import * as ClipboardExpo from 'expo-clipboard';

export default function PaymentScreen() {
  const router = useRouter();
  const { invoiceId, reference } = useLocalSearchParams<{
    invoiceId: string;
    reference: string;
  }>();
  const { user } = useAuthStore();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [accountDetails, setAccountDetails] = useState<any>(null);

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
      const result = await paymentService.initializeMonnifyPayment(
        invoice.id,
        invoice.total,
        { name: user.name, email: user.email }
      );

      if (result.success && result.accountDetails) {
        setAccountDetails(result.accountDetails);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment initialization failed');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await ClipboardExpo.setStringAsync(text);
    Alert.alert('Copied', 'Account number copied to clipboard');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
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

        {accountDetails ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Make Transfer</Text>
            <Text style={styles.instructionText}>
              Please make a transfer to the account below. Your payment will be confirmed automatically.
            </Text>

            <View style={styles.accountCard}>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Bank Name</Text>
                <Text style={styles.accountValue}>{accountDetails.bankName}</Text>
              </View>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Account Details</Text>
                <Text style={styles.accountValue}>{accountDetails.accountName}</Text>
              </View>
              <TouchableOpacity
                style={styles.accountNumberRow}
                onPress={() => copyToClipboard(accountDetails.accountNumber)}
              >
                <View>
                  <Text style={styles.accountLabel}>Account Number</Text>
                  <Text style={styles.accountNumberValue}>{accountDetails.accountNumber}</Text>
                </View>
                <Ionicons name="copy-outline" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => router.back()}
            >
              <Text style={styles.doneButtonText}>I have made the transfer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Payment Button */
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
                    Pay with Monnify
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#666" />{' '}
              Your payment is secure and encrypted
            </Text>
          </View>
        )}
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
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
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
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  accountCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  accountRow: {
    marginBottom: 15,
  },
  accountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  accountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  accountNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  accountNumberValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 2,
  },
  doneButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});

