import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Notification, Vehicle, MarketplaceProduct } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, useColors } from '@/constants/design';
import { firebaseService } from '@/services/firebaseService';
import { BrandLogo } from '@/components/BrandLogo';
import { CAR_BRANDS } from '@/constants/carBrands';


export default function CustomerHomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columnCount = width > 600 ? 3 : 2;
  const PRODUCT_CARD_WIDTH = (width - 32 - (columnCount - 1) * 12) / columnCount;

  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors, insets, PRODUCT_CARD_WIDTH), [colors, insets, PRODUCT_CARD_WIDTH]);
  const [activeTab, setActiveTab] = useState<'tow' | 'repairs' | 'orders'>('repairs');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const userVehicles = await firebaseService.getVehicles(user.id);
      setVehicles(userVehicles);

      const products = await firebaseService.getMarketplaceProducts(undefined, undefined, true);
      setMarketplaceProducts(products.slice(0, 6));

      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.id),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notifications = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Notification[];
      setNotifications(notifications);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getBrand = (make: string) => {
    return CAR_BRANDS.find(b => b.name.toLowerCase() === make.toLowerCase());
  };

  const displayVehicles = vehicles.slice(0, 2);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          </View>
          <View>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Welcome back,</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>{user?.name || 'Customer'}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/(customer)/notifications')}>
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {notifications.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifications.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
      >
        {/* Vehicles Card */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>My Vehicles</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {vehicles.length > 0 ? (
              <View style={styles.vehicleList}>
                {displayVehicles.map((vehicle, index) => {
                  const brand = getBrand(vehicle.make);
                  return (
                    <View key={vehicle.id} style={[styles.vehicleRow, index > 0 && styles.vehicleRowSpaced]}>
                      <View style={styles.vehicleIcon}>
                        {brand ? (
                          <BrandLogo brand={brand.name} size={24} />
                        ) : (
                          <Text style={styles.vehicleIconText}>
                            {vehicle.make.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.vehicleName}>
                        {vehicle.make} {vehicle.model}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyVehicleState}>
                <Text style={styles.emptyVehicleText}>No vehicles linked</Text>
                <TouchableOpacity onPress={() => router.push('/(customer)/add-vehicle')}>
                  <Text style={styles.addLink}>Add now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.fleetInfo}>
              {vehicles.length > 2 && (
                <TouchableOpacity onPress={() => router.push('/(customer)/vehicles')}>
                  <Text style={styles.seeFleetText}>+ {vehicles.length - 2} more (See Fleet)</Text>
                </TouchableOpacity>
              )}
              {vehicles.length <= 2 && vehicles.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/(customer)/vehicles')}>
                  <Text style={styles.seeFleetText}>View Fleet</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => router.push('/(customer)/invoices')}
            >
              <Text style={styles.detailsButtonText}>Invoices</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Selection Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tow' && styles.tabActive]}
            onPress={() => {
              setActiveTab('tow');
              router.push('/(customer)/tow-request');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'tow' && styles.tabTextActive]} numberOfLines={1}>
              Request Tow
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'repairs' && styles.tabActive]}
            onPress={() => {
              setActiveTab('repairs');
              router.push('/(customer)/service');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'repairs' && styles.tabTextActive]} numberOfLines={1}>
              Request Repair
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
            onPress={() => {
              setActiveTab('orders');
              router.push('/(customer)/orders');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]} numberOfLines={1}>
              Orders
            </Text>
          </TouchableOpacity>
        </View>

        {/* Marketplace Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Parts for Sell</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/marketplace')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productsGrid}>
            {marketplaceProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => router.push(`/(customer)/product-details?id=${product.id}`)}
                activeOpacity={0.9}
              >
                <View style={styles.imageContainer}>
                  {product.images && product.images.length > 0 ? (
                    <Image
                      source={{ uri: product.images[0] }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productImage, styles.placeholderImage]}>
                      <Ionicons name="image-outline" size={30} color={colors.textTertiary} />
                    </View>
                  )}
                  {product.stock <= 0 && (
                    <View style={styles.outOfStockOverlay}>
                      <Text style={styles.outOfStockText}>SOLD OUT</Text>
                    </View>
                  )}
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>

                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color={colors.textPrimary} />
                    <Text style={styles.ratingText}>
                      {(product.rating || 0) > 0 ? product.rating : 'New'}
                    </Text>
                    <Text style={styles.ratingSeparator}>|</Text>
                    <View style={styles.soldBadge}>
                      <Text style={styles.soldText}>{product.reviews || 0} sold</Text>
                    </View>
                  </View>

                  <Text style={styles.productPrice}>₦{product.price.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          {marketplaceProducts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No products available</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, insets: any, PRODUCT_CARD_WIDTH: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Math.max(insets.top, Spacing.lg),
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.base,
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  cardContainer: {
    backgroundColor: colors.surface, // Dynamic surface color (Dark in dark mode)
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardBody: {
    marginBottom: 20,
  },
  vehicleList: {
    flexDirection: 'column',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleRowSpaced: {
    marginTop: 12,
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyVehicleState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyVehicleText: {
    color: colors.textTertiary,
  },
  addLink: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fleetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeFleetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  detailsButton: {
    backgroundColor: colors.textPrimary, // Inverted for contrast
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  detailsButtonText: {
    color: colors.textInverse, // Text inverse for contrast
    fontWeight: '600',
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    minHeight: 48,
  },
  tabActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  tabText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  section: {
    paddingBottom: Spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '600',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: Spacing.base,
    gap: 12,
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    marginBottom: 16,
    backgroundColor: 'transparent',
    flexDirection: 'column',
  },
  imageContainer: {
    width: '100%',
    height: PRODUCT_CARD_WIDTH * 1.0,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
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
    borderColor: colors.border,
  },
  soldText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textTertiary,
  },
});
