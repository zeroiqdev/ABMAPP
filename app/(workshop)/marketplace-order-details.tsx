import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Order, OrderItem, User } from '@/types';
import { useColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/design'; // Import useColors
import { format } from 'date-fns';

export default function MarketplaceOrderDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const colors = useColors(); // Hook
    const styles = getStyles(colors); // Dynamic styles

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [vendors, setVendors] = useState<Record<string, User>>({});

    useEffect(() => {
        if (!id || (user?.role !== 'admin' && user?.role !== 'super_admin')) {
            router.back();
            return;
        }
        loadOrder();
    }, [id, user]);

    const loadOrder = async () => {
        try {
            const orderData = await firebaseService.getOrder(id);
            setOrder(orderData);

            if (orderData?.products) {
                const uniqueVendorIds = [...new Set(orderData.products.map(p => p.vendorId).filter(Boolean))];
                const vendorData: Record<string, User> = {};
                for (const vId of uniqueVendorIds as string[]) {
                    try {
                        const vProf = await firebaseService.getUser(vId);
                        if (vProf) vendorData[vId] = vProf;
                    } catch (e) {
                        console.warn(`Could not load vendor ${vId}`, e);
                    }
                }
                setVendors(vendorData);
            }
        } catch (error) {
            console.error('Error loading order:', error);
            Alert.alert('Error', 'Failed to load order details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (status: Order['status']) => {
        if (!order) return;
        setProcessing(true);
        try {
            const updates: any = { status };
            if (status === 'delivered') {
                updates.payoutStatus = 'pending';
            }
            await firebaseService.updateOrder(order.id, updates);
            setOrder({ ...order, ...updates });
            Alert.alert('Success', `Order marked as ${status}`);
            if (status !== 'delivered') router.back();
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update order status');
        } finally {
            setProcessing(false);
        }
    };

    const handleProcessPayout = async () => {
        if (!order) return;
        setProcessing(true);
        try {
            await firebaseService.updateOrderPayoutStatus(order.id, 'paid', 'Payout processed manually by admin');
            setOrder({ ...order, payoutStatus: 'paid' });
            Alert.alert('Success', 'Payout marked as paid');
        } catch (error) {
            console.error('Error processing payout:', error);
            Alert.alert('Error', 'Failed to process payout');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return colors.info;
            case 'shipped': return colors.secondary;
            case 'shipment_verified': return '#9C27B0'; // Purple for verified shipment
            case 'delivered': return colors.success;
            case 'cancelled': return colors.error;
            default: return colors.warning;
        }
    };

    const renderActionButtons = () => {
        if (!order) return null;

        if (order.status === 'pending') {
            return (
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleUpdateStatus('cancelled')}
                        disabled={processing}
                    >
                        <Text style={styles.rejectButtonText}>Reject Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleUpdateStatus('confirmed')}
                        disabled={processing}
                    >
                        <Text style={styles.acceptButtonText}>Accept Order</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (order.status === 'confirmed') {
            return (
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.payoutButton]}
                        onPress={() => handleUpdateStatus('delivered')}
                        disabled={processing}
                    >
                        <Text style={styles.payoutButtonText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (order.status === 'shipped') {
            return (
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleUpdateStatus('confirmed')} // Send back to confirmed
                        disabled={processing}
                    >
                        <Text style={styles.rejectButtonText}>Decline Shipment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleUpdateStatus('shipment_verified')}
                        disabled={processing}
                    >
                        <Text style={styles.acceptButtonText}>Accept Shipment</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (order.status === 'shipment_verified') {
            return (
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.payoutButton]}
                        onPress={() => handleUpdateStatus('delivered')}
                        disabled={processing}
                    >
                        <Text style={styles.payoutButtonText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (
            order.status === 'delivered' &&
            (!order.payoutStatus || order.payoutStatus !== 'paid')
        ) {
            return (
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.payoutButton]}
                        onPress={handleProcessPayout}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.payoutButtonText}>Process Payout</Text>
                        )}
                    </TouchableOpacity>
                </View>
            );
        }

        return null;
    };

    const renderOrderItem = ({ item }: { item: OrderItem }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemImageContainer}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                ) : (
                    <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
                )}
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                <Text style={styles.itemPrice}>₦{item.price.toLocaleString()}</Text>
                {item.vendorId && (
                    <Text style={styles.vendorText}>Vendor ID: {item.vendorId}</Text>
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!order) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Review Order</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Status Section */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={styles.sectionTitle}>Status</Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    { backgroundColor: getStatusColor(order.status) + '20' },
                                ]}
                            >
                                <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                                    {order.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                        <View>
                            <Text style={styles.sectionTitle}>Payout</Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor:
                                            order.payoutStatus === 'paid'
                                                ? colors.success + '20'
                                                : colors.warning + '20',
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statusText,
                                        {
                                            color:
                                                order.payoutStatus === 'paid'
                                                    ? colors.success
                                                    : colors.warning,
                                        },
                                    ]}
                                >
                                    {(order.payoutStatus || 'PENDING').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.dateText}>
                        Placed on {format(order.createdAt, 'MMM dd, yyyy HH:mm')}
                    </Text>
                </View>

                {/* Customer Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer Details</Text>
                    <Text style={styles.detailText}>Name: {order.customerName || 'N/A'}</Text>
                    <Text style={styles.detailText}>Email: {order.customerEmail || 'N/A'}</Text>
                    <Text style={styles.detailText}>Phone: {order.customerPhone || 'N/A'}</Text>
                    <Text style={styles.detailText}>
                        Address: {order.shippingAddress || 'N/A'}
                    </Text>
                </View>

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

                {/* Vendor Payout Details */}
                {order.status === 'delivered' && order.payoutStatus !== 'paid' && Object.keys(vendors).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Vendor Payout Details</Text>
                        {Object.values(vendors).map((vendor) => (
                            <View key={vendor.id} style={styles.vendorCard}>
                                <Text style={styles.vendorName}>{vendor.businessDetails?.businessName || vendor.name}</Text>
                                <View style={styles.bankInfo}>
                                    <Text style={styles.bankText}>Bank: {vendor.businessDetails?.bankName || 'N/A'}</Text>
                                    <Text style={styles.bankText}>A/C No: {vendor.businessDetails?.accountNumber || 'N/A'}</Text>
                                    <Text style={styles.bankText}>A/C Name: {vendor.businessDetails?.accountName || 'N/A'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Action Buttons */}
                {renderActionButtons()}
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 10,
        marginLeft: -10,
    },
    headerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: Typography.fontWeight.bold,
        color: colors.textPrimary,
    },
    content: {
        padding: Spacing.lg,
        paddingBottom: 40,
    },
    section: {
        marginBottom: Spacing.xl,
        backgroundColor: colors.surface,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.bold,
        color: colors.textPrimary,
        marginBottom: Spacing.sm,
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
        color: colors.textSecondary,
        marginTop: Spacing.sm,
    },
    detailText: {
        fontSize: Typography.fontSize.base,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: Spacing.md,
        borderRadius: BorderRadius.sm,
    },
    itemImageContainer: {
        width: 50,
        height: 50,
        backgroundColor: colors.background === '#000000' ? '#333' : '#f0f0f0',
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
        color: colors.textPrimary,
    },
    itemQuantity: {
        fontSize: Typography.fontSize.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: Typography.fontSize.sm,
        fontWeight: 'bold',
        color: colors.primary,
        marginTop: 2,
    },
    vendorText: {
        fontSize: 10,
        color: colors.textTertiary,
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
        color: colors.textSecondary,
    },
    totalPrice: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.bold,
        color: colors.primary,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 10,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: colors.primary, // Black in light, White in dark (handled by theme usually but primary is #000/#FFF)
        // Wait, primary is #E21A42 (Red-ish or similar?). No, Colors.primary.
        // Let's check Colors again. primary: '#DAA520' (Gold?) or '#000'.
        // In previous files it was using colors.primary for prices.
    },
    acceptButtonText: {
        color: colors.textInverse, // White/Black
        fontWeight: 'bold',
        fontSize: 16,
    },
    rejectButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: '#e74c3c',
    },
    rejectButtonText: {
        color: '#e74c3c',
        fontWeight: 'bold',
        fontSize: 16,
    },
    payoutButton: {
        backgroundColor: '#27ae60', // Green
    },
    payoutButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    vendorCard: {
        backgroundColor: colors.background,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    vendorName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    bankInfo: {
        gap: 4,
    },
    bankText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});
