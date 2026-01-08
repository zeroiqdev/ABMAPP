import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Image,
    Switch,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Dimensions,
    Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { useAuthStore } from '@/store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { validateImageWithAlert, formatFileSize } from '@/utils/imageValidation';
import { MarketplaceProduct } from '@/types';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/design';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 2;

const CATEGORIES = [
    'Engine',
    'Electrical',
    'Suspension',
    'Brakes',
    'Body Parts',
    'Interior',
    'Wheels & Tires',
    'Accessories',
    'Tools',
    'Fluids & Chemicals',
];

export default function VendorUploadScreen() {
    const router = useRouter();
    const { user } = useAuthStore();

    const [view, setView] = useState<'list' | 'form'>('list');
    const [products, setProducts] = useState<MarketplaceProduct[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(true);

    // Form State
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [stock, setStock] = useState('1');
    const [compatibility, setCompatibility] = useState('');
    const [condition, setCondition] = useState<'new' | 'used'>('new');
    const [images, setImages] = useState<{ uri: string }[]>([]);

    const loadProducts = async () => {
        if (!user || user.role !== 'vendor') return;
        try {
            const data = await firebaseService.getVendorProducts(user.id);
            setProducts(data);
        } catch (error) {
            console.error('Error loading vendor products:', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (view === 'list') {
                loadProducts();
            }
        }, [view, user?.id])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProducts();
        setRefreshing(false);
    };

    const pickImage = useCallback(async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
            });

            if (!result.canceled && result.assets[0]?.uri) {
                const imageUri = result.assets[0].uri;
                const isValid = await validateImageWithAlert(imageUri);
                if (isValid) {
                    setImages((prev) => [...prev, { uri: imageUri }]);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    }, []);

    const removeImage = useCallback((index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!user || user.role !== 'vendor') {
            Alert.alert('Error', 'Vendor access required');
            return;
        }

        if (!name || !price || !description || images.length === 0) {
            Alert.alert('Error', 'Please fill in all required fields and add at least one image');
            return;
        }

        setLoading(true);
        try {
            const uploadedImageUrls = await Promise.all(
                images.map(async (img) => {
                    return await firebaseService.uploadMarketplaceImage(img.uri, user.id);
                })
            );

            await firebaseService.createMarketplaceProduct({
                vendorId: user.id,
                userId: user.id,
                name,
                description,
                category,
                price: parseFloat(price),
                stock: parseInt(stock) || 1,
                compatibility: compatibility.split(',').map(s => s.trim()).filter(s => s),
                images: uploadedImageUrls,
                condition,
                approved: true, // Auto-approve for now, or depending on business logic
                brand: 'Generic',
                soldCount: 0,
                rating: 0,
                reviews: 0,
            });

            Alert.alert('Success', 'Product listed successfully', [
                {
                    text: 'OK', onPress: () => {
                        // Reset form
                        setName('');
                        setDescription('');
                        setPrice('');
                        setStock('1');
                        setCompatibility('');
                        setImages([]);
                        // Switch back to list view
                        setView('list');
                    }
                }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to list product');
        } finally {
            setLoading(false);
        }
    }, [user, name, price, description, images, category, stock, compatibility, condition]);

    const renderProduct = ({ item }: { item: MarketplaceProduct }) => (
        <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push(`/(marketplace)/product-details?id=${item.id}`)}
            activeOpacity={0.9}
        >
            <View style={styles.imageContainer}>
                {item.images && item.images.length > 0 ? (
                    <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                ) : (
                    <View style={[styles.productImage, styles.placeholderImage]}>
                        <Ionicons name="image-outline" size={30} color="#ccc" />
                    </View>
                )}
                {item.stock <= 0 && (
                    <View style={styles.outOfStockOverlay}>
                        <Text style={styles.outOfStockText}>SOLD OUT</Text>
                    </View>
                )}
            </View>

            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>

                <View style={styles.statusRow}>
                    <View style={[styles.statusBadge, { backgroundColor: item.stock > 0 ? '#dcfce7' : '#fee2e2' }]}>
                        <Text style={[styles.statusText, { color: item.stock > 0 ? '#166534' : '#991b1b' }]}>
                            {item.stock > 0 ? `${item.stock} in stock` : 'Out of Stock'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (!user || user.role !== 'vendor') {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="lock-closed-outline" size={64} color="#ccc" />
                <Text style={styles.errorText}>Vendor Access Required</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // List View
    if (view === 'list') {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { justifyContent: 'space-between' }]}>
                    <Text style={styles.headerTitle}>My Products</Text>
                    <TouchableOpacity onPress={() => setView('form')} style={styles.addButton}>
                        <Ionicons name="add" size={24} color="#fff" />
                        <Text style={styles.addButtonText}>Add Product</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={products}
                    renderItem={renderProduct}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.productsList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        !loadingProducts ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="cube-outline" size={64} color="#ccc" />
                                <Text style={styles.emptyText}>No products listed yet.</Text>
                                <Text style={styles.emptySubText}>Start selling by adding your first product.</Text>
                            </View>
                        ) : (
                            <ActivityIndicator style={{ marginTop: 50 }} />
                        )
                    }
                />
            </View>
        );
    }

    // Form View
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setView('list')} style={styles.backIcon}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>List New Part</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={loading} style={{ marginLeft: 'auto' }}>
                    {loading ? (
                        <ActivityIndicator color="#007AFF" />
                    ) : (
                        <Text style={styles.postButton}>Post</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Images */}
                <ScrollView horizontal style={styles.imageScroll} showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                        <Ionicons name="camera-outline" size={32} color="#007AFF" />
                        <Text style={styles.addImageText}>Add Photo</Text>
                    </TouchableOpacity>
                    {images.map((img, index) => (
                        <View key={index} style={styles.imageWrapper}>
                            <Image source={{ uri: img.uri }} style={styles.imagePreview} />
                            <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                                <Ionicons name="close-circle" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Product Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Toyota Corolla 2010 Brake Pads"
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#999"
                    />

                    <Text style={styles.label}>Price (₦)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={price}
                        onChangeText={setPrice}
                        placeholderTextColor="#999"
                    />

                    <Text style={styles.label}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                                onPress={() => setCategory(cat)}
                            >
                                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.label}>Condition</Text>
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={[styles.optionButton, condition === 'new' && styles.optionButtonActive]}
                            onPress={() => setCondition('new')}
                        >
                            <Text style={[styles.optionText, condition === 'new' && styles.optionTextActive]}>New</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.optionButton, condition === 'used' && styles.optionButtonActive]}
                            onPress={() => setCondition('used')}
                        >
                            <Text style={[styles.optionText, condition === 'used' && styles.optionTextActive]}>Used</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Stock Quantity</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="1"
                        keyboardType="numeric"
                        value={stock}
                        onChangeText={setStock}
                        placeholderTextColor="#999"
                    />

                    <Text style={styles.label}>Compatible Vehicles (comma separated)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Toyota Camry 2012, Honda Accord 2015"
                        value={compatibility}
                        onChangeText={setCompatibility}
                        placeholderTextColor="#999"
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Describe the condition, specs, etc."
                        multiline
                        numberOfLines={4}
                        value={description}
                        onChangeText={setDescription}
                        placeholderTextColor="#999"
                    />
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.xl,
        gap: 6,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: Typography.fontSize.sm,
    },
    productsList: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 100,
        paddingTop: Spacing.sm,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    productCard: {
        flex: 1,
        marginBottom: Spacing.md,
        backgroundColor: 'transparent',
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        marginBottom: Spacing.xs,
        overflow: 'hidden',
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderImage: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    productInfo: {
        paddingHorizontal: 0,
    },
    productName: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    productPrice: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    outOfStockText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    emptyState: {
        padding: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 20,
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    emptySubText: {
        marginTop: 8,
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    backIcon: {
        padding: 5,
        marginRight: 10,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? 40 : 60,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    headerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    postButton: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.primary, // Black
    },
    content: {
        flex: 1,
    },
    imageScroll: {
        padding: Spacing.lg,
    },
    addImageButton: {
        width: 100,
        height: 100,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        backgroundColor: Colors.surface,
    },
    addImageText: {
        color: Colors.textSecondary,
        fontSize: Typography.fontSize.xs,
        marginTop: 5,
        fontWeight: '500',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageWrapper: {
        width: 100,
        height: 100,
        marginRight: 10,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    removeImageButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 2,
    },
    formSection: {
        padding: Spacing.lg,
    },
    label: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 8,
        marginTop: 15,
    },
    input: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: 12,
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    categoryScroll: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.surface,
        marginRight: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    categoryChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    categoryText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },
    categoryTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        gap: 15,
    },
    optionButton: {
        flex: 1,
        padding: 15,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    optionButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    optionText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    optionTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    errorText: {
        fontSize: Typography.fontSize.lg,
        color: Colors.textSecondary,
        marginTop: 20,
        marginBottom: 20,
    },
    backButton: {
        padding: 15,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
