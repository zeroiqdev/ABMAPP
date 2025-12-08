import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Job, Vehicle } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export default function JobsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [user]);

  useEffect(() => {
    filterJobs();
  }, [jobs, filter, searchQuery]);

  const loadJobs = async () => {
    if (!user?.workshopId) return;
    try {
      const jobsData = await firebaseService.getJobs(undefined, user.workshopId);
      setJobs(jobsData);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const filterJobs = () => {
    let result = jobs;

    // Status Filter
    if (filter === 'active') {
      result = result.filter(j => ['received', 'diagnosed', 'repairing'].includes(j.status));
    } else if (filter === 'completed') {
      result = result.filter(j => j.status === 'completed');
    }

    // Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.description.toLowerCase().includes(query) ||
        j.id.toLowerCase().includes(query) ||
        (j.technicianName && j.technicianName.toLowerCase().includes(query))
      );
    }

    setFilteredJobs(result);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My Tasks</Text>
          <TouchableOpacity onPress={() => router.push('/(workshop)/create-job')}>
            <Ionicons name="notifications-outline" size={24} color="#000" />
            {/* Using notification icon as placeholder for 'Add' or keep Add? 
                The image has a notification bell. 
                I'll add a separate Add button or use the FAB style. 
                Let's put a + icon next to it or replace it. 
                Actually, let's keep the bell and put a FAB or a header action for Create.
                The user wants to create jobs. I'll add a + button.
            */}
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="By car name/registration number"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.filterContainer}>
          <FilterPill label="All Status" active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterPill label="Active" active={filter === 'active'} onPress={() => setFilter('active')} />
          <FilterPill label="Completed" active={filter === 'completed'} onPress={() => setFilter('completed')} />
        </View>
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={({ item }) => <JobCard job={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No jobs found</Text>
          </View>
        }
      />

      {/* Floating Action Button for Create Job */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(workshop)/create-job')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function JobCard({ job }: { job: Job }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicle();
  }, [job.vehicleId]);

  const loadVehicle = async () => {
    try {
      const vehicles = await firebaseService.getVehicles(job.userId);
      const v = vehicles.find(v => v.id === job.vehicleId);
      setVehicle(v || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return '#007AFF';
      case 'diagnosed': return '#FF9500';
      case 'repairing': return '#5856D6';
      case 'completed': return '#34C759';
      default: return '#8E8E93';
    }
  };

  return (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/(workshop)/job-details?id=${job.id}`)}
    >
      <View style={[styles.iconBox, { backgroundColor: getStatusColor(job.status) }]}>
        <Ionicons name="car-sport-outline" size={24} color="#fff" />
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>
          {loading ? 'Loading...' : vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
        </Text>
        <Text style={styles.itemSubtitle}>
          {vehicle?.licensePlate || 'No Reg'} • {formatDistanceToNow(job.createdAt, { addSuffix: true })}
        </Text>
      </View>

      <View style={styles.itemRight}>
        <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  filterPillActive: {
    backgroundColor: '#1c1c1e',
    borderColor: '#1c1c1e',
  },
  filterPillText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingBottom: 15,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});
