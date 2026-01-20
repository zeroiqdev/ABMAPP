import { Tabs, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/design';
import {
  HomeIcon as HomeIconOutline,
  BanknotesIcon as BanknotesIconOutline,
  BriefcaseIcon as BriefcaseIconOutline,
  UserGroupIcon as UserGroupIconOutline,
  ArchiveBoxIcon as ArchiveBoxIconOutline,
  ShoppingBagIcon as ShoppingBagIconOutline,
  UserIcon as UserIconOutline
} from 'react-native-heroicons/outline';
import {
  HomeIcon as HomeIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  ArchiveBoxIcon as ArchiveBoxIconSolid,
  ShoppingBagIcon as ShoppingBagIconSolid,
  UserIcon as UserIconSolid
} from 'react-native-heroicons/solid';
import { useEffect, useState } from 'react';
import { firebaseService } from '@/services/firebaseService';
import { View, ActivityIndicator } from 'react-native';

export default function WorkshopLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<any>(null);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const SYSTEM_WORKSHOP_ROLES = ['super_admin', 'admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];

  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.workshopId && user?.role) {
        try {
          const allPerms = await firebaseService.getWorkshopPermissions(user.workshopId);

          // Extract custom role keys (any role in permissions that's not a system role or customer/vendor)
          const customRoleKeys = Object.keys(allPerms || {}).filter(
            r => !SYSTEM_WORKSHOP_ROLES.includes(r) && r !== 'customer' && r !== 'vendor'
          );
          setCustomRoles(customRoleKeys);

          // Admins always have full access
          if (user.role === 'admin' || user.role === 'super_admin') {
            setPermissions({
              canViewFinance: true,
              canViewInventory: true,
              canManageStaff: true,
              canManageJobs: true,
            });
          } else {
            setPermissions(allPerms[user.role] || {});
          }
        } catch (error) {
          console.error("Failed to fetch permissions", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchPermissions();
  }, [user]);

  // Redirect based on role - must wait for loading to complete to know custom roles
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Build workshopRoles dynamically: system roles + custom roles from Firestore
  const workshopRoles = [...SYSTEM_WORKSHOP_ROLES, ...customRoles];

  if (!workshopRoles.includes(user.role)) {
    return <Redirect href="/(customer)/home" />;
  }

  const canViewDashboard = user.role === 'admin' || user.role === 'super_admin' || user.role === 'technician' || permissions?.canViewDashboard;
  const canViewFinance = user.role === 'admin' || user.role === 'super_admin' || permissions?.canViewFinance;
  const canViewInventory = user.role === 'admin' || user.role === 'super_admin' || permissions?.canViewInventory;
  // const canManageStaff = user.role === 'admin' || permissions?.canManageStaff; // For Customers tab?

  // Determine the first available tab to avoid flash
  const getInitialRoute = () => {
    if (canViewDashboard) return 'dashboard';
    if (canViewFinance) return 'finance';
    // Jobs tab is always visible
    return 'jobs';
  };

  return (
    <Tabs
      initialRouteName={getInitialRoute()}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 60 + (Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 10)),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 10),
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
          href: canViewDashboard ? undefined : null,
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <HomeIconSolid size={size || 24} color={color} /> : <HomeIconOutline size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          href: canViewFinance ? undefined : null,
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
          href: canViewInventory ? undefined : null,
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
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused, color, size }) => (
            focused ? <UserIconSolid size={size || 24} color={color} /> : <UserIconOutline size={size || 24} color={color} />
          ),
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
      <Tabs.Screen
        name="marketplace-orders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="marketplace-order-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

