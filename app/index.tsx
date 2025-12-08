import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const { user } = useAuthStore();

  useEffect(() => {
  }, []);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];
  
  if (user.role === 'customer') {
    return <Redirect href="/(customer)/home" />;
  }

  if (user.role === 'vendor') {
    return <Redirect href="/(marketplace)/home" />;
  }

  if (workshopRoles.includes(user.role)) {
  return <Redirect href="/(workshop)/dashboard" />;
  }

  return <Redirect href="/(customer)/home" />;
}

