import { Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Redirect } from 'expo-router';

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="job-details" />
      <Stack.Screen name="customers" />
      <Stack.Screen name="vehicles" />
      <Stack.Screen name="inventory" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

