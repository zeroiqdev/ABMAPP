import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
      onPress={() => router.push(`/(customer)/product-details?id=${item.id}&from=marketplace`)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
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
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color={colors.textPrimary} />
          <Text style={styles.ratingText}>{item.rating || 'New'}</Text>
          <Text style={styles.ratingSeparator}>|</Text>
          <View style={styles.soldBadge}>
            <Text style={styles.soldText}>{item.reviews || 0} sold</Text>
          </View>
        </View>

        <Text style={styles.productPrice}>₦{item.price.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>

          <Text style={styles.headerTitle}>Marketplace</Text>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => router.push('/(customer)/cart')}
          >
            <Ionicons name="bag-outline" size={24} color={colors.textPrimary} />
            <View style={styles.cartBadge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
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
          ListHeaderComponent={null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
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
    borderColor: colors.textInverse,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.textPrimary, // Or colors.primary
    borderColor: colors.textPrimary,
  },
  categoryText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: colors.textInverse, // Or based on chip active bg
  },
  productsList: {
    paddingHorizontal: 20,
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
    height: COLUMN_WIDTH * 1.0, // Reduced height (square)
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginBottom: 0, // Removed bottom margin from container
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', // Keep transparent black for contrast on image
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
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
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 4,
  },
  ratingSeparator: {
    marginHorizontal: 8,
    color: colors.textTertiary,
    fontSize: 14,
  },
  soldBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border, // Add border for visibility
  },
  soldText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: colors.textTertiary,
    fontSize: 16,
  },
});
