import { Tabs, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, Platform, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { auth } from '@/config/firebase';

import {
  ShoppingBagIcon as ShoppingBagIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  ClipboardDocumentListIcon as ClipboardDocumentListIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  HomeIcon as HomeIconSolid
} from 'react-native-heroicons/solid';
import {
  ShoppingBagIcon as ShoppingBagIconOutline,
  PlusCircleIcon as PlusCircleIconOutline,
  ClipboardDocumentListIcon as ClipboardDocumentListIconOutline,
  Cog6ToothIcon as Cog6ToothIconOutline,
  HomeIcon as HomeIconOutline
} from 'react-native-heroicons/outline';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/constants/design';

export default function MarketplaceLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, isGuest } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const role = (user?.role || '').toLowerCase().trim();
    const hasVendorStatus = !!user?.vendorStatus;
    const isVendor = role === 'vendor' || hasVendorStatus;

    if (isVendor) {
      const currentRoute = segments[segments.length - 1];
      const status = (user?.vendorStatus || '').toLowerCase().trim();

      // Unapproved vendors (pending_details or rejected) must go to registration form
      // Legacy vendors (no status but role=vendor) should be allowed into the dashboard
      const isExplicitlyUnregistered = status === 'pending_details' || status === 'rejected';

      if (isExplicitlyUnregistered) {
        if (currentRoute !== 'vendor-registration') {
          setTimeout(() => router.replace('/(marketplace)/vendor-registration'), 100);
        }
      } else if (status === 'pending_approval' && currentRoute !== 'pending-approval') {
        setTimeout(() => router.replace('/(marketplace)/pending-approval'), 100);
      } else if (status === 'active' || !status) {
        // Active or Legacy vendors (no status) can access the dashboard
        if (currentRoute === 'vendor-registration' || currentRoute === 'pending-approval') {
          setTimeout(() => router.replace('/(marketplace)/home'), 100);
        }
      }
    }
  }, [user?.role, user?.vendorStatus, segments, router]);

  const isVendor = (user?.role || '').toLowerCase().trim() === 'vendor' || !!user?.vendorStatus;

  return (
    <Tabs
      key={`${user?.id || 'guest'}-${user?.role || 'none'}`}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          height: 60 + (Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 10)),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 10),
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isVendor ? 'Home' : 'Marketplace',
          tabBarIcon: ({ focused, color, size }) => (
            isVendor ? (
              focused ? <HomeIconSolid size={size} color={color} /> : <HomeIconOutline size={size} color={color} />
            ) : (
              focused ? <ShoppingBagIconSolid size={size} color={color} /> : <ShoppingBagIconOutline size={size} color={color} />
            )
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          href: isVendor ? undefined : null,
          title: 'Sell',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <PlusCircleIconSolid size={size} color={color} /> : <PlusCircleIconOutline size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <ClipboardDocumentListIconSolid size={size} color={color} /> : <ClipboardDocumentListIconOutline size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <Cog6ToothIconSolid size={size} color={color} /> : <Cog6ToothIconOutline size={size} color={color} />
          ),
        }}
      />

      {/* Hidden Screens */}
      <Tabs.Screen name="product-details" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="cart" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="checkout" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="order-details" options={{ href: null, tabBarStyle: { display: 'none' } }} />

      <Tabs.Screen name="vendor-registration" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="pending-approval" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="member-auth" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}

