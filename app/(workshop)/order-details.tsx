import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Order, OrderItem } from '@/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/design';
import { format } from 'date-fns';

export default function WorkshopOrderDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !id) return;
        loadOrder();
    }, [user, id]);

    const loadOrder = async () => {
        try {
            const orderData = await firebaseService.getOrder(id);
            setOrder(orderData);
        } catch (error) {
            console.error('Error loading order:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: Order['status']) => {
        switch (status) {
            case 'confirmed': return Colors.success;
            case 'shipped': return Colors.info;
            case 'delivered': return Colors.success;
            case 'cancelled': return Colors.error;
            default: return Colors.warning;
        }
    };

    const renderOrderItem = ({ item }: { item: OrderItem }) => (
        <TouchableOpacity
            style={styles.itemCard}
            onPress={() => router.push(`/(workshop)/product-details?id=${item.productId}`)}
        >
            <View style={styles.itemImageContainer}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                ) : (
                    <Ionicons name="image-outline" size={24} color={Colors.textTertiary} />
                )}
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                <Text style={styles.itemPrice}>₦{item.price.toLocaleString()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Order Details</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.emptyState}>
                    <Text>Order not found</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order #{order.id.slice(0, 8)}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Status Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Status</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Text>
                    </View>
                    <Text style={styles.dateText}>Placed on {format(order.createdAt, 'MMM dd, yyyy HH:mm')}</Text>
                </View>

                {/* Shipping Section */}
                {order.shippingAddress && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Shipping Address</Text>
                        <Text style={styles.addressText}>{order.shippingAddress}</Text>
                    </View>
                )}

                {/* Items Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    {order.products.map((item, index) => (
                        <View key={index} style={{ marginBottom: 10 }}>
                            {renderOrderItem({ item })}
                        </View>
                    ))}
                </View>

                {/* Summary Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Summary</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total</Text>
                        <Text style={styles.totalPrice}>₦{order.total.toLocaleString()}</Text>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing['5xl'],
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        padding: 10,
        marginLeft: -10,
    },
    headerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: Typography.fontWeight.bold,
        color: Colors.textPrimary,
    },
    content: {
        padding: Spacing.lg,
    },
    section: {
        marginBottom: Spacing.xl,
        backgroundColor: Colors.surface,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.sm,
    },
    statusText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semibold,
    },
    dateText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },
    addressText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        lineHeight: 24,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: Spacing.md,
        borderRadius: BorderRadius.sm,
    },
    itemImageContainer: {
        width: 50,
        height: 50,
        backgroundColor: '#f0f0f0',
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        overflow: 'hidden',
    },
    itemImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.semibold,
        color: Colors.textPrimary,
    },
    itemQuantity: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: Typography.fontSize.sm,
        fontWeight: 'bold',
        color: Colors.primary,
        marginTop: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    summaryLabel: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
    },
    totalPrice: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.bold,
        color: Colors.primary,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
