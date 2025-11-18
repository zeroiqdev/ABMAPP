import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Vehicle } from '@/types';

export default function AddVehicleScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vin: '',
    licensePlate: '',
    make: '',
    model: '',
    year: '',
    color: '',
  });

  const handleSubmit = async () => {
    if (!formData.vin || !formData.licensePlate || !formData.make || !formData.model || !formData.year) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const vehicleData: Omit<Vehicle, 'id'> = {
        userId: user.id,
        vin: formData.vin.toUpperCase(),
        licensePlate: formData.licensePlate.toUpperCase(),
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year),
        color: formData.color || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'vehicles'), vehicleData);
      Alert.alert('Success', 'Vehicle added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error adding vehicle:', error);
      Alert.alert('Error', 'Failed to add vehicle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Vehicle</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <Text style={styles.label}>VIN *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter VIN"
            value={formData.vin}
            onChangeText={(text) => setFormData({ ...formData, vin: text })}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>License Plate *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter license plate"
            value={formData.licensePlate}
            onChangeText={(text) => setFormData({ ...formData, licensePlate: text })}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Make *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Toyota"
            value={formData.make}
            onChangeText={(text) => setFormData({ ...formData, make: text })}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Model *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Camry"
            value={formData.model}
            onChangeText={(text) => setFormData({ ...formData, model: text })}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Year *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2020"
            value={formData.year}
            onChangeText={(text) => setFormData({ ...formData, year: text })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Color</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Black"
            value={formData.color}
            onChangeText={(text) => setFormData({ ...formData, color: text })}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Adding...' : 'Add Vehicle'}
            </Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

