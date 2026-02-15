import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  OAuthProvider,
  signInWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { firebaseService } from '@/services/firebaseService';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isGuest: boolean;
  guestEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithApple: () => Promise<void>;
  registerCustomerAccount: (email: string, password: string, name?: string, phone?: string, workshopId?: string) => Promise<void>;
  acceptStaffInvite: (email: string, password: string, invitationCode: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setGuest: (isGuest: boolean) => void;
  setGuestEmail: (email: string | null) => void;
  switchWorkshop: (workshopId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      firebaseUser: null,
      loading: false,
      isGuest: false,
      guestEmail: null,

      login: async (email: string, password: string) => {
        set({ loading: true });
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userData: User = {
              ...data,
              id: userDoc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as User;
            // Clear guest state on successful login
            set({ user: userData, firebaseUser, loading: false, isGuest: false, guestEmail: null });
          } else {
            throw new Error('User data not found');
          }
        } catch (error: any) {
          set({ loading: false });
          throw error;
        }
      },

      loginWithApple: async () => {
        set({ loading: true });
        try {
          // Generate a nonce for security
          const nonce = Math.random().toString(36).substring(2, 10);
          const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            nonce
          );

          // Request Apple credentials
          const appleCredential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });

          const { identityToken } = appleCredential;
          if (!identityToken) {
            throw new Error('No identity token received from Apple');
          }

          // Build Firebase credential
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: identityToken,
            rawNonce: nonce,
          });

          // Sign in to Firebase
          const userCredential = await signInWithCredential(auth, credential);
          const firebaseUser = userCredential.user;

          // Check if user doc exists
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          let userData: User;
          if (userDoc.exists()) {
            // Existing user — load their data
            const data = userDoc.data();
            userData = {
              ...data,
              id: userDoc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as User;
          } else {
            // New user — create their profile
            const appleName = appleCredential.fullName
              ? `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim()
              : '';
            const newUserData = {
              id: firebaseUser.uid,
              name: appleName || firebaseUser.displayName || 'Apple User',
              email: appleCredential.email || firebaseUser.email || '',
              phone: '',
              role: 'customer',
              workshopId: '',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };
            await setDoc(userDocRef, newUserData);
            userData = {
              ...newUserData,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as User;
          }

          set({ user: userData, firebaseUser, loading: false, isGuest: false, guestEmail: null });
        } catch (error: any) {
          set({ loading: false });
          // User cancelled Apple sign-in — don't re-throw
          if (error.code === 'ERR_REQUEST_CANCELED') {
            return;
          }
          throw error;
        }
      },

      // Customer signup - accepts name, phone, workshopId from signup form
      // Also looks up existing customer records by email to auto-link additional workshops
      registerCustomerAccount: async (email: string, password: string, name?: string, phone?: string, selectedWorkshopId?: string) => {
        set({ loading: true });
        try {
          const normalizedEmail = email.toLowerCase().trim();

          // Find ALL existing customer records with this email (across all workshops)
          let existingCustomers: { id: string; workshopId: string; name?: string; phone?: string }[] = [];
          try {
            const usersQuery = query(
              collection(db, 'users'),
              where('email', '==', normalizedEmail),
              where('role', '==', 'customer')
            );
            const usersSnapshot = await getDocs(usersQuery);
            existingCustomers = usersSnapshot.docs.map(d => ({
              id: d.id,
              workshopId: d.data().workshopId,
              name: d.data().name,
              phone: d.data().phone,
            }));
            console.log('[Signup] Found', existingCustomers.length, 'existing customer records for:', normalizedEmail);
          } catch (error) {
            console.log('[Signup] Could not query existing customers:', error);
          }

          // Collect all workshopIds: start with user-selected workshop, then add from existing records
          const workshopIds: string[] = [];
          if (selectedWorkshopId) {
            workshopIds.push(selectedWorkshopId);
          }
          for (const c of existingCustomers) {
            if (c.workshopId && !workshopIds.includes(c.workshopId)) {
              workshopIds.push(c.workshopId);
            }
          }

          // Use provided name/phone, fallback to existing record if not provided
          const finalName = name || existingCustomers.find(c => c.name)?.name || '';
          const finalPhone = phone || existingCustomers.find(c => c.phone)?.phone || '';

          let firebaseUser;
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            firebaseUser = userCredential.user;
          } catch (createError: any) {
            if (createError.code === 'auth/email-already-in-use') {
              // Account exists. Try to sign in to link workshops.
              try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                firebaseUser = userCredential.user;

                // Check if user data document exists
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                  // Existing user: Update connected workshops
                  const existingUserData = userDoc.data() as User;
                  const currentConnected = existingUserData.connectedWorkshopIds || [existingUserData.workshopId || ''];

                  // Add any new workshops from customer records or selected workshop
                  for (const wsId of workshopIds) {
                    if (wsId && !currentConnected.includes(wsId)) {
                      currentConnected.push(wsId);
                    }
                  }

                  // Update user with all connected workshops and new name/phone if provided
                  await setDoc(doc(db, 'users', firebaseUser.uid), {
                    ...existingUserData,
                    name: finalName || existingUserData.name,
                    phone: finalPhone || existingUserData.phone,
                    connectedWorkshopIds: currentConnected.filter(Boolean),
                    workshopId: currentConnected[0] || existingUserData.workshopId,
                    updatedAt: new Date(),
                  }, { merge: true });

                  // Update local state
                  const updatedUser = {
                    ...existingUserData,
                    name: finalName || existingUserData.name,
                    phone: finalPhone || existingUserData.phone,
                    connectedWorkshopIds: currentConnected.filter(Boolean),
                    workshopId: currentConnected[0] || existingUserData.workshopId,
                  };
                  set({ user: updatedUser, firebaseUser, loading: false, isGuest: false, guestEmail: null });
                  return; // Done
                }

                // If data is missing (zombie account), proceed to create fresh below
                console.log('[Signup] Recovering incomplete account for:', email);
              } catch (signInError) {
                throw new Error('Account exists. Please use correct password to sign in.');
              }
            } else {
              throw createError;
            }
          }

          // Build user data
          const userData: User = {
            id: firebaseUser.uid,
            email: normalizedEmail,
            name: finalName,
            phone: finalPhone,
            role: 'customer',
            workshopId: workshopIds[0] || '', // First workshop as active, or empty if none
            connectedWorkshopIds: workshopIds.length > 0 ? workshopIds : [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // If existing customer documents found, migrate vehicles and delete old records
          for (const existing of existingCustomers) {
            if (existing.id !== firebaseUser.uid) {
              console.log('[Signup] Migrating data from old customer ID:', existing.id);
              try {
                const oldVehicles = await firebaseService.getVehicles(existing.id);
                for (const vehicle of oldVehicles) {
                  await firebaseService.updateVehicle(vehicle.id, { userId: firebaseUser.uid });
                }
                console.log('[Signup] Migrated', oldVehicles.length, 'vehicles from', existing.id);
                // Delete the old customer document
                await deleteDoc(doc(db, 'users', existing.id));
                console.log('[Signup] Deleted old customer document:', existing.id);
              } catch (migrationError) {
                console.warn('[Signup] Migration error for', existing.id, migrationError);
              }
            }
          }

          // Create user document with Firebase Auth UID
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            ...userData,
            createdAt: userData.createdAt,
            updatedAt: new Date(),
          });

          set({ user: userData, firebaseUser, loading: false, isGuest: false, guestEmail: null });
        } catch (error: any) {
          set({ loading: false });
          throw error;
        }
      },

      acceptStaffInvite: async (email: string, password: string, invitationCode: string) => {
        set({ loading: true });
        try {
          const invitation = await firebaseService.getStaffInvitationByCode(invitationCode);

          if (!invitation) {
            throw new Error('Invalid or expired invitation code');
          }

          if (invitation.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
            throw new Error('Email does not match the invited email address');
          }

          if (invitation.used) {
            throw new Error('This invitation code has already been used');
          }

          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          const userData: User = {
            id: firebaseUser.uid,
            email: invitation.email,
            name: invitation.name,
            phone: invitation.phone || '',
            role: invitation.role,
            workshopId: invitation.workshopId,
            ...(invitation.role === 'vendor' ? { vendorStatus: 'pending_details' } : {}),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await setDoc(doc(db, 'users', firebaseUser.uid), {
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await firebaseService.markStaffInvitationAsUsed(invitation.id);

          set({ user: userData, firebaseUser, loading: false, isGuest: false, guestEmail: null });
        } catch (error: any) {
          set({ loading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
          set({ user: null, firebaseUser: null, isGuest: false, guestEmail: null });
        } catch (error: any) {
          throw error;
        }
      },

      deleteAccount: async () => {
        set({ loading: true });
        try {
          await firebaseService.deleteAccount();
          set({ user: null, firebaseUser: null, isGuest: false, guestEmail: null, loading: false });
        } catch (error: any) {
          set({ loading: false });
          throw error;
        }
      },

      resetPassword: async (email: string) => {
        try {
          await sendPasswordResetEmail(auth, email);
        } catch (error: any) {
          throw error;
        }
      },

      setUser: (user: User | null) => set({ user }),
      setFirebaseUser: (user: FirebaseUser | null) => set({ firebaseUser: user }),
      setGuest: (isGuest: boolean) => set({ isGuest }),
      setGuestEmail: (email: string | null) => set({ guestEmail: email }),

      switchWorkshop: async (workshopId: string) => {
        const { user } = useAuthStore.getState(); // or get() if inside
        // getState() works, but better to use `get().user` if accessible. 
        // Inside create(), `set` is passed, `get` is second arg.
        // I need to change the signature of create to include get.
        // Actually, I can just rely on `user` from `auth.currentUser` or `set((state) => ...)`

        // Let's rely on Firebase Auth UID and direct update
        if (!auth.currentUser) return;

        set({ loading: true });
        try {
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            workshopId: workshopId,
            updatedAt: new Date()
          }, { merge: true });

          // Local state update will happen automatically via onSnapshot in _layout
          // But we can optimistically update too
          set((state) => ({
            user: state.user ? { ...state.user, workshopId } : null,
            loading: false
          }));
        } catch (error) {
          console.error('Failed to switch workshop:', error);
          set({ loading: false });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isGuest: state.isGuest,
        guestEmail: state.guestEmail
      }),
    }
  )
);

