import { Tabs, useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';

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
    if (user?.role === 'vendor') {
      const currentRoute = segments[segments.length - 1];

      // Unapproved vendors (pending_details, rejected, or no status) must go to registration form
      // Never let them see home screen
      if (!user.vendorStatus || user.vendorStatus === 'pending_details' || user.vendorStatus === 'rejected') {
        if (currentRoute !== 'vendor-registration') {
          // Use a small timeout to ensure navigation is ready or avoid immediate loop
          setTimeout(() => router.replace('/(marketplace)/vendor-registration'), 100);
        }
      } else if (user.vendorStatus === 'pending_approval' && currentRoute !== 'pending-approval') {
        setTimeout(() => router.replace('/(marketplace)/pending-approval'), 100);
      } else if (user.vendorStatus === 'active') {
        // If active, they shouldn't be on registration or pending screens
        if (currentRoute === 'vendor-registration' || currentRoute === 'pending-approval') {
          setTimeout(() => router.replace('/(marketplace)/home'), 100);
        }
      }
    }
  }, [user?.role, user?.vendorStatus, segments, router]);

  return (
    <Tabs
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
          title: user?.role === 'vendor' ? 'Home' : 'Marketplace',
          tabBarIcon: ({ focused, color, size }) => (
            user?.role === 'vendor' ? (
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
          href: Boolean(isGuest) ? null : undefined,
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

