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
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Workshop } from '@/types';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialEmail = params.email as string;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { registerCustomerAccount, loading, user } = useAuthStore();

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Load workshops on mount
  useEffect(() => {
    loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    setLoadingWorkshops(true);
    try {
      const allWorkshops = await firebaseService.getAllWorkshops();
      setWorkshops(allWorkshops);
    } catch (error) {
      console.error('Error loading workshops:', error);
    } finally {
      setLoadingWorkshops(false);
    }
  };

  const filteredWorkshops = workshops.filter(w =>
    w.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (user) {
      console.log('[Signup] User created:', user.email, 'Role:', user.role, 'WorkshopId:', user.workshopId);

      const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

      if (user.role === 'vendor') {
        router.replace('/(marketplace)/vendor-registration');
        return;
      }

      if (user.vendorStatus) {
        router.replace('/(marketplace)/vendor-registration');
        return;
      }

      if (user.role === 'customer') {
        router.replace('/(customer)/home');
      } else if (workshopRoles.includes(user.role)) {
        router.replace('/(workshop)/dashboard');
      } else if (user.workshopId && user.role !== 'customer' && user.role !== 'vendor') {
        router.replace('/(workshop)/dashboard');
      } else {
        router.replace('/');
      }
    }
  }, [user, router]);

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Email, Password)');
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
      await registerCustomerAccount(email, password, name, phone, selectedWorkshop?.id);
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
          <Text style={styles.subtitle}>Sign up to access workshop services</Text>

          <View style={styles.form}>
            {/* Name Field */}
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor="#666"
            />

            {/* Phone Field */}
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#666"
            />

            {/* Email Field */}
            <TextInput
              style={styles.input}
              placeholder="Email Address *"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#666"
              autoComplete="email"
            />

            {/* Workshop Selector */}
            <TouchableOpacity
              style={styles.workshopSelector}
              onPress={() => setShowWorkshopModal(true)}
            >
              <Ionicons name="business-outline" size={20} color="#666" />
              <Text style={[styles.workshopSelectorText, selectedWorkshop && styles.workshopSelected]}>
                {selectedWorkshop ? selectedWorkshop.name : 'Select a Workshop (Optional)'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            {/* Password Fields */}
            <TextInput
              style={styles.input}
              placeholder="Password *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="oneTimeCode"
              autoComplete="off"
              placeholderTextColor="#666"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password *"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="oneTimeCode"
              autoComplete="off"
              placeholderTextColor="#666"
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

      {/* Workshop Selection Modal */}
      <Modal
        visible={showWorkshopModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWorkshopModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Workshop</Text>
            <TouchableOpacity onPress={() => setShowWorkshopModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search workshops..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666"
          />

          {loadingWorkshops ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredWorkshops}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.workshopItem}
                  onPress={() => {
                    setSelectedWorkshop(item);
                    setShowWorkshopModal(false);
                    setSearchQuery('');
                  }}
                >
                  <View>
                    <Text style={styles.workshopName}>{item.name}</Text>
                    {item.address && (
                      <Text style={styles.workshopAddress}>{item.address}</Text>
                    )}
                  </View>
                  {selectedWorkshop?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No workshops found' : 'No workshops available'}
                </Text>
              }
            />
          )}

          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSelectedWorkshop(null);
              setShowWorkshopModal(false);
            }}
          >
            <Text style={styles.clearButtonText}>Skip - I'll join a workshop later</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
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
    color: '#000',
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
  // Workshop selector styles
  workshopSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    gap: 10,
  },
  workshopSelectorText: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },
  workshopSelected: {
    color: '#000',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#000',
  },
  workshopItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  workshopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  workshopAddress: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 'auto',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

