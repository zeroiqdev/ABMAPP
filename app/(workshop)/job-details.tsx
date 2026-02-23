import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { notificationService } from '@/services/notificationService';
import { ChatMessage, Job, Vehicle, User, JobStatus, StatusHistoryEntry } from '@/types';
import { format } from 'date-fns';
import JobChat from '@/components/JobChat';
import { Colors, useColors } from '@/constants/design';

export default function WorkshopJobDetailsScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return '#FFA500';
      case 'diagnosed': return '#007AFF';
      case 'repairing': return '#34C759';
      case 'completed': return '#30D158';
      default: return '#666';
    }
  };

  const { user } = useAuthStore();
  const [job, setJob] = useState<Job | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTechnicianModal, setShowTechnicianModal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatVisible, setChatVisible] = useState(false);
  const [permissions, setPermissions] = useState<any>({});

  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.workshopId && user?.role) {
        try {
          const allPerms = await firebaseService.getWorkshopPermissions(user.workshopId);
          setPermissions(allPerms[user.role] || {});
        } catch (error) {
          console.error("Failed to fetch permissions", error);
        }
      }
    };
    fetchPermissions();
  }, [user?.id]);

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'service': return 'Service';
      case 'repair': return 'Repair';
      case 'service_and_repair': return 'Service & Repair';
      case 'complaint': return 'Complaint';
      case 'tow': return 'Tow Service';
      default: return type;
    }
  };

  const getTypeFromIssues = (issues: string[] | undefined) => {
    if (!issues || issues.length === 0) return 'Repair';

    const hasServicing = issues.includes('Servicing');
    const hasOtherIssues = issues.some(issue => issue !== 'Servicing');

    if (hasServicing && hasOtherIssues) {
      return 'Service & Repair';
    } else if (hasServicing) {
      return 'Service';
    } else {
      return 'Repair';
    }
  };

  useEffect(() => {
    if (isNew !== 'true' && id) {
      loadJobDetails();
      // Subscribe to messages
      const unsubscribe = firebaseService.subscribeToJobMessages(id, (msgs) => {
        setMessages(msgs);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
    loadTechnicians();
  }, [id, isNew]);

  const loadJobDetails = async () => {
    try {
      const jobData = await firebaseService.getJob(id);
      if (jobData) {
        setJob(jobData);
        setNotes(jobData.notes || '');
        // Initialize selected technicians from array or legacy single value
        const techIds = jobData.assignedTechnicianIds ||
          (jobData.assignedTechnicianId ? [jobData.assignedTechnicianId] : []);
        setSelectedTechnicians(techIds);

        const vehicles = await firebaseService.getVehicles(jobData.userId);
        const jobVehicle = vehicles.find((v) => v.id === jobData.vehicleId);
        if (jobVehicle) setVehicle(jobVehicle);

        const customerData = await firebaseService.getUser(jobData.userId);
        if (customerData) setCustomer(customerData);
      }
    } catch (error) {
      console.error('Error loading job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    if (!user?.workshopId) return;

    try {
      const techs = await firebaseService.getUsersByRole('technician', user.workshopId);
      setTechnicians(techs);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const updateJobStatus = async (newStatus: JobStatus) => {
    if (!job || !user) return;

    setUpdating(true);
    try {
      // Get technician names for the selected IDs
      const techNames = selectedTechnicians.map(id =>
        technicians.find(t => t.id === id)?.name || ''
      ).filter(Boolean);

      // Create status history entry
      const statusHistoryEntry: StatusHistoryEntry = {
        type: 'status',
        description: `Changed status from ${job.status} to ${newStatus}`,
        fromStatus: job.status,
        toStatus: newStatus,
        changedBy: user.id,
        changedByName: user.name,
        changedAt: new Date(),
      };

      await firebaseService.updateJob(job.id, {
        status: newStatus,
        notes: notes ?? job.notes ?? '',
        assignedTechnicianIds: selectedTechnicians.length > 0 ? selectedTechnicians : job.assignedTechnicianIds,
        technicianNames: techNames.length > 0 ? techNames : job.technicianNames,
        // Keep legacy fields for backwards compatibility
        assignedTechnicianId: selectedTechnicians[0] || (job.assignedTechnicianId ?? undefined),
        technicianName: techNames[0] || (job.technicianName ?? undefined),
        // Append status history entry
        statusHistory: [...(job.statusHistory || []), statusHistoryEntry],
        ...(newStatus === 'completed' ? { completedAt: new Date() } : {}),
      });

      // Send notification to customer
      if (job.userId) {
        await notificationService.sendNotificationToUser(
          job.userId,
          'Job Status Updated',
          `Your job status has been updated to: ${newStatus}`,
          'job_update',
          { jobId: job.id, vehicleId: job.vehicleId }
        );
      }

      Alert.alert('Success', 'Job status updated successfully');
      await loadJobDetails();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update job status');
    } finally {
      setUpdating(false);
    }
  };

  const assignTechnicians = async () => {
    if (!job || selectedTechnicians.length === 0 || !user) return;

    setUpdating(true);
    try {
      const techNames = selectedTechnicians.map(id =>
        technicians.find(t => t.id === id)?.name || ''
      ).filter(Boolean);

      await firebaseService.updateJob(job.id, {
        assignedTechnicianIds: selectedTechnicians,
        technicianNames: techNames,
        // Keep legacy fields for backwards compatibility
        assignedTechnicianId: selectedTechnicians[0],
        technicianName: techNames[0],
      });

      // Log action
      await firebaseService.addJobLog(job.id, {
        type: 'assignment',
        description: `Assigned technicians: ${techNames.join(', ')}`,
        userId: user.id,
        userName: user.name,
      });

      setShowTechnicianModal(false);
      Alert.alert('Success', `${selectedTechnicians.length} technician(s) assigned successfully`);
      await loadJobDetails();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign technicians');
    } finally {
      setUpdating(false);
    }
  };

  const toggleTechnicianSelection = (techId: string) => {
    setSelectedTechnicians(prev =>
      prev.includes(techId)
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    );
  };

  const saveNotes = async () => {
    if (!job || !user) return;

    setUpdating(true);
    try {
      await firebaseService.updateJob(job.id, { notes });

      // Log action
      await firebaseService.addJobLog(job.id, {
        type: 'note',
        description: 'Updated job notes',
        userId: user.id,
        userName: user.name,
      });

      Alert.alert('Success', 'Notes saved successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save notes');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!job && isNew !== 'true') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(workshop)/jobs');
            }
          }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Job Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Job not found</Text>
        </View>
      </View>
    );
  }

  const isAssignedTech = job?.assignedTechnicianIds?.includes(user?.id || '') || job?.assignedTechnicianId === user?.id;
  const canUpdateStatus = ['admin', 'service_advisor', 'super_admin'].includes(user?.role || '') || permissions?.canManageJobs || isAssignedTech;
  const canAssignTechnician = ['admin', 'service_advisor'].includes(user?.role || '');
  const isTechnician = user?.role === 'technician';
  const unreadCount = user ? messages.filter(m => !m.readBy.includes(user.id)).length : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push('/(workshop)/jobs')}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Job Details</Text>
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
        {/* Hero Section */}
        {job && vehicle && (
          <View style={[styles.heroSection, { backgroundColor: colors.surface }]}>
            <View style={styles.heroHeader}>
              <View style={[styles.statusPill, { backgroundColor: colors.background }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.status) }]} />
                <Text style={[styles.statusPillText, { color: colors.textPrimary }]}>{job.status.toUpperCase()}</Text>
              </View>
              {canUpdateStatus && (
                <TouchableOpacity
                  style={[styles.updateStatusButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowStatusModal(true)}
                >
                  <Text style={styles.updateStatusText}>Update Status</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {job.issues && job.issues.length > 0
                ? `${job.issues[0]}${job.issues.length > 1 ? ` +${job.issues.length - 1}` : ''}`
                : job.description}
            </Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{vehicle.make} {vehicle.model}</Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Type</Text>
                <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{getTypeFromIssues(job.issues)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Customer Info */}
        {customer && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer Details</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <InfoRow label="Name" value={customer.name} />
              <InfoRow label="Phone" value={customer.phone} />
              <InfoRow label="License Plate" value={vehicle?.licensePlate || ''} />
            </View>
          </View>
        )}

        {/* Job Details */}
        {job && (
          <>
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Job Information</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <InfoRow
                  label="Type"
                  value={getJobTypeLabel(job.type)}
                />
                <InfoRow
                  label="Created"
                  value={format(job.createdAt, 'MMM dd, yyyy HH:mm')}
                />
                {job.scheduledDate && (
                  <InfoRow
                    label="Scheduled"
                    value={format(job.scheduledDate, 'MMM dd, yyyy HH:mm')}
                  />
                )}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Description</Text>
              <View style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.descriptionText, { color: colors.textPrimary }]}>{job.description}</Text>
              </View>
            </View>
          </>
        )}

        {/* Assign Technicians */}
        {job && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Assigned Technicians</Text>
              {canAssignTechnician && (
                <TouchableOpacity
                  style={[styles.updateStatusButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowTechnicianModal(true)}
                >
                  <Text style={styles.updateStatusText}>
                    {(job.assignedTechnicianIds?.length || job.assignedTechnicianId) ? 'Edit' : 'Assign'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(job.technicianNames && job.technicianNames.length > 0) ? (
                job.technicianNames.map((name, index) => (
                  <View key={index} style={[styles.technicianChip, { backgroundColor: colors.background }]}>
                    <Ionicons name="person" size={16} color={colors.textSecondary} />
                    <Text style={[styles.technicianChipText, { color: colors.textPrimary }]}>{name}</Text>
                  </View>
                ))
              ) : job.technicianName ? (
                <View style={[styles.technicianChip, { backgroundColor: colors.background }]}>
                  <Ionicons name="person" size={16} color={colors.textSecondary} />
                  <Text style={[styles.technicianChipText, { color: colors.textPrimary }]}>{job.technicianName}</Text>
                </View>
              ) : (
                <Text style={[styles.noTechnician, { color: colors.textSecondary }]}>No technicians assigned</Text>
              )}
            </View>
          </View>
        )}

        {/* Notes Section */}
        {job && (isTechnician || canUpdateStatus) && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this job..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={saveNotes}
              disabled={updating}
            >
              <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>
                {updating ? 'Saving...' : 'Save Notes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Job History */}
        {job?.statusHistory && job.statusHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Job History</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {job.statusHistory.slice().reverse().map((entry, index) => (
                <View key={index} style={styles.historyEntry}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyUser, { color: colors.textPrimary }]}>{entry.changedByName}</Text>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                      {entry.changedAt instanceof Date ? format(entry.changedAt, 'MMM dd, yyyy HH:mm') : 'Recently'}
                    </Text>
                  </View>
                  <Text style={[styles.historyChange, { color: colors.textSecondary }]}>
                    {entry.description || `${entry.fromStatus} → ${entry.toStatus}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {user && id && (
        <JobChat
          jobId={id}
          currentUser={user}
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          messages={messages}
        />
      )}

      <Modal visible={showStatusModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.statusModalContent, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Update Job Status</Text>
            {['received', 'diagnosed', 'repairing', 'completed'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusOption,
                  { borderBottomColor: colors.border },
                  job?.status === status && { borderColor: colors.textPrimary, borderWidth: 1, borderBottomWidth: 1 } /* Adjusted for style override */,
                  job?.status === status && styles.statusOptionSelected,
                ]}
                onPress={() => {
                  updateJobStatus(status as JobStatus);
                  setShowStatusModal(false);
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={[styles.statusOptionText, { color: colors.textPrimary }]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                {job?.status === status && (
                  <Ionicons name="checkmark" size={20} color={colors.textPrimary} />
                )}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  heroSection: {
    padding: 24,
    backgroundColor: '#fff',
    marginBottom: 10,
    alignItems: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.5,
  },
  updateStatusButton: {
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  updateStatusText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 30,
    marginTop: 10,
  },
  metricItem: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  metricLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#eee',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
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
    backgroundColor: '#fff',
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  noTechnician: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#000',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusOptionSelected: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
    width: '100%',
    overflow: 'hidden',
  },
  statusOptionText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    color: '#333',
    fontWeight: '500',
  },
  technicianChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    gap: 8,
  },
  technicianChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  historyEntry: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  historyChange: {
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
  },
});


