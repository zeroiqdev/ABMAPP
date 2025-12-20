import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { ChatMessage, Job, Vehicle } from '@/types';
import { format } from 'date-fns';
import JobChat from '@/components/JobChat';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/design';

export default function JobDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [job, setJob] = useState<Job | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatVisible, setChatVisible] = useState(false);

  useEffect(() => {
    loadJobDetails();
    // Subscribe to messages
    const unsubscribe = firebaseService.subscribeToJobMessages(id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [id]);

  const loadJobDetails = async () => {
    try {
      const jobData = await firebaseService.getJob(id);
      if (jobData) {
        setJob(jobData);
        // ... (fetch vehicle logic remains same, will be kept by replacement context or re-added if overwritten)
        const vehicles = await firebaseService.getVehicles(jobData.userId);
        const jobVehicle = vehicles.find((v) => v.id === jobData.vehicleId);
        if (jobVehicle) setVehicle(jobVehicle);
      }
    } catch (error) {
      console.error('Error loading job details:', error);
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

  const currentStatusIndex = statusSteps.findIndex((s) => s.key === job?.status);
  const unreadCount = user ? messages.filter(m => !m.readBy.includes(user.id)).length : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Job Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Job not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <TouchableOpacity style={styles.chatButton} onPress={() => setChatVisible(true)}>
          <Ionicons name="chatbubble-outline" size={24} color="#000" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>


        {/* Vehicle Info */}
        {vehicle && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Vehicle Information</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(job.status) + '15', paddingVertical: 4, paddingHorizontal: 10 },
                ]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(job.status), fontSize: 12 }]}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <InfoRow label="Make" value={vehicle.make} />
              <InfoRow label="Model" value={vehicle.model} />
              <InfoRow label="Year" value={vehicle.year.toString()} />
              <InfoRow label="License Plate" value={vehicle.licensePlate} />
              <InfoRow label="VIN" value={vehicle.vin} />
            </View>
          </View>
        )}

        {/* Job Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              label="Type"
              value={job.type.charAt(0).toUpperCase() + job.type.slice(1).replace(/_/g, ' ')}
            />
            {job.scheduledDate && (
              <InfoRow
                label="Scheduled Date"
                value={format(job.scheduledDate, 'MMM dd, yyyy HH:mm')}
              />
            )}
            {job.technicianName && (
              <InfoRow label="Assigned Technician" value={job.technicianName} />
            )}
            <InfoRow
              label="Created"
              value={format(job.createdAt, 'MMM dd, yyyy')}
            />
            {job.completedAt && (
              <InfoRow
                label="Completed"
                value={format(job.completedAt, 'MMM dd, yyyy')}
              />
            )}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{job.description}</Text>
          </View>
        </View>

        {/* Notes */}
        {job.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Technician Notes</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{job.notes}</Text>
            </View>
          </View>
        )}

        {/* Parts Used */}
        {job.partsUsed && job.partsUsed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parts Used</Text>
            <View style={styles.infoCard}>
              {job.partsUsed.map((part, index) => (
                <View key={index} style={styles.partRow}>
                  <Text style={styles.partName}>{part.partName}</Text>
                  <Text style={styles.partDetails}>
                    Qty: {part.quantity} × ₦{part.unitPrice.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Images */}
        {job.images && job.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Images</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {job.images.map((imageUri, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUri }}
                  style={styles.image}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {user && (
        <JobChat
          jobId={id}
          currentUser={user}
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          messages={messages}
        />
      )}
    </View>
  );
}

const statusSteps = [
  { key: 'received', label: 'Received' },
  { key: 'diagnosed', label: 'Diagnosed' },
  { key: 'repairing', label: 'Repairing' },
  { key: 'completed', label: 'Completed' },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  chatButton: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  statusSection: {
    padding: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  timelineDotCompleted: {
    backgroundColor: '#34C759',
  },
  timelineDotCurrent: {
    backgroundColor: '#007AFF',
  },
  timelineLine: {
    position: 'absolute',
    left: 12,
    top: 24,
    width: 2,
    height: 30,
    backgroundColor: '#ddd',
  },
  timelineLineCompleted: {
    backgroundColor: '#34C759',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineLabel: {
    fontSize: 16,
    color: '#666',
  },
  timelineLabelCompleted: {
    color: '#000',
    fontWeight: '600',
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  descriptionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  partRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  partName: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  partDetails: {
    fontSize: 14,
    color: '#666',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
});

