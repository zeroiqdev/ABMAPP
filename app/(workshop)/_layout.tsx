import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/design';

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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customer',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="archive-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size || 20} color={color} />
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
    </Tabs>
  );
}

