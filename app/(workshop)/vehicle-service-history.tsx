import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { Job, Vehicle, User } from '@/types';
import { format } from 'date-fns';

export default function VehicleServiceHistoryScreen() {
  const router = useRouter();
  const { vehicleId, customerId } = useLocalSearchParams<{ vehicleId: string; customerId: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [vehicleId, customerId]);

  const loadData = async () => {
    if (!vehicleId || !customerId) return;
    try {
      // Load vehicle
      const vehicles = await firebaseService.getVehicles(customerId);
      const vehicleData = vehicles.find(v => v.id === vehicleId);
      if (vehicleData) setVehicle(vehicleData);

      // Load customer
      const customerData = await firebaseService.getUser(customerId);
      if (customerData) setCustomer(customerData);

      // Load jobs for this vehicle
      const allJobs = await firebaseService.getJobs(customerId);
      const vehicleJobs = allJobs.filter(job => job.vehicleId === vehicleId);
      setJobs(vehicleJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Error loading service history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return '#FFA500';
      case 'diagnosed': return '#007AFF';
      case 'repairing': return '#5856D6';
      case 'completed': return '#30D158';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => router.push(`/(workshop)/job-details?id=${item.id}`)}
    >
      <View style={styles.jobHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        <Text style={styles.jobDate}>{format(item.createdAt, 'MMM dd, yyyy')}</Text>
      </View>
      
      <Text style={styles.jobDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      {item.technicianName && (
        <View style={styles.jobMeta}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.jobMetaText}>Technician: {item.technicianName}</Text>
        </View>
      )}
      
      {item.completedAt && (
        <View style={styles.jobMeta}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#30D158" />
          <Text style={styles.jobMetaText}>
            Completed: {format(item.completedAt, 'MMM dd, yyyy')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Vehicle Info */}
      {vehicle && (
        <View style={styles.vehicleInfoCard}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car-sport" size={32} color="#007AFF" />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleName}>
              {vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.vehicleDetails}>
              {vehicle.year} • {vehicle.licensePlate}
            </Text>
            {customer && (
              <Text style={styles.customerName}>
                Owner: {customer.name}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Jobs List */}
      <FlatList
        data={jobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {jobs.length} Service Record{jobs.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No service records found</Text>
          </View>
        }
      />
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
  vehicleInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobDate: {
    fontSize: 12,
    color: '#999',
  },
  jobDescription: {
    fontSize: 16,
    color: '#000',
    marginBottom: 10,
    lineHeight: 22,
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  jobMetaText: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});


