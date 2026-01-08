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
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor'];
      if (user.role === 'customer') {
        router.replace('/(customer)/home');
      } else if (user.role === 'vendor') {
        router.replace('/(marketplace)/home');
      } else if (workshopRoles.includes(user.role)) {
        router.replace('/(workshop)/dashboard');
      }
    }
  }, [user, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await login(email, password);
    } catch (error: any) {
      let errorMessage = 'Invalid credentials';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Login Failed', errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
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

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.staffInviteLink}
              onPress={() => router.push('/(auth)/staff-invite')}
            >
              <Text style={styles.staffInviteText}>Have a staff invite code?</Text>
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#000',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
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
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  staffInviteLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  staffInviteText: {
    fontSize: 13,
    color: '#999',
  },
});

