import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { MarketplaceProduct } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useColors } from '@/constants/design';

const { width } = Dimensions.get('window');

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const colors = useColors();
  const styles = getStyles(colors);
  const addItem = useCartStore((state) => state.addItem);
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useState(new Animated.Value(0))[0];

  // Edit mode state
  const [isOwner, setIsOwner] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const products = await firebaseService.getMarketplaceProducts();
      const productData = products.find((p) => p.id === id);
      if (productData) {
        setProduct(productData);
        // Check if current user is the vendor owner
        const ownerCheck = user?.id === productData.vendorId || user?.id === productData.userId;
        setIsOwner(ownerCheck);
        // Initialize edit fields
        setEditName(productData.name);
        setEditDescription(productData.description);
        setEditPrice(productData.price.toString());
        setEditStock(productData.stock.toString());
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToastNotification = (message: string = 'Added to cart') => {
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowToast(false);
    });
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (product.stock < quantity) {
      Alert.alert('Error', 'Insufficient stock available');
      return;
    }

    addItem(product, quantity);
    showToastNotification('Added to cart');
  };

  const handleSaveProduct = async () => {
    if (!product || !id) return;

    const newPrice = parseFloat(editPrice);
    const newStock = parseInt(editStock);

    if (!editName.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }
    if (isNaN(newPrice) || newPrice <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    if (isNaN(newStock) || newStock < 0) {
      Alert.alert('Error', 'Please enter a valid stock quantity');
      return;
    }

    setSaving(true);
    try {
      await firebaseService.updateMarketplaceProduct(id, {
        name: editName.trim(),
        description: editDescription.trim(),
        price: newPrice,
        stock: newStock,
      });

      // Update local state
      setProduct({
        ...product,
        name: editName.trim(),
        description: editDescription.trim(),
        price: newPrice,
        stock: newStock,
      });

      Alert.alert('Success', 'Product updated successfully');
    } catch (error: any) {
      console.error('Error updating product:', error);
      Alert.alert('Error', error.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Product not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isOwner ? 'Edit Product' : 'Product Details'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Image Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const contentOffsetX = e.nativeEvent.contentOffset.x;
              const index = Math.round(contentOffsetX / width);
              setCurrentImageIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {product.images && product.images.length > 0 ? (
              product.images.map((imageUri, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUri }}
                  style={styles.carouselImage}
                />
              ))
            ) : (
              <View style={[styles.carouselImage, styles.placeholderImage]}>
                <Ionicons name="image-outline" size={64} color={colors.textTertiary} />
              </View>
            )}
          </ScrollView>

          {/* Pagination Dots */}
          {product.images && product.images.length > 1 && (
            <View style={styles.pagination}>
              {product.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    currentImageIndex === index && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          {isOwner ? (
            // Owner Edit Mode
            <>
              <Text style={styles.sectionTitle}>Product Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Product name"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.sectionTitle}>Price (₦)</Text>
              <TextInput
                style={styles.editInput}
                value={editPrice}
                onChangeText={setEditPrice}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.sectionTitle}>Stock Quantity</Text>
              <View style={styles.stockControl}>
                <TouchableOpacity
                  style={styles.stockBtn}
                  onPress={() => setEditStock(Math.max(0, parseInt(editStock) - 1).toString())}
                >
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.stockInput}
                  value={editStock}
                  onChangeText={setEditStock}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity
                  style={styles.stockBtn}
                  onPress={() => setEditStock((parseInt(editStock) + 1).toString())}
                >
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={[styles.editInput, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Product description"
                multiline
                numberOfLines={4}
                placeholderTextColor={colors.textTertiary}
              />
            </>
          ) : (
            // Customer View Mode
            <>
              <View style={styles.titleRow}>
                <Text style={styles.productName}>{product.name}</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color={colors.textPrimary} />
                  <Text style={styles.ratingText}>{product.rating || 'New'}</Text>
                </View>
                <Text style={styles.soldCount}>{product.soldCount || 0} sold</Text>
                {product.condition && (
                  <Text style={styles.conditionText}>{product.condition === 'new' ? 'New' : 'Used'}</Text>
                )}
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>

              {product.compatibility && product.compatibility.length > 0 && (
                <View style={styles.compatibilitySection}>
                  <Text style={styles.sectionTitle}>Compatibility</Text>
                  <View style={styles.compatibilityList}>
                    {product.compatibility.map((item, index) => (
                      <View key={index} style={styles.compatibilityChip}>
                        <Text style={styles.compatibilityText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.quantitySection}>
                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={styles.quantityBtn}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Ionicons name="remove" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityBtn}
                    onPress={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  >
                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {isOwner ? (
          // Owner Save Button
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSaveProduct}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.addToCartText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          // Customer Add to Cart
          <>
            <View style={styles.priceContainer}>
              <Text style={styles.totalLabel}>Total Price</Text>
              <Text style={styles.totalPrice} numberOfLines={1} adjustsFontSizeToFit>
                ₦{(product.price * quantity).toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addToCartButton, product.stock === 0 && styles.disabledButton]}
              onPress={handleAddToCart}
              disabled={product.stock === 0}
            >
              <Ionicons name="bag-outline" size={20} color="#fff" />
              <Text style={styles.addToCartText}>Add to Cart</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Toast Notification */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [
                {
                  translateY: toastOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.toastText}>Added to cart</Text>
        </Animated.View>
      )}
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
    color: colors.textPrimary,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  carouselContainer: {
    height: width, // Square images
    marginBottom: 20,
    position: 'relative',
    backgroundColor: colors.surface,
  },
  carouselImage: {
    width: width,
    height: width,
    resizeMode: 'cover',
    backgroundColor: colors.background,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  paginationDotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  content: {
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 20,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: colors.textPrimary,
  },
  soldCount: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
  },
  conditionText: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.textPrimary,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  compatibilitySection: {
    marginBottom: 20,
  },
  compatibilityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compatibilityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compatibilityText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    gap: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quantityBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  priceContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  addToCartButton: {
    flex: 2,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: colors.textTertiary,
  },
  addToCartText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
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
  toast: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 10,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  editInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 15,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  stockControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  stockInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
});
