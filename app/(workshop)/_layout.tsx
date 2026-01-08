import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/design';
import {
  HomeIcon as HomeIconOutline,
  BanknotesIcon as BanknotesIconOutline,
  BriefcaseIcon as BriefcaseIconOutline,
  UserGroupIcon as UserGroupIconOutline,
  ArchiveBoxIcon as ArchiveBoxIconOutline,
  ShoppingBagIcon as ShoppingBagIconOutline
} from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  ArchiveBoxIcon as ArchiveBoxIconSolid,
  ShoppingBagIcon as ShoppingBagIconSolid
} from 'react-native-heroicons/solid';

export default function WorkshopLayout() {
  const { user } = useAuthStore();

  // Redirect based on role
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];

  if (!workshopRoles.includes(user.role)) {
    return <Redirect href="/(customer)/home" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 50,
          paddingBottom: 4,
          paddingTop: 4,
          paddingHorizontal: 10,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          marginHorizontal: -2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <HomeIconSolid size={size || 24} color={color} /> : <HomeIconOutline size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <BanknotesIconSolid size={size || 24} color={color} /> : <BanknotesIconOutline size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <BriefcaseIconSolid size={size || 24} color={color} /> : <BriefcaseIconOutline size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customer',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <UserGroupIconSolid size={size || 24} color={color} /> : <UserGroupIconOutline size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <ArchiveBoxIconSolid size={size || 24} color={color} /> : <ArchiveBoxIconOutline size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <ShoppingBagIconSolid size={size || 24} color={color} /> : <ShoppingBagIconOutline size={size || 24} color={color} />
          ),
        }}
      />

      {/* Hidden screens (not in tab bar) */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="job-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="register-customer"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="staff-invitations"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoices"
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
        name="reports"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="create-job"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="create-inventory-item"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="customer-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="vehicle-service-history"
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
        name="create-invoice"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="access-control"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

