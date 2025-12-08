import { create } from 'zustand';
import { User } from '@/types';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { firebaseService } from '@/services/firebaseService';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, registrationCode: string) => Promise<void>;
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

  signup: async (email: string, password: string, registrationCode: string) => {
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

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userData: User = {
        id: firebaseUser.uid,
        email: registration.email,
        name: registration.name,
        phone: registration.phone,
        role: 'customer',
        workshopId: registration.workshopId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        createdAt: new Date(),
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

