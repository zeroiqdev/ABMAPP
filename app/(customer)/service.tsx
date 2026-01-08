import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { notificationService } from '@/services/notificationService';
import { Vehicle } from '@/types';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/design';

// Duplicate of admin issue options for consistency
const ISSUE_OPTIONS = [
  'Servicing',
  'Mechanical',
  'Electrical',
  'Hydraulic',
  'Software / Sensors',
  'Wear & Tear',
  'Accidental Damage',
  'Fluid Leak',
  'Noise / Vibration',
  'Overheating',
  'Performance Loss',
];

export default function ServiceScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Form State
  const [description, setDescription] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [user])
  );

  const loadVehicles = async () => {
    if (!user) return;
    try {
      const userVehicles = await firebaseService.getVehicles(user.id);
      setVehicles(userVehicles);
      if (userVehicles.length > 0 && !selectedVehicle) {
        // Pre-select first vehicle if none selected
        setSelectedVehicle(userVehicles[0]);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
      Alert.alert('Error', 'Failed to load your vehicles');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const toggleIssue = (issue: string) => {
    setIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  const handleSubmit = async () => {
    if (!user || !selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    if (issues.length === 0) {
      Alert.alert('Error', 'Please select at least one issue type');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
      return;
    }

    setLoading(true);
    try {
      // Determine job type based on issues (mimicking admin logic)
      // If only 'Servicing' is selected -> 'service'
      // If 'Servicing' + others -> 'service_and_repair'
      // Else -> 'repair'
      let jobType: 'service' | 'repair' | 'service_and_repair' = 'repair';
      if (issues.includes('Servicing')) {
        if (issues.length === 1) {
          jobType = 'service';
        } else {
          jobType = 'service_and_repair';
        }
      }

      // Create job with 'received' status so admin sees it
      const jobId = await firebaseService.createJob({
        userId: user.id,
        vehicleId: selectedVehicle.id,
        workshopId: user.workshopId || 'default-workshop', // Fallback if not set
        type: jobType,
        issues,
        description: description.trim(),
        status: 'received',
        serviceCharge: 0, // Should be set by admin later
        partsUsed: [], // Admin will add parts
        notes: 'Customer Request',
      } as any);

      // Notify user (and potentially admin via triggers)
      await notificationService.sendNotificationToUser(
        user.id,
        'Request Received',
        'Your repair request has been submitted successfully.',
        'job_update',
        { jobId, vehicleId: selectedVehicle.id }
      );

      Alert.alert('Success', 'Your request has been sent to the workshop.', [
        {
          text: 'OK',
          onPress: () => router.push('/(customer)/home'),
        },
      ]);
    } catch (error: any) {
      console.error('Error creating job:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingVehicles) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="car-outline" size={64} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>No vehicles found</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(customer)/add-vehicle')}
        >
          <Text style={styles.addButtonText}>Add Vehicle</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Repair</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>

        {/* Vehicle Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Vehicle</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
          >
            <Text style={styles.dropdownText}>
              {selectedVehicle
                ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.licensePlate})`
                : 'Select Vehicle'}
            </Text>
            <Ionicons
              name={showVehicleDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {showVehicleDropdown && (
            <View style={styles.dropdownList}>
              {vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedVehicle(v);
                    setShowVehicleDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>
                    {v.make} {v.model} ({v.licensePlate})
                  </Text>
                  {selectedVehicle?.id === v.id && (
                    <Ionicons name="checkmark" size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Issue Categories */}
        <View style={styles.section}>
          <Text style={styles.label}>Issue Type</Text>
          <View style={styles.issueChipsContainer}>
            {ISSUE_OPTIONS.map((option) => {
              const active = issues.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.issueChip, active && styles.issueChipActive]}
                  onPress={() => toggleIssue(option)}
                >
                  <Text style={[styles.issueChipText, active && styles.issueChipTextActive]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {issues.length > 1 && (
            <Text style={styles.issueHint}>Multiple issues selected</Text>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Issue Description</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Please describe the noise, leak, or problem..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Request</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemText: {
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  issueChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  issueChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  issueChipActive: {
    backgroundColor: '#f0f0f0',
    borderColor: '#000',
  },
  issueChipText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  issueChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  issueHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: '#000',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing['3xl'],
    width: '70%',
    alignSelf: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  addButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.bold,
  },
});
