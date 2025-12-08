import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuthStore } from '@/store/authStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User } from '@/types';

export default function RootLayout() {
  const { setUser, setFirebaseUser } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userData: User = {
              ...data,
              id: userDoc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as User;
            setUser(userData);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(workshop)" />
        <Stack.Screen name="(marketplace)" />
      </Stack>
    </>
  );
}

