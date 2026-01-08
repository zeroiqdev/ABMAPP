import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ClipboardDocumentListIcon } from 'react-native-heroicons/outline';
import { firebaseService } from '@/services/firebaseService';
import { MarketplaceProduct } from '@/types';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 2;

const CATEGORIES = [
  'All',
  'Engine',
  'Electrical',
  'Suspension',
  'Brakes',
  'Body Parts',
  'Interior',
  'Wheels & Tires',
  'Accessories',
  'Tools',
];

export default function MarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    try {
      const category = selectedCategory === 'All' ? undefined : selectedCategory;
      const productsData = await firebaseService.getMarketplaceProducts(
        category,
        searchTerm || undefined
      );
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [selectedCategory, searchTerm])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const renderProduct = ({ item }: { item: MarketplaceProduct }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => router.push(`/(workshop)/product-details?id=${item.id}&from=marketplace`)}
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
        <TouchableOpacity style={styles.favoriteButton}>
          <Ionicons name="heart-outline" size={20} color="#000" />
        </TouchableOpacity>
        {item.stock <= 0 && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>SOLD OUT</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#000" />
          <Text style={styles.ratingText}>{item.rating || 'New'} <Text style={styles.reviewCount}>({item.reviews || 0})</Text></Text>
        </View>

        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => router.push('/(workshop)/orders')}
          >
            <ClipboardDocumentListIcon size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Marketplace</Text>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => router.push('/(workshop)/cart')}
          >
            <Ionicons name="bag-handle-outline" size={24} color="#000" />
            <View style={styles.cartBadge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parts, tools..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.contentContainer}>
        {/* Categories */}
        <View style={styles.categoriesWrapper}>
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  selectedCategory === item && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === item && styles.categoryTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item}
          />
        </View>

        {/* Products List */}
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
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* Vendor Upload FAB */}
      {user?.role === 'vendor' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(marketplace)/upload')}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
    borderWidth: 1,
    borderColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  categoriesWrapper: {
    paddingVertical: 10,
  },
  categoriesList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  categoryText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  productsList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: COLUMN_WIDTH,
    marginBottom: 20,
    backgroundColor: '#fff',
    // No shadow for clean flat look from images
  },
  imageContainer: {
    width: '100%',
    height: COLUMN_WIDTH * 1.2,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
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
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
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
  productInfo: {
    paddingHorizontal: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reviewCount: {
    color: '#999',
    fontWeight: 'normal',
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  promoBanner: {
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 24,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  promoSubtitle: {
    color: '#ccc',
    fontSize: 14,
  },
  promoImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#333',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
});



