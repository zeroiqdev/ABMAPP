import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { firebaseService } from '@/services/firebaseService';
import { useAuthStore } from '@/store/authStore';
import { Order } from '@/types';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { DateRangeFilter } from '@/components/DateRangeFilter';

const { width } = Dimensions.get('window');

export const VendorHome = () => {
    const router = useRouter();
    const { user } = useAuthStore();
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [vendorStats, setVendorStats] = useState({
        all: 0,
        pending: 0,
        shipped: 0,
        cancelled: 0,
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
        // Filter orders by selected month
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);

        const monthlyOrders = allOrders.filter(o =>
            o.createdAt && isWithinInterval(o.createdAt, { start, end })
        );

        setFilteredOrders(monthlyOrders);

        setVendorStats({
            all: monthlyOrders.length,
            pending: monthlyOrders.filter(o => o.status === 'pending').length,
            shipped: monthlyOrders.filter(o => o.status === 'shipped').length,
            cancelled: monthlyOrders.filter(o => o.status === 'cancelled').length,
        });

        // Recent orders within this month
        setRecentOrders(monthlyOrders.slice(0, 5));
    }, [allOrders, selectedDate]);

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
                        <Text style={styles.headerTitle}>Vendor Dashboard</Text>
                        <Text style={styles.headerSubtitle}>Welcome back, {user?.name}</Text>
                    </View>
                    <DateRangeFilter selectedDate={selectedDate} onDateChange={setSelectedDate} />
                </View>
            </View>

            <View style={styles.dashboardContainer}>
                <Text style={styles.sectionTitle}>Overview</Text>
                <View style={styles.statsGrid}>
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
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Cancelled</Text>
                        <Text style={styles.statValue}>{vendorStats.cancelled}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.recentOrdersContainer}>
                <View style={styles.recentOrdersHeader}>
                    <Text style={styles.sectionTitle}>Orders in {format(selectedDate, 'MMMM')}</Text>
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
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        color: '#000',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
    },
    dashboardContainer: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 15,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statCard: {
        width: (width - 52) / 2, // 20px padding * 2 + 12px gap
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 16,
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: 100,
    },
    statLabel: {
        fontSize: 14,
        color: '#ccc',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
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
        color: '#666',
        fontSize: 14,
    },
    recentOrderCard: {
        backgroundColor: '#f9f9f9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#eee',
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
        color: '#333',
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
        color: '#666',
    },
    recentOrderTotal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
    },
});
