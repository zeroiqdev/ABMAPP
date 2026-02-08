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
import { useColors } from '@/constants/design';

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
  const colors = useColors();

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
      style={[styles.productCard, { backgroundColor: 'transparent' }]}
      onPress={() => router.push(`/(workshop)/product-details?id=${item.id}&from=marketplace`)}
      activeOpacity={0.9}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.background }]}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={30} color={colors.textTertiary} />
          </View>
        )}
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

        <Text style={[styles.productName, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.productPrice, { color: colors.textPrimary }]}>₦{item.price.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: colors.background }]}
            onPress={() => router.push('/(workshop)/orders')}
          >
            <ClipboardDocumentListIcon size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Marketplace</Text>
          <TouchableOpacity
            style={[styles.cartButton, { backgroundColor: colors.background }]}
            onPress={() => router.push('/(workshop)/cart')}
          >
            <Ionicons name="bag-outline" size={24} color={colors.textPrimary} />
            <View style={styles.cartBadge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search parts, tools..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={colors.textTertiary}
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
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selectedCategory === item && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: colors.textPrimary },
                    selectedCategory === item && { color: colors.textInverse },
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={64} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No products found</Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* Vendor Upload FAB */}
      {user?.role === 'vendor' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.textPrimary }]}
          onPress={() => router.push('/(marketplace)/upload')}
        >
          <Ionicons name="add" size={32} color={colors.textInverse} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 16,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    overflow: 'visible',
  },
  imageContainer: {
    width: '100%',
    height: COLUMN_WIDTH * 1.0,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginBottom: 0,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#eee',
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
    paddingHorizontal: 0,
    marginTop: 8,
    flexDirection: 'column',
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
    fontWeight: 'normal',
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
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



