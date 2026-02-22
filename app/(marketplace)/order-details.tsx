import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    Image,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { notificationService } from '@/services/notificationService';
import { Order, User, OrderItem } from '@/types';
import { format } from 'date-fns';
import { useColors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/design';

export default function OrderDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const colors = useColors();
    const styles = getStyles(colors);

    const [order, setOrder] = useState<Order | null>(null);
    const [customer, setCustomer] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [vendors, setVendors] = useState<Record<string, User>>({});

    // Vendor verify
    const isVendor = user?.role === 'vendor';

    useEffect(() => {
        if (id) {
            loadOrderDetails();
        }
    }, [id]);

    const loadOrderDetails = async () => {
        try {
            const orderData = await firebaseService.getOrder(id);
            if (orderData) {
                setOrder(orderData);
                if (orderData.userId) {
                    try {
                        const customerData = await firebaseService.getUser(orderData.userId);
                        if (customerData) setCustomer(customerData);
                    } catch (userError) {
                        console.warn('Could not load customer details (likely permission issue):', userError);
                        // Fallback to basic info if available or just don't set customer
                    }
                }

                if (orderData.products) {
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
            }
        } catch (error) {
            console.error('Error loading order details:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (newStatus: Order['status']) => {
        if (!order) return;

        setUpdating(true);
        try {
            const updates: any = { status: newStatus };
            if (newStatus === 'delivered') {
                updates.payoutStatus = 'pending';
            }
            await firebaseService.updateOrder(order.id, updates);

            // Notify customer
            if (order.userId) {
                await notificationService.sendNotificationToUser(
                    order.userId,
                    'Order Update',
                    `Your order #${order.id.slice(0, 8)} status has been updated to: ${newStatus}`,
                    'order'
                );
            }

            Alert.alert('Success', 'Order status updated successfully');
            await loadOrderDetails();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update order status');
        } finally {
            setUpdating(false);
        }
    };

    const handleMarkAsPaid = async () => {
        if (!order) return;

        Alert.alert(
            'Confirm Payout',
            'Are you sure you want to mark this order as paid to the vendor?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Paid',
                    onPress: async () => {
                        setUpdating(true);
                        try {
                            await firebaseService.updateOrderPayoutStatus(order.id, 'paid');
                            Alert.alert('Success', 'Order marked as paid');
                            await loadOrderDetails();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to update payout status');
                        } finally {
                            setUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return colors.warning;
            case 'confirmed': return colors.info;
            case 'processing': return colors.info;
            case 'shipment_verified': return colors.info;
            case 'delivered': return colors.success;
            case 'cancelled': return colors.error;
            default: return colors.textSecondary;
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Order Details</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Order not found</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => isVendor ? router.push('/(marketplace)/orders') : router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroHeader}>
                        <View style={styles.statusPill}>
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                            <Text style={styles.statusPillText}>{order.status.toUpperCase()}</Text>
                        </View>
                        {(user?.role === 'admin' || user?.role === 'super_admin' || (isVendor && !['delivered', 'cancelled'].includes(order.status))) && (
                            <TouchableOpacity
                                style={styles.updateStatusButton}
                                onPress={() => setShowStatusModal(true)}
                            >
                                <Text style={styles.updateStatusText}>Update Status</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.heroTitle}>
                        Order #{order.id.slice(0, 8)}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                        Created on {format(order.createdAt, 'MMM dd, yyyy HH:mm')}
                    </Text>

                    <View style={styles.metricsRow}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricLabel}>Total</Text>
                            <Text style={styles.metricValue}>₦{order.total.toLocaleString()}</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                            <Text style={styles.metricLabel}>Items</Text>
                            <Text style={styles.metricValue}>{order.products.length}</Text>
                        </View>
                    </View>
                </View>

                {/* Payout Status Banner for Admin/Vendor */}
                {(user?.role === 'admin' || user?.role === 'super_admin' || isVendor) && order.payoutStatus && (
                    <View style={[styles.payoutStatusBanner, { backgroundColor: order.payoutStatus === 'paid' ? colors.success + '20' : colors.warning + '20' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons
                                    name={order.payoutStatus === 'paid' ? 'checkmark-circle' : 'time-outline'}
                                    size={20}
                                    color={order.payoutStatus === 'paid' ? colors.success : colors.warning}
                                />
                                <View>
                                    <Text style={[styles.payoutStatusText, { color: order.payoutStatus === 'paid' ? colors.success : colors.warning }]}>
                                        Payout Status: {order.payoutStatus.toUpperCase()}
                                    </Text>
                                    {order.payoutStatus !== 'paid' && (
                                        <Text style={{ fontSize: 12, color: colors.warning }}>Ready for vendor settlement</Text>
                                    )}
                                </View>
                            </View>
                            {(user?.role === 'admin' || user?.role === 'super_admin') && order.status === 'delivered' && order.payoutStatus !== 'paid' && (
                                <TouchableOpacity
                                    style={styles.payoutButton}
                                    onPress={handleMarkAsPaid}
                                    disabled={updating}
                                >
                                    <Text style={styles.payoutButtonText}>Mark Paid</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Vendor Bank Details (Only for Admins during Payout) */}
                {(user?.role === 'admin' || user?.role === 'super_admin') && order.status === 'delivered' && order.payoutStatus !== 'paid' && Object.keys(vendors).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Vendor Bank Details</Text>
                        {Object.values(vendors).map((vendor) => (
                            <View key={vendor.id} style={styles.vendorPayoutCard}>
                                <Text style={styles.vendorPayoutName}>{vendor.businessDetails?.businessName || vendor.name}</Text>
                                <View style={styles.vendorPayoutBankInfo}>
                                    <Text style={styles.vendorPayoutBankText}>Bank: {vendor.businessDetails?.bankName || 'N/A'}</Text>
                                    <Text style={styles.vendorPayoutBankText}>A/C No: {vendor.businessDetails?.accountNumber || 'N/A'}</Text>
                                    <Text style={styles.vendorPayoutBankText}>A/C Name: {vendor.businessDetails?.accountName || 'N/A'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Customer Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer Details</Text>
                    <View style={styles.infoCard}>
                        <InfoRow label="Name" value={customer?.name || order.customerName || 'Guest'} colors={colors} styles={styles} />
                        <InfoRow label="Phone" value={customer?.phone || order.customerPhone || 'N/A'} colors={colors} styles={styles} />
                        {order.customerEmail && (
                            <InfoRow label="Email" value={order.customerEmail} colors={colors} styles={styles} />
                        )}
                        {order.shippingAddress && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Shipping Address</Text>
                                <Text style={styles.infoValue}>{order.shippingAddress}</Text>
                            </View>
                        )}
                        <InfoRow label="Delivery Method" value={order.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Store Pickup'} colors={colors} styles={styles} />
                    </View>
                </View>

                {/* Order Items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Items</Text>
                    <View style={styles.itemsCard}>
                        {order.products.map((item, index) => (
                            <View key={index} style={styles.productItem}>
                                {item.image && (
                                    <Image source={{ uri: item.image }} style={styles.productImage} />
                                )}
                                <View style={styles.productInfo}>
                                    <Text style={styles.productName}>{item.productName}</Text>
                                    <Text style={styles.productMeta}>
                                        {item.quantity} x ₦{item.price.toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={styles.productTotal}>
                                    ₦{(item.quantity * item.price).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

            </ScrollView>

            {/* Status Modal */}
            <Modal visible={showStatusModal} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowStatusModal(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                        style={styles.statusModalContent}
                    >
                        <Text style={styles.modalTitle}>Update Order Status</Text>
                        {(() => {
                            // Determine which statuses to show based on role
                            const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
                            let availableStatuses: string[] = [];

                            if (isVendor) {
                                // Vendors can mark as shipped or delivered
                                if (!['delivered', 'cancelled'].includes(order.status)) {
                                    availableStatuses = ['shipped', 'delivered'].filter(s => s !== order.status);
                                }
                            } else if (isAdmin) {
                                // Admins can mark as processing, delivered, or cancelled
                                availableStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].filter(s => s !== order.status);
                            } else {
                                // Staff or other roles - show all statuses
                                availableStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].filter(s => s !== order.status);
                            }

                            return availableStatuses.map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[
                                        styles.statusOption,
                                        order.status === status && styles.statusOptionSelected,
                                    ]}
                                    onPress={() => {
                                        updateOrderStatus(status as any);
                                        setShowStatusModal(false);
                                    }}
                                >
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                                    <Text style={styles.statusOptionText}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </Text>
                                    {order.status === status && (
                                        <Ionicons name="checkmark" size={20} color={colors.textPrimary} />
                                    )}
                                </TouchableOpacity>
                            ));
                        })()}
                        {isVendor && ['delivered', 'cancelled', 'shipped'].includes(order.status) && (
                            <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 10 }}>
                                {order.status === 'shipped' ? 'Waiting for admin to verify shipment.' : 'No actions available.'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function InfoRow({ label, value, colors, styles }: { label: string; value: string; colors: any; styles: any }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing['5xl'],
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
        backgroundColor: colors.surface,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: colors.textPrimary,
    },
    heroSection: {
        padding: 24,
        backgroundColor: colors.surface,
        marginBottom: 10,
        alignItems: 'center',
    },
    heroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        width: '100%',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textPrimary,
        letterSpacing: 0.5,
    },
    updateStatusButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    updateStatusText: {
        color: colors.textInverse,
        fontSize: 12,
        fontWeight: '600',
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 4,
    },
    heroSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 30,
        textAlign: 'center',
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
        marginTop: 10,
    },
    metricItem: {
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    metricLabel: {
        fontSize: 12,
        color: colors.textTertiary,
        marginBottom: 4,
        fontWeight: '500',
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    metricDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 15,
    },
    itemsCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    productImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: colors.background,
        marginRight: 12,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    productMeta: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    productTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: colors.textTertiary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    statusModalContent: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: colors.textPrimary,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    statusOptionSelected: {
        borderWidth: 1,
        borderColor: colors.textPrimary,
        borderRadius: 10,
        paddingHorizontal: 10,
        borderBottomWidth: 0,
        width: '100%',
    },
    statusOptionText: {
        fontSize: 16,
        marginLeft: 12,
        flex: 1,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    payoutStatusBanner: {
        margin: 20,
        marginBottom: 10,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    payoutStatusText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    payoutButton: {
        backgroundColor: colors.success,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    payoutButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    vendorPayoutCard: {
        backgroundColor: colors.background,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    vendorPayoutName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    vendorPayoutBankInfo: {
        gap: 4,
    },
    vendorPayoutBankText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});
