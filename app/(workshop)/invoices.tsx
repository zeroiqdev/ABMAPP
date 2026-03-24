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
import { useColors } from '@/constants/design';

export default function WorkshopInvoicesScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [user, filter]);

  const loadInvoices = async () => {
    if (!user?.workshopId) return;

    try {
      const invoicesData = await firebaseService.getInvoices(undefined, user.workshopId);
      let filtered = invoicesData;

      if (filter === 'pending') {
        filtered = invoicesData.filter((inv) => inv.paymentStatus === 'pending');
      } else if (filter === 'paid') {
        filtered = invoicesData.filter((inv) => inv.paymentStatus === 'paid');
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
      case 'failed': return '#FF3B30';
      default: return '#666';
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={() => router.push(`/(workshop)/invoice-details?id=${item.id}`)}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' }]}>
          <Ionicons name="receipt-outline" size={24} color={getPaymentStatusColor(item.paymentStatus)} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>{(item as any).invoiceNumber || `INV-${item.id.slice(0, 8)}`}</Text>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            {format(item.createdAt, 'MMM dd, yyyy')}
          </Text>
        </View>
      </View>
      <View style={styles.itemRight}>
        <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
          <Text style={[styles.amountText, { color: colors.textPrimary }]}>₦{item.total.toLocaleString()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(item.paymentStatus) + '20' }]}>
            <Text style={[styles.statusText, { color: getPaymentStatusColor(item.paymentStatus) }]}>
              {item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Invoices</Text>
        <TouchableOpacity onPress={() => router.push('/(workshop)/create-invoice')}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.filterTab, { backgroundColor: colors.background }, filter === 'all' && { backgroundColor: colors.primary }]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'all' && { color: colors.textInverse },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            { backgroundColor: colors.background },
            filter === 'pending' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilter('pending')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'pending' && { color: colors.textInverse },
            ]}
          >
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            { backgroundColor: colors.background },
            filter === 'paid' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilter('paid')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'paid' && { color: colors.textInverse },
            ]}
          >
            Paid
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No invoices found</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 0,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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

