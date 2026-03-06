import { useEffect, useRef } from 'react';
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
  const router = useRouter();
  const { setUser, setFirebaseUser, setGuest } = useAuthStore();
  const { getEffectiveTheme } = useThemeStore();
  const effectiveTheme = getEffectiveTheme();

  const pushRegisteredForUid = useRef<string | null>(null);
  const lastUserJSON = useRef<string | null>(null);

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;
    let workshopUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);

        if (userUnsubscribe) userUnsubscribe();
        if (workshopUnsubscribe) workshopUnsubscribe();

        const userRef = doc(db, 'users', firebaseUser.uid);
        userUnsubscribe = onSnapshot(userRef,
          (userDoc: any) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.vendorStatus && data.role !== 'vendor') {
                data.role = 'vendor';
              }

              const userData: User = {
                ...data,
                id: userDoc.id,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
              } as User;

              const { updatedAt, createdAt, ...comparableFields } = userData as any;
              const newJSON = JSON.stringify(comparableFields);
              if (newJSON !== lastUserJSON.current) {
                lastUserJSON.current = newJSON;
                setUser(userData);
                setGuest(false);
              }

              if (userData.id && pushRegisteredForUid.current !== userData.id) {
                pushRegisteredForUid.current = userData.id;
                const { notificationService } = require('@/services/notificationService');
                notificationService.registerAndSavePushToken(userData.id).catch((err: any) =>
                  console.log('Push registration failed:', err)
                );
              }

              // Subscription gating for workshop staff
              const gatedRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];
              if (userData.workshopId && gatedRoles.includes(userData.role)) {
                if (workshopUnsubscribe) workshopUnsubscribe();

                const workshopRef = doc(db, 'workshops', userData.workshopId);
                workshopUnsubscribe = onSnapshot(workshopRef, (workshopDoc: any) => {
                  if (workshopDoc.exists()) {
                    const wsData = workshopDoc.data();
                    const isActive = wsData.subscriptionStatus === 'active' || wsData.subscriptionStatus === 'trial';
                    const expiry = wsData.subscriptionExpiry?.toDate();
                    const isExpired = expiry && expiry < new Date();

                    if (!isActive || (isActive && isExpired)) {
                      router.replace('/(auth)/subscription-expired');
                    }
                  }
                });
              }
            }
          },
          (error: any) => {
            console.error('Error listening to user data:', error);
          }
        );

      } else {
        setFirebaseUser(null);
        setUser(null);
        lastUserJSON.current = null;
        pushRegisteredForUid.current = null;
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
