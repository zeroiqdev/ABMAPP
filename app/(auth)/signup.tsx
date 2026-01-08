import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialEmail = params.email as string;

  const [email, setEmail] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { registerCustomerAccount, acceptStaffInvite, loading, user } = useAuthStore();

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (user) {
      console.log('[Signup] User created:', user.email, 'Role:', user.role, 'VendorStatus:', user.vendorStatus);

      const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];

      // CRITICAL: If role is vendor, go directly to registration form - never customer app, never home screen
      if (user.role === 'vendor') {
        // All vendors (invited or otherwise) go to registration form first
        // Only approved vendors (active status) should see home screen, but that's handled by marketplace layout
        router.replace('/(marketplace)/vendor-registration');
        return;
      }

      // Also check vendorStatus as a fallback (in case role isn't set correctly)
      if (user.vendorStatus) {
        // This is a vendor - redirect to registration form, never customer app
        router.replace('/(marketplace)/vendor-registration');
        return;
      }

      if (user.role === 'customer') {
        router.replace('/(customer)/home');
      } else if (workshopRoles.includes(user.role)) {
        router.replace('/(workshop)/dashboard');
      } else {
        // Fallback
        router.replace('/(auth)/login');
      }
    }
  }, [user, router]);

  const handleSignup = async () => {
    if (!email || !registrationCode || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await registerCustomerAccount(email, password, registrationCode);
    } catch (error: any) {
      let errorMessage = 'Unable to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Signup Failed', errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Enter your registered email and code</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <TextInput
              style={styles.input}
              placeholder="Registration Code"
              value={registrationCode}
              onChangeText={setRegistrationCode}
              autoCapitalize="characters"
              autoComplete="off"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="oneTimeCode"
              autoComplete="off"
              importantForAutofill="no"
              passwordRules=""
              keyboardType="default"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="oneTimeCode"
              autoComplete="off"
              importantForAutofill="no"
              passwordRules=""
              keyboardType="default"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.staffLinkContainer}
              onPress={() => router.push('/(auth)/staff-invite')}
            >
              <Text style={styles.staffLinkText}>Are you a Vendor or Staff? Register here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  staffLinkContainer: {
    marginTop: 20,
    alignItems: 'center',
    padding: 10,
  },
  staffLinkText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

