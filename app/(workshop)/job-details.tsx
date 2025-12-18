import React, { useEffect, useState } from 'react';
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
import { Job, Vehicle, User, JobStatus } from '@/types';
import { format } from 'date-fns';

export default function WorkshopJobDetailsScreen() {
  const router = useRouter();
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
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [showStatusModal, setShowStatusModal] = useState(false);

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'service': return 'Service';
      case 'repair': return 'Repair';
      case 'service_and_repair': return 'Service & Repair';
      case 'complaint': return 'Complaint';
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
        setSelectedTechnician(jobData.assignedTechnicianId || '');

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
      // In a real app, you'd query users by role and workshopId
      // For now, we'll use a placeholder
      const allUsers = await firebaseService.getJobs(undefined, user.workshopId);
      // This is a placeholder - you'd need a proper user query by role
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const updateJobStatus = async (newStatus: JobStatus) => {
    if (!job || !user) return;

    setUpdating(true);
    try {
      await firebaseService.updateJob(job.id, {
        status: newStatus,
        notes: notes || job.notes,
        assignedTechnicianId: selectedTechnician || job.assignedTechnicianId,
      });

      // Send notification to customer
      if (job.userId) {
        await notificationService.sendNotificationToUser(
          job.userId,
          'Job Status Updated',
          `Your job status has been updated to: ${newStatus}`,
          'job_update'
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

  const assignTechnician = async () => {
    if (!job || !selectedTechnician) return;

    setUpdating(true);
    try {
      const technician = technicians.find((t) => t.id === selectedTechnician);
      await firebaseService.updateJob(job.id, {
        assignedTechnicianId: selectedTechnician,
        technicianName: technician?.name,
      });

      Alert.alert('Success', 'Technician assigned successfully');
      await loadJobDetails();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign technician');
    } finally {
      setUpdating(false);
    }
  };

  const saveNotes = async () => {
    if (!job) return;

    setUpdating(true);
    try {
      await firebaseService.updateJob(job.id, { notes });
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
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!job && isNew !== 'true') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(workshop)/jobs');
            }
          }}>
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

  const canUpdateStatus = ['admin', 'service_advisor'].includes(user?.role || '');
  const canAssignTechnician = ['admin', 'service_advisor'].includes(user?.role || '');
  const isTechnician = user?.role === 'technician';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(workshop)/jobs')}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Hero Section */}
        {job && vehicle && (
          <View style={styles.heroSection}>
            <View style={styles.heroHeader}>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.status) }]} />
                <Text style={styles.statusPillText}>{job.status.toUpperCase()}</Text>
              </View>
              {canUpdateStatus && (
                <TouchableOpacity
                  style={styles.updateStatusButton}
                  onPress={() => setShowStatusModal(true)}
                >
                  <Text style={styles.updateStatusText}>Update Status</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.heroTitle}>
              {job.issues && job.issues.length > 0
                ? `${job.issues[0]}${job.issues.length > 1 ? ` +${job.issues.length - 1}` : ''}`
                : job.description}
            </Text>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Vehicle</Text>
                <Text style={styles.metricValue}>{vehicle.make} {vehicle.model}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Type</Text>
                <Text style={styles.metricValue}>{getTypeFromIssues(job.issues)}</Text>
              </View>
            </View>



          </View>
        )}

        {/* Customer Info */}
        {customer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Details</Text>
            <View style={styles.infoCard}>
              <InfoRow label="Name" value={customer.name} />
              <InfoRow label="Phone" value={customer.phone} />
              <InfoRow label="License Plate" value={vehicle?.licensePlate || ''} />
            </View>
          </View>
        )}

        {/* Job Details */}
        {job && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Job Information</Text>
              <View style={styles.infoCard}>
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <View style={styles.descriptionCard}>
                <Text style={styles.descriptionText}>{job.description}</Text>
              </View>
            </View>
          </>
        )}

        {/* Assign Technician */}
        {job && canAssignTechnician && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assign Technician</Text>
            <View style={styles.infoCard}>
              {job.technicianName ? (
                <InfoRow label="Assigned To" value={job.technicianName} />
              ) : (
                <Text style={styles.noTechnician}>No technician assigned</Text>
              )}
              {/* In a real app, you'd have a dropdown to select from technicians */}
            </View>
          </View>
        )}

        {/* Notes Section */}
        {job && (isTechnician || canUpdateStatus) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this job..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveNotes}
              disabled={updating}
            >
              <Text style={styles.saveButtonText}>
                {updating ? 'Saving...' : 'Save Notes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showStatusModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.statusModalContent}
          >
            <Text style={styles.modalTitle}>Update Job Status</Text>
            {['received', 'diagnosed', 'repairing', 'completed'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusOption,
                  job?.status === status && styles.statusOptionSelected,
                ]}
                onPress={() => {
                  updateJobStatus(status as JobStatus);
                  setShowStatusModal(false);
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={styles.statusOptionText}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                {job?.status === status && (
                  <Ionicons name="checkmark" size={20} color="#000" />
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
    color: '#fff',
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
});

