import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Order } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/design';
import { format } from 'date-fns';

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const isVendor = user?.role === 'vendor';

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    if (!user) return;
    try {
      const userOrders = isVendor
        ? await firebaseService.getOrders(undefined, user.id)
        : await firebaseService.getOrders(user.id);
      setOrders(userOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
        return Colors.success;
      case 'shipped':
        return Colors.info;
      case 'delivered':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.warning;
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: Order['status']) => {
    try {
      await firebaseService.updateOrder(orderId, { status: newStatus });
      await loadOrders();
      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const showStatusOptions = (order: Order) => {
    const statusOptions: { label: string; value: Order['status'] }[] = [];
    
    if (order.status === 'pending') {
      statusOptions.push({ label: 'Confirm Order', value: 'confirmed' });
      statusOptions.push({ label: 'Cancel Order', value: 'cancelled' });
    } else if (order.status === 'confirmed') {
      statusOptions.push({ label: 'Mark as Shipped', value: 'shipped' });
      statusOptions.push({ label: 'Cancel Order', value: 'cancelled' });
    } else if (order.status === 'shipped') {
      statusOptions.push({ label: 'Mark as Delivered', value: 'delivered' });
    }

    if (statusOptions.length === 0) return;

    Alert.alert(
      'Update Order Status',
      'Select new status:',
      [
        ...statusOptions.map((option) => ({
          text: option.label,
          onPress: () => handleStatusUpdate(order.id, option.value),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={isVendor ? () => showStatusOptions(item) : undefined}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>
            {format(item.createdAt, 'MMM dd, yyyy')}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.orderItems}>
        <Text style={styles.itemsCount}>
          {item.products.length} item{item.products.length !== 1 ? 's' : ''}
        </Text>
        {item.products.map((product, index) => (
          <Text key={index} style={styles.productName}>
            • {product.productName} (x{product.quantity})
          </Text>
        ))}
      </View>
      {item.shippingAddress && (
        <View style={styles.shippingInfo}>
          <Text style={styles.shippingLabel}>Shipping Address:</Text>
          <Text style={styles.shippingText}>{item.shippingAddress}</Text>
        </View>
      )}
      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>₦{item.total.toLocaleString()}</Text>
        {isVendor && (
          <TouchableOpacity
            style={styles.updateButton}
            onPress={() => showStatusOptions(item)}
          >
            <Text style={styles.updateButtonText}>Update Status</Text>
          </TouchableOpacity>
        )}
        {!isVendor && (
          <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>{isVendor ? 'Orders' : 'My Orders'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bag-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubtext}>
                {isVendor 
                  ? 'Orders for your products will appear here'
                  : 'Your marketplace orders will appear here'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing['5xl'],
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  listContent: {
    padding: Spacing.base,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.base,
    ...Shadows.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  orderId: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  orderDate: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  orderItems: {
    marginBottom: Spacing.md,
  },
  itemsCount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  productName: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  shippingInfo: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  shippingLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  shippingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  orderTotal: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  updateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['3xl'],
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textTertiary,
    marginTop: Spacing.base,
  },
  emptySubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});



