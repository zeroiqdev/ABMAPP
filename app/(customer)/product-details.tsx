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
    Animated,
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
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
    const addItem = useCartStore((state) => state.addItem);
    const [product, setProduct] = useState<MarketplaceProduct | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showToast, setShowToast] = useState(false);
    const toastOpacity = useState(new Animated.Value(0))[0];
    const colors = useColors();

    const handleBack = () => {
        if (from === 'marketplace') {
            router.navigate('/(customer)/marketplace');
        } else {
            router.back();
        }
    };

    useEffect(() => {
        loadProduct();
    }, [id]);

    const loadProduct = async () => {
        try {
            const products = await firebaseService.getMarketplaceProducts();
            const productData = products.find((p) => p.id === id);
            if (productData) {
                setProduct(productData);
            }
        } catch (error) {
            console.error('Error loading product:', error);
        } finally {
            setLoading(false);
        }
    };

    const showToastNotification = () => {
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

        // Add to cart store
        addItem(product, quantity);

        // Show toast notification
        showToastNotification();
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!product) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Product not found</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.background }]} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Product Details</Text>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.background }]} onPress={() => router.push('/(customer)/cart')}>
                    <Ionicons name="bag-outline" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>
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
                                <Ionicons name="image-outline" size={64} color="#ccc" />
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
                    {/* Title & Stats */}
                    <View style={styles.titleRow}>
                        <Text style={styles.productName}>{product.name}</Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={12} color="#000" />
                            <Text style={styles.ratingText}>{product.rating || 'New'}</Text>
                        </View>
                        <Text style={styles.soldCount}>{product.soldCount || 0} sold</Text>
                        {product.condition && (
                            <Text style={styles.conditionText}>{product.condition === 'new' ? 'New' : 'Used'}</Text>
                        )}
                    </View>

                    <View style={styles.divider} />

                    {/* Description */}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{product.description}</Text>

                    {/* Compatibility */}
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

                    {/* Quantity */}
                    <View style={styles.quantitySection}>
                        <Text style={styles.sectionTitle}>Quantity</Text>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity
                                style={styles.quantityBtn}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                            >
                                <Ionicons name="remove" size={20} color="#000" />
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{quantity}</Text>
                            <TouchableOpacity
                                style={styles.quantityBtn}
                                onPress={() => setQuantity(Math.min(product.stock, quantity + 1))}
                            >
                                <Ionicons name="add" size={20} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.priceContainer}>
                    <Text style={styles.totalLabel}>Total Price</Text>
                    <Text style={styles.totalPrice}>₦{(product.price * quantity).toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addToCartButton, product.stock === 0 && styles.disabledButton]}
                    onPress={handleAddToCart}
                    disabled={product.stock === 0}
                >
                    <Ionicons name="bag-outline" size={20} color="#fff" />
                    <Text style={styles.addToCartText}>Add to Cart</Text>
                </TouchableOpacity>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: '#fff',
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: '#f9f9f9',
    },
    carouselContainer: {
        height: width, // Square images
        marginBottom: 20,
        position: 'relative',
    },
    carouselImage: {
        width: width,
        height: width,
        resizeMode: 'cover',
        backgroundColor: '#f5f5f5',
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
        backgroundColor: '#000',
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
        color: '#000',
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
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    soldCount: {
        color: '#666',
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        fontSize: 12,
    },
    conditionText: {
        color: '#666',
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        fontSize: 12,
        textTransform: 'capitalize',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#000',
    },
    description: {
        fontSize: 15,
        color: '#666',
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
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
    },
    compatibilityText: {
        fontSize: 14,
        color: '#333',
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
        backgroundColor: '#f5f5f5',
        borderRadius: 25,
        gap: 15,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    quantityBtn: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 15,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    quantityValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 90,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 20,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    priceContainer: {
        flex: 1,
    },
    totalLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 4,
    },
    totalPrice: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    addToCartButton: {
        flex: 2,
        backgroundColor: '#000',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 30,
        gap: 8,
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    addToCartText: {
        color: '#fff',
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
        color: '#999',
    },
    toast: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        backgroundColor: '#000',
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
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
