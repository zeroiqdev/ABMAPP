import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuthStore } from '@/store/authStore';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User } from '@/types';
import { useThemeStore } from '@/store/themeStore';

export default function RootLayout() {
  const router = useRouter(); // Use Expo Router
  const { setUser, setFirebaseUser } = useAuthStore();
  const { getEffectiveTheme } = useThemeStore();
  const effectiveTheme = getEffectiveTheme();

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;
    let workshopUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);

        // Unsubscribe from previous listeners
        if (userUnsubscribe) userUnsubscribe();
        if (workshopUnsubscribe) workshopUnsubscribe();

        // Subscribe to user document
        const userRef = doc(db, 'users', firebaseUser.uid);
        userUnsubscribe = onSnapshot(userRef,
          (userDoc: any) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              // Validate Vendor Role
              if (data.vendorStatus && data.role !== 'vendor') {
                data.role = 'vendor';
              }

              const userData: User = {
                ...data,
                id: userDoc.id,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
              } as User;
              setUser(userData);

              // Register for push notifications
              if (userData.id) {
                // We import notificationService dynamically or at top level, assuming it's safe
                const { notificationService } = require('@/services/notificationService');
                notificationService.registerAndSavePushToken(userData.id).catch((err: any) =>
                  console.log('Push registration failed silently:', err)
                );
              }

              // *** SUBSCRIPTION GATING START ***
              const gatedRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];
              if (userData.workshopId && gatedRoles.includes(userData.role)) {
                // Clean up previous workshop listener if workshopId changed (unlikely but safe)
                if (workshopUnsubscribe) workshopUnsubscribe();

                const workshopRef = doc(db, 'workshops', userData.workshopId);
                workshopUnsubscribe = onSnapshot(workshopRef, (workshopDoc: any) => {
                  if (workshopDoc.exists()) {
                    const wsData = workshopDoc.data();
                    // Check Status
                    const isActive = wsData.subscriptionStatus === 'active' || wsData.subscriptionStatus === 'trial';
                    // Check Expiry (if exists)
                    const now = new Date();
                    // Assuming subscriptionExpiry is a Timestamp
                    const expiry = wsData.subscriptionExpiry?.toDate();
                    const isExpired = expiry && expiry < now;

                    if (!isActive || (isActive && isExpired)) {
                      // Subscription Invalid - Redirect
                      console.log('[Gating] Workshop Subscription Inactive/Expired. Redirecting...');
                      router.replace('/(auth)/subscription-expired');
                    }
                  }
                });
              }
              // *** SUBSCRIPTION GATING END ***

            } else {
              console.log('[RootLayout] User document not found (yet).');
            }
          },
          (error: any) => {
            console.error('Error listening to user data:', error);
          }
        );

      } else {
        setFirebaseUser(null);
        setUser(null);
        if (userUnsubscribe) userUnsubscribe();
        if (workshopUnsubscribe) workshopUnsubscribe();
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
      if (workshopUnsubscribe) workshopUnsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(workshop)" />
        <Stack.Screen name="(marketplace)" />
        <Stack.Screen name="(super-admin)" />
      </Stack>
    </GestureHandlerRootView>
  );
}

