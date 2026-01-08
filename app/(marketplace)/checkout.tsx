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
import { useCartStore } from '@/store/cartStore';
import { firebaseService } from '@/services/firebaseService';
import { paymentService } from '@/services/paymentService';
import { Order } from '@/types';
import { Colors } from '@/constants/design';

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, isGuest, guestEmail, setGuestEmail } = useAuthStore();
  const { items: cartItems, getTotal, clearCart } = useCartStore();
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'monnify'>('card');
  const [shippingAddress, setShippingAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [guestEmailInput, setGuestEmailInput] = useState(guestEmail || ''); // Initialize with stored guest email
  const [processing, setProcessing] = useState(false);
  const [monnifyDetails, setMonnifyDetails] = useState<any>(null);

  const subtotal = getTotal();
  const shipping = deliveryMethod === 'delivery' ? 1000 : 0;
  const total = subtotal + shipping;

  const handleCheckout = async () => {
    // Determine effective user info
    const effectiveEmail = user?.email || guestEmailInput;
    const effectiveName = user?.name || (isGuest ? 'Guest' : '');

    if (!user && !isGuest) {
      // Should not happen with new flow, but fallback
      Alert.alert('Error', 'Please login to continue');
      return;
    }

    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      Alert.alert('Error', 'Please provide a valid email address');
      return;
    }

    if (deliveryMethod === 'delivery' && !shippingAddress.trim()) {
      Alert.alert('Error', 'Please provide a shipping address');
      return;
    }

    // Save guest email if valid and we are in guest mode
    if (isGuest && effectiveEmail) {
      setGuestEmail(effectiveEmail);
    }

    setProcessing(true);
    try {
      const order: Omit<Order, 'id' | 'createdAt'> = {
        userId: user?.id || 'guest',
        products: cartItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          image: item.product.images?.[0],
          vendorId: item.product.vendorId || item.product.userId,
        })),
        total,
        status: 'pending',
        deliveryMethod,
        ...(deliveryMethod === 'delivery' && { shippingAddress }),
        customerName: effectiveName,
        customerPhone: phone || user?.phone,
        customerEmail: effectiveEmail,
        vendorIds: Array.from(new Set(cartItems.map(item => item.product.vendorId || item.product.userId).filter((id): id is string => !!id))),
      };

      const orderId = await firebaseService.createOrder(order);

      // Notify vendors
      const uniqueVendorIds = Array.from(new Set(cartItems.map(item => item.product.vendorId || item.product.userId).filter(Boolean))) as string[];
      for (const vendorId of uniqueVendorIds) {
        await firebaseService.createNotification({
          userId: vendorId,
          title: 'New Order Received',
          body: `You have received a new order from ${effectiveName || 'a customer'}.`,
          type: 'order',
          read: false,
          metadata: {
            type: 'order',
            orderId,
            customerName: effectiveName,
          }
        });
      }

      if (paymentMethod === 'monnify') {
        // Initialize Monnify Payment
        const result = await paymentService.initializeMonnifyPayment(orderId, total, { name: effectiveName, email: effectiveEmail });
        if (result.success && result.accountDetails) {
          setMonnifyDetails(result.accountDetails);
          clearCart();
          // Don't navigate away, show payment details
        } else {
          Alert.alert('Error', result.message);
        }
      } else {
        // Card Payment (Existing Mock)
        const reference = paymentService.generatePaymentReference();
        const paymentData = {
          amount: total,
          email: effectiveEmail,
          reference,
          metadata: {
            orderId,
            userId: user?.id || 'guest',
          },
        };

        const result = await paymentService.initializeMockPayment(paymentData);

        if (result.success) {
          clearCart();
          Alert.alert(
            'Order Placed',
            'Your order has been placed. Please complete the payment.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (user?.role === 'customer') {
                    router.replace('/(customer)/home');
                  } else if (user?.role === 'vendor') {
                    router.replace('/(marketplace)/orders');
                  } else if (isGuest) {
                    // Stay in marketplace or go to orders?
                    // If guest, maybe just clear stack or go home
                    router.replace('/(marketplace)/orders'); // They can view their orders now!
                  } else {
                    router.replace('/(workshop)/marketplace');
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert('Error', result.message);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleFinishMonnify = () => {
    if (user?.role === 'customer') {
      router.replace('/(customer)/home');
    } else if (isGuest) {
      router.replace('/(marketplace)/orders');
    } else {
      // For now just go back or to orders
      router.back();
    }
  };


  if (monnifyDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pay with Bank Transfer</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
            Please transfer exactly <Text style={{ fontWeight: 'bold' }}>₦{total.toLocaleString()}</Text> to the account below.
          </Text>

          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: '#666', marginBottom: 4 }}>Bank Name</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>{monnifyDetails.bankName}</Text>

            <Text style={{ color: '#666', marginBottom: 4 }}>Account Number</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#000' }}>{monnifyDetails.accountNumber}</Text>

            <Text style={{ color: '#666', marginBottom: 4 }}>Account Name</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 0 }}>{monnifyDetails.accountName}</Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
            <Text style={styles.infoText}>
              Your order will be automatically confirmed once we receive the payment. This usually takes a few minutes.
            </Text>
          </View>

          <TouchableOpacity style={[styles.checkoutButton, { marginTop: 30, width: '100%' }]} onPress={handleFinishMonnify}>
            <Text style={styles.checkoutButtonText}>I've Sent the Money</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (user?.role === 'vendor') {
            router.replace('/(marketplace)/cart');
          } else if (user?.role && user.role !== 'customer') {
            router.replace('/(workshop)/cart');
          } else {
            router.back();
          }
        }}>
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
              color={deliveryMethod === 'delivery' ? '#000' : '#ccc'}
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
              color={deliveryMethod === 'pickup' ? '#000' : '#ccc'}
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

          {!user && (
            <View style={{ marginBottom: 15 }}>
              <Text style={[styles.deliveryLabel, { marginBottom: 5 }]}>Email Address (Required for Order Tracking)</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={user?.email || guestEmailInput} // Using local state guestEmailInput
                onChangeText={setGuestEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!user}
              />
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>


        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.deliveryOption,
              paymentMethod === 'card' && styles.deliveryOptionActive,
            ]}
            onPress={() => setPaymentMethod('card')}
          >
            <Ionicons
              name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={paymentMethod === 'card' ? '#000' : '#ccc'}
            />
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryLabel}>Card Payment</Text>
              <Text style={styles.deliveryDesc}>Pay securely with your debit/credit card</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.deliveryOption,
              paymentMethod === 'monnify' && styles.deliveryOptionActive,
            ]}
            onPress={() => setPaymentMethod('monnify')}
          >
            <Ionicons
              name={paymentMethod === 'monnify' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={paymentMethod === 'monnify' ? '#000' : '#ccc'}
            />
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryLabel}>Bank Transfer</Text>
              <Text style={styles.deliveryDesc}>Transfer to a generated virtual account</Text>
            </View>
          </TouchableOpacity>
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
    </View >
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
    borderColor: '#000',
    backgroundColor: 'rgba(0,0,0,0.05)',
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
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    color: '#000',
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
    backgroundColor: '#000',
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#0d47a1',
    lineHeight: 20,
  },
});

