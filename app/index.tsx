import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/design';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import CustomAlertModal from '@/components/CustomAlertModal';

const LOGO_URL = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1759821531/Screenshot_2025-10-07_at_8.08.13_AM-removebg-preview_g8za2u.png';
const { width } = Dimensions.get('window');

// Workshop Roles
const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

export default function Index() {
  const router = useRouter();
  const { user, isGuest, setGuest, setGuestEmail } = useAuthStore();
  const [isReady, setIsReady] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [loading, setLoading] = useState(false);

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

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

  useEffect(() => {
    // Only route when auth is initialized, ready, and not loading
    if (isReady && authInitialized && user && !loading) {
      routeUser(user);
    } else if (isReady && authInitialized && !user && !loading && isGuest && step === 'email') {
      // Only route to guest home if we are in the landing state and not trying to log in
      router.replace('/(marketplace)/home');
    }
  }, [isReady, authInitialized, user, isGuest, step, loading]);

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

  // ... (useEffect and routeUser remain same)

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    // ... (rest of handleEmailSubmit logic, replacing specific Alerts with showAlert if desired, but user specifically asked for "incorrect credentials" which is login)
    // For consistency, I'll stick to Alert.alert for non-login flows unless requested, BUT the user request was "when a user enters wrong login credentials".
    // I will focus on handleLogin first.

    setLoading(true);
    try {
      // Check for Invitations or registrations first (these have public read access)
      const invitesRef = collection(db, 'staffInvitations');
      const inviteQ = query(invitesRef, where('email', '==', email.toLowerCase().trim()));
      const inviteSnap = await getDocs(inviteQ);

      const registrationsRef = collection(db, 'customerRegistrations');
      const regQ = query(registrationsRef, where('email', '==', email.toLowerCase().trim()));
      const regSnap = await getDocs(regQ);

      let hasPendingInvite = false;
      let hasUsedInvite = false;
      let hasPendingReg = false;
      let hasUsedReg = false;

      inviteSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.used === false) hasPendingInvite = true;
        else hasUsedInvite = true;
      });

      regSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.used === false) hasPendingReg = true;
        else hasUsedReg = true;
      });

      if (hasPendingInvite) {
        Alert.alert('Welcome!', 'You have been invited. Please complete your registration using the code sent to your email.', [
          { text: 'OK', onPress: () => router.push('/(auth)/staff-invite') }
        ]);
        setLoading(false);
        return;
      }

      if (hasPendingReg) {
        Alert.alert('Welcome!', 'You have been invited as a customer. Please complete your registration using the code sent to your email.', [
          {
            text: 'OK',
            onPress: () => router.push({
              pathname: '/(auth)/signup',
              params: { email: email.toLowerCase().trim() }
            })
          }
        ]);
        setLoading(false);
        return;
      }

      if (hasUsedInvite || hasUsedReg) {
        // User has a record - show password field
        setStep('password');
        setLoading(false);
        return;
      }

      // Default for no account/invite found
      setGuestEmail(email.toLowerCase().trim());
      setGuest(true);
      router.replace('/(marketplace)/home');
      setLoading(false);
      return;

    } catch (error) {
      console.error('Error checking email:', error);
      showAlert('Error', 'Failed to verify email. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Explicitly check for user document to catch "Zombie" users or permission errors
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        showAlert('Login Error', 'User profile not found in database. Please contact support.');
        setLoading(false);
        return;
      }

      // If we reach here, user exists.
      const userData = userDocSnap.data();
      console.log('[Login] Force Routing:', userData.role);
      routeUser(userData);  // <--- FORCE ROUTE
      setLoading(false);
    } catch (error: any) {
      // Map Firebase Errors to User Friendly Message
      let msg = 'Invalid email or password.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Incorrect email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please try again later.';
      }

      showAlert('Login Failed', msg);
      setLoading(false);
    }
  };

  // ...

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.contentContainer}>
        {/* Re-implementing the existing UI exactly as is, just need reference to previous Step */}
        {step === 'email' ? (
          // ... email step
          <>
            <View style={styles.inputContainer}>
              <Text style={[styles.subtitle, { marginBottom: 8, textAlign: 'left', alignSelf: 'flex-start' }]}>Enter your email to get started</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                placeholderTextColor="#666"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleEmailSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 20, padding: 10 }}
              onPress={() => {
                setStep('password');
              }}
            >
              <Text style={styles.linkText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ... password step
          <>
            <View style={{ width: '100%', alignItems: 'flex-start', marginBottom: 20 }}>
              <TouchableOpacity onPress={() => setStep('email')} style={{ padding: 10, marginLeft: -10 }}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.title, { alignSelf: 'flex-start' }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { alignSelf: 'flex-start', textAlign: 'left' }]}>Log in to your account</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                placeholderTextColor="#666"
              />
            </View>

            <View style={[styles.inputContainer, { marginTop: 0 }]}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#666"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <CustomAlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
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
