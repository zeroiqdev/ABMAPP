import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Invoice } from '@/types';
import { format } from 'date-fns';

export default function InvoicesScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'partially_paid'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [user, filter]);

  const loadInvoices = async () => {
    if (!user) return;

    try {
      const invoicesData = await firebaseService.getInvoices(user.id);
      // Filter out drafts and void invoices
      let filtered = invoicesData.filter(inv => inv.status === 'approved' || inv.status === undefined); // Backward compatibility

      if (filter === 'pending') {
        filtered = filtered.filter((inv) => inv.paymentStatus === 'pending');
      } else if (filter === 'paid') {
        filtered = filtered.filter((inv) => inv.paymentStatus === 'paid');
      } else if (filter === 'partially_paid') {
        filtered = filtered.filter((inv) => inv.paymentStatus === 'partially_paid');
      }

      setInvoices(filtered);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#30D158';
      case 'pending': return '#FFA500';
      case 'partially_paid': return '#5856D6';
      case 'failed': return '#FF3B30';
      default: return '#666';
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const amountPaid = item.amountPaid || 0;
    const remaining = item.total - amountPaid;

    return (
      <TouchableOpacity
        style={styles.invoiceCard}
        onPress={() => router.push(`/(customer)/invoice-details?id=${item.id}`)}
      >
        <View style={styles.invoiceHeader}>
          <View>
            <Text
              style={styles.invoiceNumber}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Invoice #{item.id}
            </Text>
            <Text style={styles.invoiceDate}>
              {format(item.createdAt, 'MMM dd, yyyy')}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getPaymentStatusColor(item.paymentStatus) },
              ]}
            >
              {item.paymentStatus === 'partially_paid'
                ? 'Partially Paid'
                : item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.invoiceAmount}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>₦{item.total.toLocaleString()}</Text>
        </View>
        {amountPaid > 0 && (
          <View style={styles.paymentInfo}>
            <Text style={styles.paidText}>Paid: ₦{amountPaid.toLocaleString()}</Text>
            <Text style={[styles.remainingText, remaining < 0 && { color: '#30D158' }]}>
              {remaining < 0
                ? `Overpayment: ₦${Math.abs(remaining).toLocaleString()}`
                : `Remaining: ₦${remaining.toLocaleString()}`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'paid', 'partially_paid'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterPill,
              filter === filterOption && styles.filterPillActive,
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles.filterText,
                filter === filterOption && styles.filterTextActive,
              ]}
            >
              {filterOption === 'all'
                ? 'All'
                : filterOption === 'partially_paid'
                  ? 'Partially Paid'
                  : filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterPillActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 15,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
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
    color: '#333',
    marginBottom: 4,
    maxWidth: 200,
  },
  invoiceCustomer: {
    fontSize: 14,
    color: '#000',
    marginTop: 2,
    fontWeight: '500',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#000',
    marginTop: 4,
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
    color: '#000',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  paymentInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  paidText: {
    fontSize: 12,
    color: '#000',
    marginBottom: 4,
  },
  remainingText: {
    fontSize: 12,
    color: '#000',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});

