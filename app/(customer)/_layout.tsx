import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import {
  HomeIcon,
  ReceiptRefundIcon,
  WrenchScrewdriverIcon,
  ShoppingBagIcon,
  UserIcon,
} from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeIconSolid,
  ReceiptRefundIcon as ReceiptRefundIconSolid,
  WrenchScrewdriverIcon as WrenchScrewdriverIconSolid,
  ShoppingBagIcon as ShoppingBagIconSolid,
  UserIcon as UserIconSolid,
} from 'react-native-heroicons/solid';
import { useColors } from '@/constants/design';

export default function CustomerLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 60 + (Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 20)),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 20),
        },
        tabBarBackground: () => (
          <BlurView intensity={80} tint={colors.background === '#000000' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            focused ? <HomeIconSolid size={size} color={color} /> : <HomeIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          href: '/(customer)/invoices',
          tabBarIcon: ({ color, focused, size }) => (
            focused ? <ReceiptRefundIconSolid size={size} color={color} /> : <ReceiptRefundIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Maintenance',
          href: '/(customer)/maintenance',
          tabBarIcon: ({ color, focused, size }) => (
            focused ? <WrenchScrewdriverIconSolid size={size} color={color} /> : <WrenchScrewdriverIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ color, focused, size }) => (
            focused ? <ShoppingBagIconSolid size={size} color={color} /> : <ShoppingBagIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused, size }) => (
            focused ? <UserIconSolid size={size} color={color} /> : <UserIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          href: null,
          title: 'Service',
          tabBarIcon: ({ color, size }) => (
            <WrenchScrewdriverIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="add-vehicle"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="book-service"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tow-request"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="job-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoice-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="vehicle-history"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="product-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="order-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="quote-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

