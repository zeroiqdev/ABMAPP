import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO_URL = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1759821531/Screenshot_2025-10-07_at_8.08.13_AM-removebg-preview_g8za2u.png';
const { width } = Dimensions.get('window');

const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

export default function Index() {
  const router = useRouter();
  const { user, isGuest, preferredMode, setGuest, isProfileLoaded, isAuthenticating } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);

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
    }, 1000); // Faster splash
    return () => clearTimeout(timer);
  }, []);

  const hasRouted = React.useRef(false);

    const routeUser = () => {
        console.log('[Index] Routing Decision:', {
            hasUser: !!user,
            isGuest,
            preferredMode,
            firebaseUid: auth.currentUser?.uid,
            isProfileLoaded,
            isAuthenticating
        });

        if (user) {
            const role = (user.role || '').toLowerCase().trim();
            const hasVendorStatus = !!user.vendorStatus;
            const status = (user.vendorStatus || '').toLowerCase().trim();
            
            console.log(`[Router] Routing User (${user.email}) - Role: "${role}", Status: "${status}"`);

            if (role === 'super_admin' || workshopRoles.includes(role)) {
                router.replace('/(workshop)/dashboard');
            } else if (role === 'vendor' || hasVendorStatus) {
                // Unregistered vendors (pending_details or rejected) must go to registration form
                const isExplicitlyUnregistered = status === 'pending_details' || status === 'rejected';
                
                if (isExplicitlyUnregistered) {
                    router.replace('/(marketplace)/vendor-registration');
                } else if (status === 'pending_approval') {
                    router.replace('/(marketplace)/pending-approval');
                } else {
                    router.replace('/(marketplace)/home');
                }
            } else if (role === 'customer') {
                router.replace('/(customer)/home');
            } else if (user.workshopId && !hasVendorStatus && role !== 'customer') {
                router.replace('/(workshop)/dashboard');
            } else {
                // Fallback: If they have absolutely no role but have vendorStatus, assume vendor
                if (hasVendorStatus) {
                    router.replace('/(marketplace)/home');
                } else {
                    console.warn(`[Router] No definitive role for ${user.email}, defaulting to customer.`);
                    router.replace('/(customer)/home');
                }
            }
        } else if (auth.currentUser) {
            // If they have a Firebase session but NO profile doc after it's loaded, 
            // they might be a guest or need to register. default to marketplace home.
            console.log('[Index] Auth session exists but no user profile found');
            router.replace('/(marketplace)/home');
        } else if (preferredMode === 'member') {
            router.replace('/(marketplace)/member-auth');
        } else if (preferredMode === 'guest' || isGuest || hasSeenWelcome) {
            router.replace('/(marketplace)/home');
        } else {
            router.replace('/welcome');
        }
    };

  useEffect(() => {
    const checkNavigation = async () => {
      console.log('[Index] checkNavigation:', {
          isReady,
          authInitialized,
          storeHydrated,
          hasRouted: hasRouted.current,
          firebaseUser: !!auth.currentUser,
          isProfileLoaded,
          isAuthenticating
      });

      if (!isReady || !authInitialized || !storeHydrated || hasRouted.current) {
        return;
      }

      // If we're in the middle of an auth action, wait for it to finish
      if (isAuthenticating) {
        console.log('[Index] Waiting for auth action to complete...');
        return;
      }

      // Check welcome flag once before routing
      if (hasSeenWelcome === null) {
        const seen = await AsyncStorage.getItem('hasSeenWelcome');
        setHasSeenWelcome(seen === 'true');
        console.log('[Index] Loaded hasSeenWelcome:', seen);
      }

      // If auth session exists but profile isn't loaded yet, keep waiting
      if (auth.currentUser && !isProfileLoaded) {
        console.log('[Index] Waiting for profile load...');
        return;
      }

      // Final routing decision
      hasRouted.current = true;
      routeUser();
    };

    checkNavigation();
  }, [isReady, authInitialized, storeHydrated, isProfileLoaded, isAuthenticating, user, isGuest, preferredMode]);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: LOGO_URL }}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 20 }} />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.7,
    height: width * 0.35,
  },
});
