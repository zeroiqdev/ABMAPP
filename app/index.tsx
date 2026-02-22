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

// Workshop Roles
const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

export default function Index() {
  const router = useRouter();
  const { user, setGuest } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Wait for Firebase auth to initialize before showing login UI
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthInitialized(true);
      // If user is already authenticated, the _layout.tsx will set user state
      // and the next useEffect will route them
    });
    return () => unsubscribe();
  }, []);

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Prevent multiple routings
  const hasRouted = React.useRef(false);

  useEffect(() => {
    // Only route when auth is initialized and splash is done
    if (isReady && authInitialized && !hasRouted.current) {
      // If we have a Firebase Auth user but no store user yet, wait a bit longer for RootLayout's onSnapshot to fire
      if (auth.currentUser && !user) {
        // We wait for RootLayout to fetch user profile. 
        // Increase timeout to 5s to give more time for cold Firestore starts
        const timeout = setTimeout(() => {
          if (!hasRouted.current && auth.currentUser && !user) {
            // Still no user after 5s, maybe doc doesn't exist? Try to determine role or fallback.
            hasRouted.current = true;
            console.log('[Routing] Timeout waiting for user profile. Falling back to marketplace.');
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
  }, [isReady, authInitialized, user]);

  const routeUser = (userData: any) => {
    console.log('[Routing] User:', userData.email, 'Role:', userData.role); // Debug Log

    // Priority Check for Super Admin (Route to Workshop App)
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
      // System workshop roles
      router.replace('/(workshop)/dashboard');
    } else if (userData.workshopId && userData.role !== 'customer' && userData.role !== 'vendor') {
      // Custom roles: if user has workshopId and is not customer/vendor, route to workshop
      router.replace('/(workshop)/dashboard');
    } else {
      // Fallback -> Default to Customer App for truly unmatched roles
      router.replace('/(customer)/home');
    }
  };


  // ...(useEffect and routeUser remain same)

  // Show splash screen while initializing
  if (!isReady || !authInitialized) {
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



  // Authenticated users are handled by useEffect + routeUser
  // This return is for the brief moment before routing completes
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.6,
    height: width * 0.6,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#000',
  },
  button: {
    backgroundColor: '#000',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#000',
    marginBottom: 20,
    fontSize: 14,
  },
  forgotText: {
    color: '#666',
    fontSize: 14,
  },
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
