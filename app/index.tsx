import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

const LOGO_URL = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1759821531/Screenshot_2025-10-07_at_8.08.13_AM-removebg-preview_g8za2u.png';
const { width } = Dimensions.get('window');

const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

export default function Index() {
  const router = useRouter();
  const { user, setGuest } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setStoreHydrated(true);
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => {
        setStoreHydrated(true);
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const hasRouted = React.useRef(false);

  useEffect(() => {
    if (isReady && authInitialized && storeHydrated && !hasRouted.current) {
      if (auth.currentUser && !user) {
        const timeout = setTimeout(() => {
          if (!hasRouted.current && auth.currentUser && !user) {
            hasRouted.current = true;
            setGuest(true);
            router.replace('/(marketplace)/home');
          }
        }, 5000);
        return () => clearTimeout(timeout);
      }

      hasRouted.current = true;
      if (user) {
        routeUser(user);
      } else {
        setGuest(true);
        router.replace('/(marketplace)/home');
      }
    }
  }, [isReady, authInitialized, storeHydrated, user]);

  const routeUser = (userData: any) => {
    if (userData.role === 'super_admin') {
      router.replace('/(workshop)/dashboard');
      return;
    }

    if (userData.role === 'vendor') {
      if (userData.vendorStatus === 'active') {
        router.replace('/(marketplace)/home');
      } else if (userData.vendorStatus === 'pending_approval') {
        router.replace('/(marketplace)/pending-approval');
      } else {
        router.replace('/(marketplace)/vendor-registration');
      }
    } else if (userData.role === 'customer') {
      router.replace('/(customer)/home');
    } else if (workshopRoles.includes(userData.role)) {
      router.replace('/(workshop)/dashboard');
    } else if (userData.workshopId && userData.role !== 'customer' && userData.role !== 'vendor') {
      router.replace('/(workshop)/dashboard');
    } else {
      router.replace('/(customer)/home');
    }
  };

  return (
    <View style={styles.splashContainer}>
      <Image
        source={{ uri: LOGO_URL }}
        style={styles.splashLogo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color="#fff" style={{ marginTop: 30 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: width * 0.7,
    height: width * 0.35,
  },
});
