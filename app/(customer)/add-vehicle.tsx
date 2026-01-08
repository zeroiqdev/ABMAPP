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
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Vehicle } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { CAR_BRANDS } from '@/constants/carBrands';
import { BrandLogo } from '@/components/BrandLogo';

export default function AddVehicleScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vin: '',
    licensePlate: '',
    make: '',
    model: '',
    year: '',
    color: '',
  });

  // Brand Selection State
  const [isBrandSelectionMode, setIsBrandSelectionMode] = useState(false);
  const [searchBrandQuery, setSearchBrandQuery] = useState('');

  const filteredBrands = CAR_BRANDS.filter(b =>
    b.name.toLowerCase().includes(searchBrandQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!formData.licensePlate || !formData.make || !formData.model || !formData.year) {
      Alert.alert('Error', 'Please fill in required fields');
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
        vin: formData.vin ? formData.vin.toUpperCase() : 'N/A',
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
        <TouchableOpacity
          onPress={() => {
            if (isBrandSelectionMode) {
              setIsBrandSelectionMode(false);
            } else {
              router.back();
            }
          }}
        >
          <Text style={styles.backButton}>{isBrandSelectionMode ? 'Back' : 'Cancel'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isBrandSelectionMode ? 'Select Make' : 'Add Vehicle'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {isBrandSelectionMode ? (
        <View style={styles.content}>
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <TextInput
              style={styles.input}
              placeholder="Search or Enter Custom Brand..."
              value={searchBrandQuery}
              onChangeText={setSearchBrandQuery}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredBrands}
            keyExtractor={(item) => item.name}
            contentContainerStyle={{ padding: 20 }}
            ListHeaderComponent={() => (
              searchBrandQuery.length > 0 ? (
                <TouchableOpacity
                  style={[styles.brandItem, { borderBottomWidth: 2, borderBottomColor: '#f0f0f0' }]}
                  onPress={() => {
                    setFormData({ ...formData, make: searchBrandQuery });
                    setIsBrandSelectionMode(false);
                    setSearchBrandQuery('');
                  }}
                >
                  <Ionicons name="create-outline" size={24} color="#000" style={{ marginRight: 12 }} />
                  <Text style={[styles.brandName, { fontWeight: '600' }]}>Use "{searchBrandQuery}"</Text>
                </TouchableOpacity>
              ) : null
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.brandItem}
                onPress={() => {
                  setFormData({ ...formData, make: item.name });
                  setIsBrandSelectionMode(false);
                  setSearchBrandQuery('');
                }}
              >
                <BrandLogo brand={item.name} size={28} style={{ marginRight: 12 }} />
                <Text style={styles.brandName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.form}>

            <TouchableOpacity
              style={styles.selector}
              onPress={() => setIsBrandSelectionMode(true)}
            >
              <Text style={formData.make ? styles.value : styles.placeholder}>
                {formData.make || 'Select Make *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Model (e.g. Camry) *"
              placeholderTextColor="#999"
              value={formData.model}
              onChangeText={(text) => setFormData({ ...formData, model: text })}
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              placeholder="Year *"
              placeholderTextColor="#999"
              value={formData.year}
              onChangeText={(text) => setFormData({ ...formData, year: text })}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="License Plate *"
              placeholderTextColor="#999"
              value={formData.licensePlate}
              onChangeText={(text) => setFormData({ ...formData, licensePlate: text })}
              autoCapitalize="characters"
            />

            <TextInput
              style={styles.input}
              placeholder="VIN (Optional)"
              placeholderTextColor="#999"
              value={formData.vin}
              onChangeText={(text) => setFormData({ ...formData, vin: text })}
              autoCapitalize="characters"
            />

            <TextInput
              style={styles.input}
              placeholder="Color (Optional)"
              placeholderTextColor="#999"
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
      )}
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
    color: '#000',
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
  input: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#000',
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  value: {
    fontSize: 16,
    color: '#000',
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
  },
  submitButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  brandName: {
    fontSize: 16,
    color: '#000',
  },
});

