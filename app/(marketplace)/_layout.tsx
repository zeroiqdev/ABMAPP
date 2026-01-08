import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

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

export default function MarketplaceLayout() {
  const { user } = useAuthStore();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          backgroundColor: '#fff',
          height: Platform.OS === 'ios' ? 85 : 60,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#999',
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
      <Tabs.Screen name="vendor-dashboard" options={{ href: null }} />
    </Tabs>
  );
}

