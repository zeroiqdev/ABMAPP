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
  const { setUser, setFirebaseUser, setGuest, setProfileLoaded } = useAuthStore();
  const { getEffectiveTheme } = useThemeStore();
  const effectiveTheme = getEffectiveTheme();

  const pushRegisteredForUid = useRef<string | null>(null);
  const lastUserJSON = useRef<string | null>(null);

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;
    let workshopUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged:', firebaseUser?.uid || 'no user');
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        setGuest(false); // Clear guest state immediately if we have a session

        if (userUnsubscribe) userUnsubscribe();
        if (workshopUnsubscribe) workshopUnsubscribe();

        const userRef = doc(db, 'users', firebaseUser.uid);
        console.log('[Auth] Starting user profile snapshot for:', firebaseUser.uid);
        userUnsubscribe = onSnapshot(userRef,
          (userDoc: any) => {
            console.log('[Auth] Profile snapshot fired. Exists:', userDoc.exists());
            if (userDoc.exists()) {
              const data = userDoc.data();
              // Normalize: if vendorStatus exists, the user MUST be treated as a vendor
              const hasVendorStatus = !!data.vendorStatus;
              const isVendorRole = (data.role || '').toLowerCase().trim() === 'vendor';
              
              if (hasVendorStatus && !isVendorRole) {
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
                // Ensure returning users are marked as members for routing
                useAuthStore.getState().setPreferredMode('member');
              }
              console.log('[Auth] User profile loaded successfully');
              setProfileLoaded(true);

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
            } else {
              // User doc doesn't exist yet
              const { isAuthenticating } = useAuthStore.getState();
              if (isAuthenticating) {
                // We're in the middle of signup/login — the doc may not exist yet.
                // Do NOT wipe user state. Just wait for the next snapshot.
                console.log('[Auth] Doc not found but isAuthenticating=true, skipping wipe');
                return;
              }
              console.log('[Auth] User document does not exist for UID:', firebaseUser.uid);
              setUser(null);
              setGuest(true);
              setProfileLoaded(true);
            }
          },
          (error: any) => {
            console.error('[Auth] Error listening to user data:', error);
            // DO NOT clear user/guest state here. 
            // If we have a firebaseUser, we should keep whatever is in the store (from hydration)
            // while we continue to retry or wait.
            setProfileLoaded(true);
          }
        );

      } else {
        console.log('[Auth] No Firebase user detected, resetting state');
        setFirebaseUser(null);
        setUser(null);
        lastUserJSON.current = null;
        pushRegisteredForUid.current = null;
        if (workshopUnsubscribe) workshopUnsubscribe();
        setProfileLoaded(false);
      }
    });

    return () => {
      console.log('[Auth] Unsubscribing from listeners');
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
      if (workshopUnsubscribe) workshopUnsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(workshop)" />
        <Stack.Screen name="(marketplace)" />
        <Stack.Screen name="(super-admin)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
