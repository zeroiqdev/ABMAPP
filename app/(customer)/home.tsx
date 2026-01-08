import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Job, Notification, Vehicle, MarketplaceProduct } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, StatusColors } from '@/constants/design';
import { firebaseService } from '@/services/firebaseService';
import { BrandLogo } from '@/components/BrandLogo';
import { CAR_BRANDS } from '@/constants/carBrands';

const { width } = Dimensions.get('window');
const PRODUCT_CARD_WIDTH = (width - 40) / 2; // Match admin marketplace: (width - 40) / 2

export default function CustomerHomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'tow' | 'repairs' | 'orders'>('repairs');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);



  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // Load vehicles - includes vehicles created by admin/technician for this customer
      // (vehicles are stored with userId pointing to the customer's user ID)
      console.log('[Customer Home] Loading vehicles for user ID:', user.id, 'Email:', user.email);
      const userVehicles = await firebaseService.getVehicles(user.id);
      console.log('[Customer Home] Loaded vehicles count:', userVehicles.length);
      if (userVehicles.length > 0) {
        console.log('[Customer Home] Vehicle details:', userVehicles.map(v => ({
          id: v.id,
          make: v.make,
          model: v.model,
          userId: v.userId
        })));
      } else {
        console.log('[Customer Home] No vehicles found for user ID:', user.id);
      }
      setVehicles(userVehicles);

      // Load marketplace products (limit to 6 for home screen)
      const products = await firebaseService.getMarketplaceProducts(undefined, undefined, true);
      setMarketplaceProducts(products.slice(0, 6));

      // Load notifications
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
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data when screen comes into focus (e.g., after adding a vehicle)
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

  // Get at least 2 vehicles for display
  const displayVehicles = vehicles.slice(0, 2);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
          <View>
            <Text style={{ fontSize: 14, color: '#666' }}>Welcome back,</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000' }}>{user?.name || 'Customer'}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>

          <TouchableOpacity onPress={() => router.push('/(customer)/notifications')}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >


        {/* Wallet-Style Vehicle Card */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>My Vehicles</Text>
            </View>
            {/* Filters removed as requested */}
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
              {/* If <= 2, we can just show empty or "See Fleet" anyway if they want to manage */}
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
              // Navigate to tow request screen
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
                      <Ionicons name="image-outline" size={30} color="#ccc" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.favoriteButton}>
                    <Ionicons name="heart-outline" size={18} color="#fff" />
                  </TouchableOpacity>
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
                    <Ionicons name="star" size={16} color="#000" />
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
              <Ionicons name="storefront-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No products available</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing['5xl'],
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  welcomeText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.base,
    alignItems: 'center',
  },
  headerButton: {
    padding: Spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  content: {
    flex: 1,
  },
  cardContainer: {
    backgroundColor: '#000', // Black card
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff', // White text
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#ccc', // Light gray
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
    backgroundColor: '#333', // Dark gray circle
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  vehicleIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff', // White text
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff', // White text
  },
  emptyVehicleState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyVehicleText: {
    color: '#999',
  },
  addLink: {
    color: Colors.primary, // Keep primary color or make it white/blue
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
    color: '#ccc', // Light gray
  },
  detailsButton: {
    backgroundColor: '#fff', // White button
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  detailsButtonText: {
    color: '#000', // Black text
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: 4, // Reduced from Spacing.base to fit text
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4, // Reduced gap
  },
  tabActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  tabText: {
    fontSize: 12, // Reduced from sm (14)
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  tabTextActive: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
  },
  section: {
    paddingBottom: Spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
    paddingHorizontal: 16, // Align with vehicle card margin
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.secondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Spacing.base,
  },
  productCard: {
    width: PRODUCT_CARD_WIDTH,
    marginBottom: 16,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    overflow: 'visible',
  },
  imageContainer: {
    width: '100%',
    height: PRODUCT_CARD_WIDTH * 1.0, // Reduced from 1.2 to 1.0 (Square)
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // Changed to contain to see full product if it's cut off, or cover? Reference looked like cover/contain mix. Let's stick to cover but maybe 'contain' is better for "parts". The reference engine looked full. Let's try 'cover' with square.
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
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
    marginTop: 8, // Reduced from 12
    flexDirection: 'column',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4, // Reduced from 6
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // Reduced from 8
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginLeft: 4,
  },
  ratingSeparator: {
    marginHorizontal: 8,
    color: '#ccc',
    fontSize: 14,
  },
  soldBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6, // Slightly reduced
    paddingVertical: 2, // Slightly reduced
    borderRadius: 4,
  },
  soldText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  emptyState: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    marginTop: Spacing.base,
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },
});
