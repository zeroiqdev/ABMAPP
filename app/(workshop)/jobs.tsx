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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Job, Vehicle } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { BrandLogo } from '@/components/BrandLogo';
import { useColors } from '@/constants/design';

export default function JobsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.workshopId) return;

    setRefreshing(true);
    const unsubscribe = firebaseService.subscribeToWorkshopJobs(user.workshopId, (updatedJobs) => {
      // For technicians, only show jobs assigned to them (check both new array and legacy field)
      if (user.role === 'technician') {
        const assignedJobs = updatedJobs.filter(job =>
          job.assignedTechnicianIds?.includes(user.id) || job.assignedTechnicianId === user.id
        );
        setJobs(assignedJobs);
      } else {
        setJobs(updatedJobs);
      }
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    filterJobs();
  }, [jobs, filter, searchQuery]);

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
        (j.technicianNames?.some(name => name.toLowerCase().includes(query))) ||
        (j.technicianName && j.technicianName.toLowerCase().includes(query))
      );
    }

    setFilteredJobs(result);
  };

  const onRefresh = async () => {
    // Subscription handles updates, but we can simulate a refresh or re-fetch if needed.
    // For now, we rely on the subscription.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Tasks</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(workshop)/create-job')}
          >
            <Ionicons name="add" size={20} color={colors.background === '#000000' ? '#000' : '#fff'} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="By car name/registration number"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textTertiary}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No jobs found</Text>
          </View>
        }
      />

    </View>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.filterPill,
        { backgroundColor: colors.background, borderColor: colors.border },
        active && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.filterPillText,
        { color: colors.textSecondary },
        active && { color: colors.textInverse }
      ]}>{label}</Text>
    </TouchableOpacity>
  );
}

function JobCard({ job }: { job: Job }) {
  const router = useRouter();
  const colors = useColors();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicle();
  }, [job.vehicleId]);

  const loadVehicle = async () => {
    if (!job.vehicleId) {
      setLoading(false);
      return;
    }
    try {
      const v = await firebaseService.getVehicle(job.vehicleId);
      setVehicle(v || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return '#FFA500';
      case 'diagnosed': return '#007AFF';
      case 'repairing': return '#34C759';
      case 'completed': return '#30D158';
      default: return '#666';
    }
  };

  const isUnassigned = job.status === 'received';

  const handlePress = () => {
    if (isUnassigned) {
      router.push(`/(workshop)/create-job?jobId=${job.id}`);
    } else {
      router.push(`/(workshop)/job-details?id=${job.id}`);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={handlePress}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: (vehicle || loading) ? 'transparent' : getStatusColor(job.status) }]}>
          {loading && job.vehicleId ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : vehicle ? (
            <BrandLogo brand={vehicle.make} size={30} />
          ) : (
            <Ionicons name="car-sport-outline" size={24} color={colors.textPrimary} />
          )}
        </View>

        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>
            {loading ? 'Loading...' : vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
          </Text>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            {vehicle?.licensePlate || 'No Reg'} • {formatDistanceToNow(job.createdAt, { addSuffix: true })}
          </Text>
        </View>
      </View>

      <View style={styles.itemRight}>
        <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '15' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
              {isUnassigned ? 'Unassigned' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
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
    fontSize: 24,
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
    padding: 0,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    fontSize: 14,
    color: '#888',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
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
