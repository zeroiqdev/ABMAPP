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

  if (user.role === 'customer') {
    return <Redirect href="/(customer)/home" />;
  }

  return <Redirect href="/(workshop)/dashboard" />;
}

