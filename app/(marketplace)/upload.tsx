import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { useAuthStore } from '@/store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { validateImageWithAlert, formatFileSize } from '@/utils/imageValidation';

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

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [stock, setStock] = useState('1');
    const [compatibility, setCompatibility] = useState('');
    const [condition, setCondition] = useState<'new' | 'used'>('new');
    // Store image URIs (for display and upload)
    const [images, setImages] = useState<{ uri: string }[]>([]);

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
                
                // Validate image before adding
                const isValid = await validateImageWithAlert(imageUri);
                
                if (isValid) {
                    setImages((prev) => [...prev, {
                        uri: imageUri,
                    }]);
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
            // Upload images to Cloudinary with vendor ID
            const uploadedImageUrls = await Promise.all(
                images.map(async (img) => {
                    // Pass URI and vendor ID for upload (organizes in marketplace/vendorId folder)
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
                approved: true,
                brand: 'Generic',
                soldCount: 0,
                rating: 0,
                reviews: 0,
            });

            Alert.alert('Success', 'Product listed successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to list product');
        } finally {
            setLoading(false);
        }
    }, [user, name, price, description, images, category, stock, compatibility, condition, router]);

    // Check if user is a vendor - do this after hooks
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>List New Part</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={loading}>
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
        backgroundColor: '#fff',
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
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    postButton: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
    },
    content: {
        flex: 1,
    },
    imageScroll: {
        padding: 20,
    },
    addImageButton: {
        width: 100,
        height: 100,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        backgroundColor: '#F0F8FF',
    },
    addImageText: {
        color: '#007AFF',
        fontSize: 12,
        marginTop: 5,
        fontWeight: '500',
    },
    imagePreview: {
        width: 100,
        height: 100,
        marginRight: 15,
        position: 'relative',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    removeImage: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#fff',
        borderRadius: 10,
    },
    formSection: {
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 15,
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        color: '#000',
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    categoryScroll: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryChipActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    categoryText: {
        fontSize: 14,
        color: '#666',
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
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
    },
    optionButtonActive: {
        backgroundColor: '#E8F5E9',
        borderWidth: 1,
        borderColor: '#30D158',
    },
    optionText: {
        fontSize: 16,
        color: '#666',
    },
    optionTextActive: {
        color: '#30D158',
        fontWeight: 'bold',
    },
    errorText: {
        fontSize: 18,
        color: '#666',
        marginTop: 20,
        marginBottom: 20,
    },
    backButton: {
        padding: 15,
        backgroundColor: '#000',
        borderRadius: 10,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    imageWrapper: {
        width: 100,
        height: 100,
        marginRight: 10,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: 12,
    },
});
