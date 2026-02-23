import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Vehicle, Workshop } from '@/types';
import { Colors, Spacing, Typography, BorderRadius, useColors } from '@/constants/design';
import { WorkshopSelectorModal } from '@/components/WorkshopSelectorModal';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/config/firebase';

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
  'Others',
];

export default function ServiceScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Form State
  const [description, setDescription] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  // Workshop selection state
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [availableWorkshops, setAvailableWorkshops] = useState<Workshop[]>([]);
  const [showWorkshopSelector, setShowWorkshopSelector] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      loadWorkshops();
    }, [user?.id])
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

  const loadWorkshops = async () => {
    if (!user) return;
    const ids = new Set([
      ...(user.selectedWorkshopIds || []),
      ...(user.addedByWorkshopIds || []),
      ...(user.connectedWorkshopIds || []),
      ...(user.workshopId ? [user.workshopId] : [])
    ]);

    const workshops: Workshop[] = [];
    for (const id of Array.from(ids)) {
      if (!id) continue;
      const w = await firebaseService.getWorkshop(id);
      if (w) workshops.push(w);
    }
    setAvailableWorkshops(workshops);
    if (workshops.length > 0 && !selectedWorkshopId) {
      setSelectedWorkshopId(workshops[0].id);
    }
  };

  const handleAddNewWorkshops = async (newIds: string[]) => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user.id), {
        selectedWorkshopIds: arrayUnion(...newIds),
        connectedWorkshopIds: arrayUnion(...newIds)
      });
      await loadWorkshops();
      if (newIds.length > 0) setSelectedWorkshopId(newIds[newIds.length - 1]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add workshops');
    } finally {
      setLoading(false);
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

    if (!selectedWorkshopId) {
      Alert.alert('Error', 'Please select a workshop');
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
        workshopId: selectedWorkshopId || user.workshopId || 'default-workshop', // Fallback if not set
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
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
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Repair</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>

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
              color={colors.textSecondary}
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
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Workshop Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Workshop</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
            {availableWorkshops.map(workshop => (
              <TouchableOpacity
                key={workshop.id}
                style={[
                  styles.dropdownTrigger,
                  selectedWorkshopId === workshop.id && { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 },
                  { padding: 15, width: 140, height: 80, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
                ]}
                onPress={() => setSelectedWorkshopId(workshop.id)}
              >
                <Text style={[
                  styles.dropdownText,
                  selectedWorkshopId === workshop.id && { fontWeight: '600' }
                ]}>
                  {workshop.name}
                </Text>
                {workshop.address && (
                  <Text numberOfLines={1} style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                    {workshop.address}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                { padding: 15, width: 80, height: 80, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }
              ]}
              onPress={() => setShowWorkshopSelector(true)}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>Add</Text>
            </TouchableOpacity>
          </ScrollView>
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
            placeholderTextColor={colors.textTertiary}
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

      <WorkshopSelectorModal
        visible={showWorkshopSelector}
        onClose={() => setShowWorkshopSelector(false)}
        onSelect={handleAddNewWorkshops}
        excludeIds={availableWorkshops.map(w => w.id)}
        title="Add Workshop"
      />
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownText: {
    fontSize: Typography.fontSize.base,
    color: colors.textPrimary,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemText: {
    fontSize: Typography.fontSize.base,
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  issueChipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  issueChipText: {
    fontSize: Typography.fontSize.sm,
    color: colors.textSecondary,
  },
  issueChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  issueHint: {
    fontSize: Typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: Spacing.xs,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    fontSize: Typography.fontSize.base,
    minHeight: 120,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.primary,
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
    color: colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    color: colors.textSecondary,
  },
  addButton: {
    marginTop: Spacing.lg,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    color: colors.textInverse,
    fontWeight: Typography.fontWeight.bold,
  },
});
