import { create } from 'zustand';
import { User } from '@/types';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { firebaseService } from '@/services/firebaseService';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerCustomerAccount: (email: string, password: string, registrationCode: string) => Promise<void>;
  acceptStaffInvite: (email: string, password: string, invitationCode: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  loading: false,

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
        set({ user: userData, firebaseUser, loading: false });
      } else {
        throw new Error('User data not found');
      }
    } catch (error: any) {
      set({ loading: false });
      throw error;
    }
  },

  // Explicitly for customers redeeming a registration code
  registerCustomerAccount: async (email: string, password: string, registrationCode: string) => {
    set({ loading: true });
    try {
      const registration = await firebaseService.getCustomerRegistrationByCode(registrationCode);

      if (!registration) {
        throw new Error('Invalid or expired registration code');
      }

      if (registration.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        throw new Error('Email does not match the registered email address');
      }

      if (registration.used) {
        throw new Error('This registration code has already been used');
      }

      let firebaseUser;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
      } catch (createError: any) {
        if (createError.code === 'auth/email-already-in-use') {
          // Attempt to sign in to check if this is a "zombie" account (Auth exists, Data missing)
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            firebaseUser = userCredential.user;

            // Check if user data document exists
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              throw createError; // Account actually exists and is complete
            }
            // If data is missing, we proceed with the rest of the signup flow to "repair" it
            console.log('[Signup] Recovering incomplete account for:', email);
          } catch (signInError) {
            throw createError; // Throw original error if sign-in fails or other issue
          }
        } else {
          throw createError;
        }
      }

      // Find existing customer document created by admin (by email)
      // Query directly by email instead of getting all customers (permissions issue)
      let existingCustomer: User | null = null;
      try {
        const usersQuery = query(
          collection(db, 'users'),
          where('email', '==', registration.email.toLowerCase().trim()),
          where('role', '==', 'customer'),
          where('workshopId', '==', registration.workshopId),
          limit(1)
        );
        const usersSnapshot = await getDocs(usersQuery);
        if (!usersSnapshot.empty) {
          const doc = usersSnapshot.docs[0];
          const data = doc.data();
          existingCustomer = {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as User;
        }
      } catch (error) {
        console.log('[Signup] Could not find existing customer (may not exist):', error);
        // Continue without existing customer - this is fine for new signups
      }

      const userData: User = {
        id: firebaseUser.uid,
        email: registration.email,
        name: registration.name,
        phone: registration.phone,
        role: 'customer',
        workshopId: registration.workshopId,
        createdAt: existingCustomer?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      // If existing customer document found, update vehicles to use new Firebase Auth UID
      if (existingCustomer && existingCustomer.id !== firebaseUser.uid) {
        console.log('[Signup] Migrating vehicles from old customer ID:', existingCustomer.id, 'to new UID:', firebaseUser.uid);
        // Get all vehicles with old customer ID
        const oldVehicles = await firebaseService.getVehicles(existingCustomer.id);
        // Update each vehicle to use the new Firebase Auth UID
        for (const vehicle of oldVehicles) {
          await firebaseService.updateVehicle(vehicle.id, { userId: firebaseUser.uid });
        }
        console.log('[Signup] Migrated', oldVehicles.length, 'vehicles to new UID');

        // Delete the old customer document
        await deleteDoc(doc(db, 'users', existingCustomer.id));
        console.log('[Signup] Deleted old customer document:', existingCustomer.id);
      }

      // Create/update user document with Firebase Auth UID
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        createdAt: userData.createdAt,
        updatedAt: new Date(),
      });

      await firebaseService.markRegistrationAsUsed(registration.id);

      set({ user: userData, firebaseUser, loading: false });
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await firebaseService.markStaffInvitationAsUsed(invitation.id);

      set({ user: userData, firebaseUser, loading: false });
    } catch (error: any) {
      set({ loading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
      set({ user: null, firebaseUser: null });
    } catch (error: any) {
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
}));

