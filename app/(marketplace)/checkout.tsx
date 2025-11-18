import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { paymentService } from '@/services/paymentService';
import { Order } from '@/types';

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [shippingAddress, setShippingAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [processing, setProcessing] = useState(false);

  // In a real app, these would come from cart state
  const cartItems: any[] = [];
  const subtotal = 0;
  const shipping = deliveryMethod === 'delivery' ? 1000 : 0;
  const total = subtotal + shipping;

  const handleCheckout = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login to continue');
      return;
    }

    if (deliveryMethod === 'delivery' && !shippingAddress.trim()) {
      Alert.alert('Error', 'Please provide a shipping address');
      return;
    }

    setProcessing(true);
    try {
      const order: Omit<Order, 'id' | 'createdAt'> = {
        userId: user.id,
        products: cartItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total,
        status: 'pending',
        deliveryMethod,
        shippingAddress: deliveryMethod === 'delivery' ? shippingAddress : undefined,
      };

      const orderId = await firebaseService.createOrder(order);

      // Initialize payment
      const reference = paymentService.generatePaymentReference();
      const paymentData = {
        amount: total,
        email: user.email,
        reference,
        metadata: {
          orderId,
          userId: user.id,
        },
      };

      const result = await paymentService.initializePaystackPayment(paymentData);

      if (result.success) {
        Alert.alert(
          'Order Placed',
          'Your order has been placed. Please complete the payment.',
          [
            {
              text: 'OK',
              onPress: () => {
                // In a real app, you'd open payment web view or navigate to payment screen
                router.replace('/(marketplace)/orders');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Delivery Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Method</Text>
          <TouchableOpacity
            style={[
              styles.deliveryOption,
              deliveryMethod === 'delivery' && styles.deliveryOptionActive,
            ]}
            onPress={() => setDeliveryMethod('delivery')}
          >
            <Ionicons
              name={deliveryMethod === 'delivery' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={deliveryMethod === 'delivery' ? '#007AFF' : '#ccc'}
            />
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryLabel}>Home Delivery</Text>
              <Text style={styles.deliveryDesc}>
                Delivered to your address (₦1,000)
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.deliveryOption,
              deliveryMethod === 'pickup' && styles.deliveryOptionActive,
            ]}
            onPress={() => setDeliveryMethod('pickup')}
          >
            <Ionicons
              name={deliveryMethod === 'pickup' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={deliveryMethod === 'pickup' ? '#007AFF' : '#ccc'}
            />
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryLabel}>Store Pickup</Text>
              <Text style={styles.deliveryDesc}>Pick up from our store (Free)</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Shipping Address */}
        {deliveryMethod === 'delivery' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full address"
              value={shippingAddress}
              onChangeText={setShippingAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₦{subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>
                {shipping === 0 ? 'Free' : `₦${shipping.toLocaleString()}`}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.checkoutButton, processing && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={20} color="#fff" />
              <Text style={styles.checkoutButtonText}>
                Pay ₦{total.toLocaleString()}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 24,
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
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#eee',
  },
  deliveryOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  deliveryInfo: {
    marginLeft: 12,
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deliveryDesc: {
    fontSize: 12,
    color: '#666',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 50,
  },
  summaryCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
    paddingTop: 15,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

