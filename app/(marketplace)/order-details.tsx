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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { notificationService } from '@/services/notificationService';
import { Order, User, OrderItem } from '@/types';
import { format } from 'date-fns';
import { Colors } from '@/constants/design';

export default function OrderDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();

    const [order, setOrder] = useState<Order | null>(null);
    const [customer, setCustomer] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);

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
            await firebaseService.updateOrder(order.id, { status: newStatus });

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return Colors.warning;
            case 'confirmed': return Colors.info;
            case 'shipped': return Colors.primary;
            case 'shipment_verified': return '#9C27B0';
            case 'delivered': return Colors.success;
            case 'cancelled': return Colors.error;
            default: return '#666';
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
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
                    <Ionicons name="arrow-back" size={24} color="#000" />
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
                        {(!isVendor || (isVendor && order.status === 'confirmed')) && (
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

                {/* Customer Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Customer Details</Text>
                    <View style={styles.infoCard}>
                        <InfoRow label="Name" value={customer?.name || order.customerName || 'Guest'} />
                        <InfoRow label="Phone" value={customer?.phone || order.customerPhone || 'N/A'} />
                        {order.customerEmail && (
                            <InfoRow label="Email" value={order.customerEmail} />
                        )}
                        {order.shippingAddress && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Shipping Address</Text>
                                <Text style={styles.infoValue}>{order.shippingAddress}</Text>
                            </View>
                        )}
                        <InfoRow label="Delivery Method" value={order.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Store Pickup'} />
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
                        {(isVendor
                            ? (order.status === 'confirmed' ? ['shipped'] : [])
                            : ['pending', 'confirmed', 'shipped', 'shipment_verified', 'delivered', 'cancelled']
                        ).map((status) => (
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
                                    {status === 'shipment_verified' ? 'Shipment Verified' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </Text>
                                {order.status === status && (
                                    <Ionicons name="checkmark" size={20} color="#000" />
                                )}
                            </TouchableOpacity>
                        ))}
                        {isVendor && order.status !== 'confirmed' && (
                            <Text style={{ textAlign: 'center', color: '#666', marginTop: 10 }}>
                                {order.status === 'pending' ? 'Wait for payment confirmation.' : 'No actions available.'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
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
        paddingTop: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    heroSection: {
        padding: 24,
        backgroundColor: '#fff',
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
        backgroundColor: '#f5f5f5',
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
        color: '#333',
        letterSpacing: 0.5,
    },
    updateStatusButton: {
        backgroundColor: '#000',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    updateStatusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#000',
        textAlign: 'center',
        marginBottom: 4,
    },
    heroSubtitle: {
        fontSize: 14,
        color: '#666',
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
        color: '#999',
        marginBottom: 4,
        fontWeight: '500',
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    metricDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#eee',
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        padding: 15,
    },
    itemsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    infoLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: '#000',
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    productImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        marginRight: 12,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
        marginBottom: 4,
    },
    productMeta: {
        fontSize: 12,
        color: '#666',
    },
    productTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#000',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    statusModalContent: {
        backgroundColor: '#fff',
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
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    statusOptionSelected: {
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 10,
        paddingHorizontal: 10,
        borderBottomWidth: 0,
        width: '100%',
    },
    statusOptionText: {
        fontSize: 16,
        marginLeft: 12,
        flex: 1,
        color: '#333',
        fontWeight: '500',
    },
});
