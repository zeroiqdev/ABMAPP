import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Order } from '@/types';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/design';
import { format } from 'date-fns';

const TABS = ['All Orders', 'Pending Action', 'Ready for Payout', 'Paid'];

export default function MarketplaceOrdersScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All Orders');

    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'super_admin') {
            router.replace('/(workshop)/dashboard');
            return;
        }

        const unsubscribe = firebaseService.subscribeToAllOrders((newOrders) => {
            setOrders(newOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const onRefresh = async () => {
        setRefreshing(true);
        // Subscription handles updates, but we can force a manual fetch if needed.
        // For now, let's just wait a bit to simulate refresh as subscription is live.
        setTimeout(() => setRefreshing(false), 1000);
    };

    const getFilteredOrders = () => {
        switch (activeTab) {
            case 'Pending Action':
                return orders.filter(
                    (o) => o.status === 'pending' || o.status === 'confirmed'
                );
            case 'Ready for Payout':
                return orders.filter(
                    (o) =>
                        o.status === 'delivered' &&
                        (!o.payoutStatus || o.payoutStatus === 'pending')
                );
            case 'Paid':
                return orders.filter((o) => o.payoutStatus === 'paid');
            default:
                return orders;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return Colors.warning;
            case 'confirmed':
                return Colors.info;
            case 'shipped':
                return Colors.secondary;
            case 'shipment_verified':
                return '#9C27B0';
            case 'delivered':
                return Colors.success;
            case 'cancelled':
                return Colors.error;
            default:
                return Colors.textSecondary;
        }
    };

    const renderOrder = ({ item }: { item: Order }) => {
        // Determine overall item display
        const firstItem = item.products[0];
        const otherItemsCount = item.products.length - 1;
        const itemName = firstItem ? firstItem.productName : 'Unknown Item';
        const displayName =
            otherItemsCount > 0 ? `${itemName} +${otherItemsCount} more` : itemName;

        return (
            <TouchableOpacity
                style={styles.orderCard}
                activeOpacity={0.8}
                onPress={() =>
                    router.push(`/(workshop)/marketplace-order-details?id=${item.id}`)
                }
            >
                <View style={styles.iconBox}>
                    {firstItem?.image ? (
                        <Image source={{ uri: firstItem.image }} style={styles.orderImage} />
                    ) : (
                        <Ionicons name="cube-outline" size={24} color="#666" />
                    )}
                </View>

                <View style={styles.orderDetails}>
                    <Text style={styles.orderName} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={styles.orderPrice}>₦{item.total.toLocaleString()}</Text>
                    <View style={styles.orderMeta}>
                        <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                        <Text style={styles.orderDate}>
                            • {item.createdAt ? format(item.createdAt, 'MMM d, yyyy') : ''}
                        </Text>
                    </View>
                </View>

                <View style={styles.statusContainer}>
                    <View
                        style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(item.status) + '15' },
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusText,
                                { color: getStatusColor(item.status) },
                            ]}
                        >
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                    {item.payoutStatus === 'paid' && (
                        <View style={styles.paidBadge}>
                            <Text style={styles.paidText}>PAID</Text>
                        </View>
                    )}
                </View>

                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
        );
    };

    if (loading)
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Marketplace Orders</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.tabsContainer}>
                <FlatList
                    data={TABS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.tabItem,
                                activeTab === item && styles.tabItemActive,
                            ]}
                            onPress={() => setActiveTab(item)}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    activeTab === item && styles.tabTextActive,
                                ]}
                            >
                                {item}
                            </Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item}
                    contentContainerStyle={styles.tabsContent}
                />
            </View>

            <FlatList
                data={getFilteredOrders()}
                renderItem={renderOrder}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="receipt-outline"
                            size={64}
                            color={Colors.textTertiary}
                        />
                        <Text style={styles.emptyText}>No orders found</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing['5xl'],
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.bold,
        color: Colors.textPrimary,
    },
    listContent: { padding: 20 },
    orderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        backgroundColor: '#fff',
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
    },
    orderImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    orderDetails: { flex: 1, justifyContent: 'center' },
    orderName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
    },
    orderPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 6,
    },
    orderMeta: { flexDirection: 'row', alignItems: 'center' },
    orderId: { fontSize: 12, color: '#666' },
    orderDate: { fontSize: 12, color: '#666' },
    statusContainer: { alignItems: 'flex-end', marginRight: 8 },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 4,
    },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    paidBadge: {
        backgroundColor: Colors.success,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    paidText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    tabsContainer: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    tabsContent: { paddingHorizontal: 15 },
    tabItem: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        marginRight: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: { borderBottomColor: '#000' },
    tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
    tabTextActive: { color: '#000', fontWeight: '600' },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing['3xl'],
        marginTop: 50,
    },
    emptyText: {
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.semibold,
        color: Colors.textTertiary,
        marginTop: Spacing.base,
    },
});
