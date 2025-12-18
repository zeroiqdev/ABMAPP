import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User, Vehicle } from '@/types';
import { format } from 'date-fns';
import { CAR_BRANDS } from '@/constants/carBrands';
import { BrandLogo } from '@/components/BrandLogo';

export default function CustomerDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string; email?: string; phone?: string; createdAt?: string; workshopId?: string; role?: string }>();
  const id = params.id;
  const { user } = useAuthStore();

  // Initialize from params if available to provide instant UI
  const initialCustomer = params.name ? {
    id: params.id,
    name: params.name,
    email: params.email || '',
    phone: params.phone || '',
    workshopId: params.workshopId || '',
    role: (params.role || 'customer') as any,
    createdAt: params.createdAt ? new Date(params.createdAt) : new Date(),
    updatedAt: new Date(),
  } as User : null;

  const [customer, setCustomer] = useState<User | null>(initialCustomer);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(!initialCustomer);
  const [refreshing, setRefreshing] = useState(false);
  const [registrationCode, setRegistrationCode] = useState<string | null>(null);

  // Vehicle Creation State
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    vin: '',
  });
  const [isBrandSelectionMode, setIsBrandSelectionMode] = useState(false);
  const [searchBrandQuery, setSearchBrandQuery] = useState('');

  const filteredBrands = CAR_BRANDS.filter(b =>
    b.name.toLowerCase().includes(searchBrandQuery.toLowerCase())
  );

  useEffect(() => {
    if (id) {
      // Only show full screen loader if we don't have customer data provided via params
      if (!customer || customer.id !== id) {
        setLoading(true);
        setCustomer(null);
        setVehicles([]);
      }
      loadCustomerDetails();
    }
  }, [id]);

  const loadCustomerDetails = async () => {
    if (!id) return;
    try {
      const customerData = await firebaseService.getUser(id);
      if (customerData) {
        setCustomer(customerData);
        // We can fetch vehicles in parallel or after
        const vehiclesData = await firebaseService.getVehicles(id);
        setVehicles(vehiclesData);

        // Fetch registration code
        try {
          if (customerData.workshopId && customerData.email) {
            // Use the new helper function for better email matching
            const registration = await firebaseService.getCustomerRegistrationByEmail(
              customerData.email,
              customerData.workshopId
            );
            if (registration) {
              setRegistrationCode(registration.registrationCode);
            }
          }
        } catch (error: any) {
          const message = error?.message || '';
          if (message.includes('The query requires an index')) {
            // Skip failing the screen if index is missing; registration code will remain hidden
            console.warn('Registration code lookup skipped due to missing Firestore index.');
          } else {
            console.error('Error loading registration code:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomerDetails();
    setRefreshing(false);
  };

  const handleCreateVehicle = async () => {
    if (!customer || !newVehicle.make || !newVehicle.model || !newVehicle.licensePlate) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }
    setLoading(true);
    try {
      const vehicleData = {
        ...newVehicle,
        year: parseInt(newVehicle.year) || new Date().getFullYear(),
        userId: customer.id, // This should match the customer's user ID in auth
        vin: newVehicle.vin || 'N/A',
      };
      console.log('[Admin] Creating vehicle for customer ID:', customer.id, 'Email:', customer.email);
      console.log('[Admin] Vehicle data:', vehicleData);
      const id = await firebaseService.addVehicle(vehicleData as any);
      console.log('[Admin] Vehicle created successfully with ID:', id, 'userId set to:', vehicleData.userId);
      const createdVehicle = { id, ...vehicleData } as Vehicle;
      setVehicles([createdVehicle, ...vehicles]);
      setShowVehicleModal(false);
      setNewVehicle({ make: '', model: '', year: '', licensePlate: '', vin: '' });
      Alert.alert('Success', 'Vehicle added successfully');
    } catch (error) {
      console.error('Error creating vehicle:', error);
      Alert.alert('Error', 'Failed to create vehicle');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(workshop)/customers')}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Customer not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(workshop)/customers')}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {customer.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.customerName}>{customer.name}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <Text style={styles.infoText}>{customer.email}</Text>
          </View>

          {customer.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{customer.phone}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.infoText}>
              Joined {customer.createdAt && customer.createdAt instanceof Date
                ? format(customer.createdAt, 'MMM dd, yyyy')
                : customer.createdAt
                  ? format(new Date(customer.createdAt), 'MMM dd, yyyy')
                  : 'N/A'}
            </Text>
          </View>

          {registrationCode && (
            <View style={styles.infoRow}>
              <Ionicons name="key-outline" size={20} color="#666" />
              <Text style={styles.infoText}>Registration Code: {registrationCode}</Text>
            </View>
          )}
        </View>

        {/* Vehicles Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicles ({vehicles.length})</Text>
            <TouchableOpacity
              onPress={() => setShowVehicleModal(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No vehicles registered</Text>
            </View>
          ) : (
            vehicles.map((vehicle) => {
              const brand = CAR_BRANDS.find(b => b.name.toLowerCase() === vehicle.make.toLowerCase());
              return (
                <TouchableOpacity
                  key={vehicle.id}
                  style={styles.vehicleCard}
                  onPress={() => router.push(`/(workshop)/vehicle-service-history?vehicleId=${vehicle.id}&customerId=${customer.id}`)}
                >
                  <View style={styles.vehicleIcon}>
                    {brand ? (
                      <BrandLogo brand={brand.name} size={28} />
                    ) : (
                      <Ionicons name="car-sport" size={28} color="#000" />
                    )}
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>
                      {vehicle.make} {vehicle.model}
                    </Text>
                    <Text style={styles.vehicleDetails}>
                      {vehicle.year} • {vehicle.licensePlate}
                    </Text>
                    {vehicle.vin && vehicle.vin !== 'N/A' && (
                      <Text style={styles.vehicleVin}>VIN: {vehicle.vin}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={showVehicleModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={isBrandSelectionMode ? () => setIsBrandSelectionMode(false) : () => {
              setShowVehicleModal(false);
              setNewVehicle({ make: '', model: '', year: '', licensePlate: '', vin: '' });
            }}>
              <Text style={styles.closeText}>{isBrandSelectionMode ? 'Back' : 'Close'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isBrandSelectionMode ? 'Select Make' : 'Add Vehicle'}</Text>
            <View style={{ width: 40 }} />
          </View>

          {isBrandSelectionMode ? (
            <View style={{ flex: 1, padding: 20 }}>
              <TextInput
                style={styles.input}
                placeholder="Search or Enter Custom Brand..."
                value={searchBrandQuery}
                onChangeText={setSearchBrandQuery}
                autoFocus
              />
              <FlatList
                data={filteredBrands}
                keyExtractor={(item) => item.name}
                ListHeaderComponent={() => (
                  searchBrandQuery.length > 0 ? (
                    <TouchableOpacity
                      style={[styles.brandItem, { borderBottomWidth: 2, borderBottomColor: '#f0f0f0' }]}
                      onPress={() => {
                        setNewVehicle({ ...newVehicle, make: searchBrandQuery });
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
                      setNewVehicle({ ...newVehicle, make: item.name });
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
            <ScrollView style={styles.modalForm} contentContainerStyle={{ padding: 20 }}>
              <View style={{ marginBottom: 20 }}>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setIsBrandSelectionMode(true)}
                >
                  <Text style={newVehicle.make ? styles.value : styles.placeholder}>
                    {newVehicle.make || 'Select Make'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={{ marginBottom: 20 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Model (e.g. Camry)"
                  placeholderTextColor="#999"
                  value={newVehicle.model}
                  onChangeText={(t) => setNewVehicle({ ...newVehicle, model: t })}
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Year"
                  placeholderTextColor="#999"
                  value={newVehicle.year}
                  onChangeText={(t) => setNewVehicle({ ...newVehicle, year: t })}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <TextInput
                  style={styles.input}
                  placeholder="License Plate"
                  placeholderTextColor="#999"
                  value={newVehicle.licensePlate}
                  onChangeText={(t) => setNewVehicle({ ...newVehicle, licensePlate: t })}
                />
              </View>

              <View style={{ marginBottom: 20 }}>
                <TextInput
                  style={styles.input}
                  placeholder="VIN (Optional)"
                  placeholderTextColor="#999"
                  value={newVehicle.vin}
                  onChangeText={(t) => setNewVehicle({ ...newVehicle, vin: t })}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleCreateVehicle}>
                <Text style={styles.primaryButtonText}>Add Vehicle</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  customerCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    gap: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
  },
  vehicleIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  vehicleVin: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalForm: {
    padding: 20,
  },
  input: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#000',
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  value: {
    fontSize: 16,
    color: '#000',
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  fieldDescription: {
    fontSize: 13,
    color: '#444',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  brandLogoSmall: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  brandName: {
    fontSize: 16,
    color: '#000',
  },
});

