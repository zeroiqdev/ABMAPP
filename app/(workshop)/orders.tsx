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
import { useColors, Typography, Spacing } from '@/constants/design';
import { format } from 'date-fns';

const TABS = ['All Orders', 'Processing', 'Shipped', 'Delivered'];

export default function WorkshopOrdersScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [orders, setOrders] = useState<Order[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All Orders');
    const colors = useColors();
    const styles = getStyles(colors);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = firebaseService.subscribeToOrders(user.id, (newOrders) => {
            setOrders(newOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.id]);

    const onRefresh = async () => {
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    const getFilteredOrders = () => {
        switch (activeTab) {
            case 'Processing': return orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
            case 'Shipped': return orders.filter(o => o.status === 'shipped');
            case 'Delivered': return orders.filter(o => o.status === 'delivered');
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
                onPress={() => router.push(`/(workshop)/order-details?id=${item.id}`)}
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
                    <TouchableOpacity style={styles.viewButton} onPress={() => router.push(`/(workshop)/order-details?id=${item.id}`)}>
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
                <TouchableOpacity onPress={() => router.replace('/(workshop)/marketplace')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Orders</Text>
                <View style={{ width: 34 }} />
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="bag-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No orders yet</Text>
                        <Text style={styles.emptySubtext}>Your orders will appear here</Text>
                    </View>
                }
            />
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing['5xl'],
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: 'bold', color: colors.textPrimary },
    listContent: { padding: 20 },
    orderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface // Using surface for card background
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

    // Updated Button Style for Dark Mode
    viewButton: {
        backgroundColor: colors.primary, // White in Dark Mode
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20
    },
    viewButtonText: {
        color: colors.textInverse, // Black in Dark Mode
        fontWeight: '600',
        fontSize: 12
    },

    tabsContainer: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabsContent: { paddingHorizontal: 15 },
    tabItem: { paddingVertical: 15, paddingHorizontal: 15, marginRight: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabItemActive: { borderBottomColor: colors.textPrimary },
    tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: colors.textPrimary, fontWeight: '600' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing['3xl'] },
    emptyText: { fontSize: Typography.fontSize.base, fontWeight: '600', color: colors.textTertiary, marginTop: Spacing.base },
    emptySubtext: { fontSize: Typography.fontSize.sm, color: colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
});
