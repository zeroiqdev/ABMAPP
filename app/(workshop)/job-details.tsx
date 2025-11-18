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
  const { user } = useAuthStore();
  const [job, setJob] = useState<Job | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');

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
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!job && isNew !== 'true') {
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

  const canUpdateStatus = ['admin', 'service_advisor'].includes(user?.role || '');
  const canAssignTechnician = ['admin', 'service_advisor'].includes(user?.role || '');
  const isTechnician = user?.role === 'technician';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Section */}
        {job && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusCard}>
              <Text style={styles.currentStatus}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </Text>
              {canUpdateStatus && (
                <View style={styles.statusButtons}>
                  {['received', 'diagnosed', 'repairing', 'completed'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        job.status === status && styles.statusButtonActive,
                      ]}
                      onPress={() => updateJobStatus(status as JobStatus)}
                      disabled={updating}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          job.status === status && styles.statusButtonTextActive,
                        ]}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Customer & Vehicle Info */}
        {customer && vehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer & Vehicle</Text>
            <View style={styles.infoCard}>
              <InfoRow label="Customer" value={customer.name} />
              <InfoRow label="Email" value={customer.email} />
              <InfoRow label="Phone" value={customer.phone} />
              <InfoRow label="Vehicle" value={`${vehicle.make} ${vehicle.model} (${vehicle.year})`} />
              <InfoRow label="License Plate" value={vehicle.licensePlate} />
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
                  value={job.type === 'service' ? 'Service' : 'Complaint'}
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
  statusCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
  },
  currentStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#fff',
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
  noTechnician: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  notesInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
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
});

