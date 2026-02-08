import React, { useEffect, useState, useMemo } from 'react';
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
import { Colors, useColors } from '@/constants/design';

export default function JobDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <TouchableOpacity style={styles.chatButton} onPress={() => setChatVisible(true)}>
          <Ionicons name="chatbubble-outline" size={24} color={colors.textPrimary} />
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
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }}>Vehicle Information</Text>
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
              <InfoRow label="Make" value={vehicle.make} colors={colors} />
              <InfoRow label="Model" value={vehicle.model} colors={colors} />
              <InfoRow label="Year" value={vehicle.year.toString()} colors={colors} />
              <InfoRow label="License Plate" value={vehicle.licensePlate} colors={colors} />
              <InfoRow label="VIN" value={vehicle.vin} colors={colors} />
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
              colors={colors}
            />
            {job.scheduledDate && (
              <InfoRow
                label="Scheduled Date"
                value={format(job.scheduledDate, 'MMM dd, yyyy HH:mm')}
                colors={colors}
              />
            )}
            {/* Show multiple technicians if available */}
            {job.technicianNames && job.technicianNames.length > 0 ? (
              <InfoRow
                label="Assigned Technician(s)"
                value={job.technicianNames.join(', ')}
                colors={colors}
              />
            ) : job.technicianName ? (
              <InfoRow label="Assigned Technician" value={job.technicianName} colors={colors} />
            ) : null}
            <InfoRow
              label="Created"
              value={format(job.createdAt, 'MMM dd, yyyy')}
              colors={colors}
            />
            {job.completedAt && (
              <InfoRow
                label="Completed"
                value={format(job.completedAt, 'MMM dd, yyyy')}
                colors={colors}
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

        {/* Bottom padding for scroll */}
        <View style={{ height: 40 }} />
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

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right', maxWidth: '60%' }}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.textPrimary,
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
    backgroundColor: colors.border,
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
    backgroundColor: colors.border,
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
    color: colors.textSecondary,
  },
  timelineLabelCompleted: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  descriptionCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  partRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  partName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  partDetails: {
    fontSize: 14,
    color: colors.textSecondary,
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
    color: colors.textTertiary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
