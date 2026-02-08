import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Order } from '@/types';
import { useColors, Typography, Spacing } from '@/constants/design';
import { format } from 'date-fns';

const TABS = ['All Orders', 'New Orders', 'Processing', 'Shipped', 'Cancelled'];

export default function OrdersScreen() {
  const router = useRouter();
  const { user, isGuest, guestEmail } = useAuthStore();
  const colors = useColors(); // Use dynamic theme colors
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('New Orders');
  const isVendor = user?.role === 'vendor';
  const styles = getStyles(colors);

  useEffect(() => {
    let unsubscribe: () => void | undefined;

    if (isVendor && user) {
      const unsubscribeSales = firebaseService.subscribeToVendorOrders(user.id, (sales) => {
        setSalesOrders(sales);
      });
      const unsubscribePurchases = firebaseService.subscribeToOrders(user.id, (purchases) => {
        setPurchaseOrders(purchases);
      });

      unsubscribe = () => {
        unsubscribeSales();
        unsubscribePurchases();
      };
    } else if (user) {
      unsubscribe = firebaseService.subscribeToOrders(user.id, (newOrders) => {
        setOrders(newOrders);
        setLoading(false);
      });
    } else if (isGuest && guestEmail) {
      unsubscribe = firebaseService.subscribeToGuestOrders(guestEmail, (newOrders) => {
        setOrders(newOrders);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isVendor, isGuest, guestEmail]);

  // Merge orders for vendors
  useEffect(() => {
    if (isVendor) {
      const allOrders = [...salesOrders, ...purchaseOrders];
      const uniqueOrders = Array.from(new Map(allOrders.map(item => [item.id, item])).values());
      uniqueOrders.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

      setOrders(uniqueOrders);
      setLoading(false);
    }
  }, [salesOrders, purchaseOrders, isVendor]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'confirmed': return colors.success;
      case 'shipped': return colors.info;
      case 'delivered': return colors.success;
      case 'cancelled': return colors.error;
      default: return colors.warning;
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: Order['status']) => {
    try {
      await firebaseService.updateOrder(orderId, { status: newStatus });
      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getFilteredOrders = () => {
    if (!isVendor) return orders;
    switch (activeTab) {
      case 'New Orders': return orders.filter(o => o.status === 'pending');
      case 'Processing': return orders.filter(o => o.status === 'confirmed');
      case 'Shipped': return orders.filter(o => o.status === 'shipped');
      case 'Cancelled': return orders.filter(o => o.status === 'cancelled');
      default: return orders;
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const firstItem = item.products[0];
    const otherItemsCount = item.products.length - 1;
    const itemName = firstItem ? firstItem.productName : 'Unknown Item';
    const displayName = otherItemsCount > 0 ? `${itemName} +${otherItemsCount} more` : itemName;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/(marketplace)/order-details?id=${item.id}`)}
      >
        <View style={styles.iconBox}>
          <Image source={{ uri: firstItem?.image || 'https://via.placeholder.com/100' }} style={styles.orderImage} />
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.orderName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.orderPrice}>₦{item.total.toLocaleString()}</Text>
          <View style={styles.orderMeta}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
            <Text style={styles.orderDate}>• {item.createdAt ? format(item.createdAt, 'MMM d, yyyy') : ''}</Text>
          </View>
        </View>

        <View style={styles.orderActions}>
          <TouchableOpacity style={styles.viewButton} onPress={() => router.push(`/(marketplace)/order-details?id=${item.id}`)}>
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.centerContainer}><ActivityIndicator size="large" color={colors.textPrimary} /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>{isVendor ? 'Vendor Orders' : 'My Orders'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabsContainer}>
        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.tabItem, activeTab === item && styles.tabItemActive]} onPress={() => setActiveTab(item)}>
              <Text style={[styles.tabText, activeTab === item && styles.tabTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      <FlatList
        data={getFilteredOrders()}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>{isVendor ? 'Orders for your products will appear here' : 'Your marketplace orders will appear here'}</Text>
          </View>
        }
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingTop: Spacing['5xl'], backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: colors.textPrimary },
  listContent: { padding: 20 },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  iconBox: { width: 80, height: 80, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: colors.background },
  orderImage: { width: 76, height: 76, borderRadius: 6, backgroundColor: colors.background },
  orderDetails: { flex: 1, justifyContent: 'center' },
  orderName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  orderPrice: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 6 },
  orderMeta: { flexDirection: 'row', alignItems: 'center' },
  orderId: { fontSize: 12, color: colors.textSecondary },
  orderDate: { fontSize: 12, color: colors.textSecondary },
  orderActions: { justifyContent: 'center', alignItems: 'center', paddingLeft: 8, width: 80 },
  viewButton: { backgroundColor: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  viewButtonText: { color: colors.textInverse, fontWeight: '600', fontSize: 12 },
  tabsContainer: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsContent: { paddingHorizontal: 15 },
  tabItem: { paddingVertical: 15, paddingHorizontal: 15, marginRight: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.textPrimary },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.textPrimary, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing['3xl'] },
  emptyText: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: colors.textTertiary, marginTop: Spacing.base },
  emptySubtext: { fontSize: Typography.fontSize.sm, color: colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
});


