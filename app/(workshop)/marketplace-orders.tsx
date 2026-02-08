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
import { Colors, Typography, Spacing, BorderRadius, useColors } from '@/constants/design';
import { format } from 'date-fns';

const TABS = ['All Orders', 'Pending Action', 'Ready for Payout', 'Paid'];

export default function MarketplaceOrdersScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const colors = useColors();
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
                return colors.warning;
            case 'confirmed':
                return colors.info;
            case 'shipped':
                return colors.primary; // Changed to primary (brand blue/white) or use colors.info
            case 'shipment_verified':
                return '#9C27B0';
            case 'delivered':
                return colors.success;
            case 'cancelled':
                return colors.error;
            default:
                return colors.textSecondary;
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
                style={[styles.orderCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() =>
                    router.push(`/(workshop)/marketplace-order-details?id=${item.id}`)
                }
            >
                <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
                    {firstItem?.image ? (
                        <Image source={{ uri: firstItem.image }} style={styles.orderImage} />
                    ) : (
                        <Ionicons name="cube-outline" size={24} color={colors.textTertiary} />
                    )}
                </View>

                <View style={styles.orderDetails}>
                    <Text style={[styles.orderName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={[styles.orderPrice, { color: colors.textPrimary }]}>₦{item.total.toLocaleString()}</Text>
                    <View style={styles.orderMeta}>
                        <Text style={[styles.orderId, { color: colors.textSecondary }]}>#{item.id.slice(0, 8)}</Text>
                        <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
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

                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Marketplace Orders</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <FlatList
                    data={TABS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.tabItem,
                                activeTab === item && styles.tabItemActive,
                                activeTab === item && { borderBottomColor: colors.textPrimary },
                            ]}
                            onPress={() => setActiveTab(item)}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: colors.textSecondary },
                                    activeTab === item && { color: colors.textPrimary, fontWeight: Typography.fontWeight.semibold },
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
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="receipt-outline"
                            size={64}
                            color={colors.textTertiary}
                        />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No orders found</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.bold,
    },
    listContent: { padding: 20 },
    orderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    orderImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    orderDetails: { flex: 1, justifyContent: 'center' },
    orderName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    orderPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    orderMeta: { flexDirection: 'row', alignItems: 'center' },
    orderId: { fontSize: 12 },
    orderDate: { fontSize: 12 },
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
        borderBottomWidth: 1,
    },
    tabsContent: { paddingHorizontal: 15 },
    tabItem: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        marginRight: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {},
    tabText: { fontSize: 14, fontWeight: '500' },
    tabTextActive: { fontWeight: '600' },
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
        marginTop: Spacing.base,
    },
});
