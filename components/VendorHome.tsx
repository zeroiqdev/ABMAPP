import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { firebaseService } from '@/services/firebaseService';
import { useAuthStore } from '@/store/authStore';
import { Order } from '@/types';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { MonthPickerModal } from '@/components/MonthPickerModal';
import { Colors, useColors } from '@/constants/design';

const { width } = Dimensions.get('window');

export const VendorHome = () => {
    const router = useRouter();
    const { user } = useAuthStore();
    const colors = useColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
    });
    const [pickerVisible, setPickerVisible] = useState(false);

    const [vendorStats, setVendorStats] = useState({
        revenue: 0,
        all: 0,
        pending: 0,
        shipped: 0,
    });

    useEffect(() => {
        if (user?.role === 'vendor') {
            const unsubscribe = firebaseService.subscribeToVendorOrders(user.id, (orders) => {
                setAllOrders(orders);
            });
            return () => unsubscribe();
        }
    }, [user]);

    useEffect(() => {
        // Filter orders by date range
        const start = dateRange.start;
        const end = dateRange.end;

        const monthlyOrders = allOrders.filter(o =>
            o.createdAt && isWithinInterval(o.createdAt, { start, end })
        );

        setFilteredOrders(monthlyOrders);

        // Calculate Revenue (Accepted orders: confirmed, shipped, delivered, completed, shipment_verified)
        const acceptedOrders = monthlyOrders.filter(o =>
            ['confirmed', 'shipped', 'delivered', 'completed', 'shipment_verified'].includes(o.status)
        );
        const revenue = acceptedOrders.reduce((sum, order) => sum + (order.total || 0), 0);

        setVendorStats({
            revenue,
            all: monthlyOrders.length,
            pending: monthlyOrders.filter(o => o.status === 'pending').length,
            shipped: monthlyOrders.filter(o => o.status === 'shipped').length,
        });

        // Recent orders within this range
        setRecentOrders(monthlyOrders.slice(0, 5));
    }, [allOrders, dateRange]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#FF9800';
            case 'confirmed': return '#2196F3';
            case 'shipped': return '#4CAF50';
            case 'cancelled': return '#F44336';
            default: return '#999';
        }
    };

    const renderRecentOrder = ({ item }: { item: Order }) => {
        const firstItem = item.products[0];
        const otherItemsCount = item.products.length - 1;
        const itemName = firstItem ? firstItem.productName : 'Unknown Item';
        const displayName = otherItemsCount > 0 ? `${itemName} +${otherItemsCount} more` : itemName;

        return (
            <TouchableOpacity
                style={styles.recentOrderCard}
                onPress={() => router.push(`/(marketplace)/order-details?id=${item.id}`)}
            >
                <View style={styles.recentOrderHeader}>
                    <Text style={styles.recentOrderId} numberOfLines={1}>{displayName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>
                <View style={styles.recentOrderFooter}>
                    <Text style={styles.recentOrderDate}>{item.createdAt ? format(item.createdAt, 'MMM d, yyyy') : ''}</Text>
                    <Text style={styles.recentOrderTotal}>₦{item.total.toLocaleString()}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerSubtitle}>Welcome back, {user?.name}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.dashboardContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Overview</Text>
                    <TouchableOpacity
                        style={styles.dateSelector}
                        onPress={() => setPickerVisible(true)}
                    >
                        <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
                        <Text style={styles.dateText}>
                            {format(dateRange.start, 'MMM yyyy') === format(dateRange.end, 'MMM yyyy')
                                ? format(dateRange.start, 'MMM yyyy')
                                : `${format(dateRange.start, 'MMM yyyy')} - ${format(dateRange.end, 'MMM yyyy')}`}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                        <Text style={styles.statLabel}>Revenue</Text>
                        <Text style={styles.statValue}>₦{vendorStats.revenue.toLocaleString()}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Orders</Text>
                        <Text style={styles.statValue}>{vendorStats.all}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Pending</Text>
                        <Text style={styles.statValue}>{vendorStats.pending}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Shipped</Text>
                        <Text style={styles.statValue}>{vendorStats.shipped}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.recentOrdersContainer}>
                <View style={styles.recentOrdersHeader}>
                    <Text style={styles.sectionTitle}>
                        Orders {format(dateRange.start, 'MMM yyyy') === format(dateRange.end, 'MMM yyyy')
                            ? `in ${format(dateRange.start, 'MMMM')}`
                            : `(${format(dateRange.start, 'MMM')} - ${format(dateRange.end, 'MMM')})`}
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/(marketplace)/orders')}>
                        <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                </View>
                {recentOrders.map(order => (
                    <View key={order.id}>{renderRecentOrder({ item: order })}</View>
                ))}
                {recentOrders.length === 0 && (
                    <Text style={styles.emptyText}>No orders in this month</Text>
                )}
            </View>
            <View style={{ height: 100 }} />

            <MonthPickerModal
                visible={pickerVisible}
                dateRange={dateRange}
                onRangeChange={setDateRange}
                onClose={() => setPickerVisible(false)}
            />
        </ScrollView>
    );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 60,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 5,
    },
    dashboardContainer: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 15,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statCard: {
        width: (width - 52) / 2, // 20px padding * 2 + 12px gap
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 16,
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: 100,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statLabel: {
        fontSize: 14,
        color: colors.textTertiary,
        marginBottom: 8,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    recentOrdersContainer: {
        paddingHorizontal: 20,
    },
    recentOrdersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    viewAllText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    recentOrderCard: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    recentOrderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    recentOrderId: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    recentOrderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    recentOrderDate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    recentOrderTotal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.textTertiary,
        marginTop: 20,
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
});
