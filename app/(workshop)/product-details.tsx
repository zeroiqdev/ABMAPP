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
    const { id, from } = useLocalSearchParams<{ id: string, from?: string }>();
    const colors = useColors();
    const styles = getStyles(colors);

    const addItem = useCartStore((state) => state.addItem);
    const [product, setProduct] = useState<MarketplaceProduct | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showToast, setShowToast] = useState(false);
    const toastOpacity = useState(new Animated.Value(0))[0];

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

    const handleBack = () => {
        if (from === 'marketplace') {
            // Force navigation back to marketplace tab if we came from there
            // This ensures we don't drop to home if the stack is confused
            router.navigate('/(workshop)/marketplace');
        } else {
            router.back();
        }
    };



    if (!product) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack}>
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
                <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Product Details</Text>
                <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(workshop)/cart')}>
                    <Ionicons name="bag-outline" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
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
                    {/* Title & Stats */}
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
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
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
        backgroundColor: 'transparent',
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
        backgroundColor: colors.surface,
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
        backgroundColor: colors.surface,
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
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    paginationDotActive: {
        backgroundColor: '#fff',
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
        backgroundColor: colors.background,
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
        backgroundColor: colors.textPrimary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 30,
        gap: 8,
    },
    disabledButton: {
        backgroundColor: colors.textSecondary,
    },
    addToCartText: {
        color: colors.background,
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
        color: colors.textSecondary,
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
        color: colors.background,
        fontSize: 14,
        fontWeight: '600',
    },
});
