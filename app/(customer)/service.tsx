import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { notificationService } from '@/services/notificationService';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Vehicle, Job } from '@/types';
import {
  AVAILABLE_SERVICES,
  getSuggestionsForServices,
  Service,
  ServiceSuggestion,
} from '@/types/services';

type BookingStep = 1 | 2 | 3 | 4;

interface BookingState {
  selectedServiceKeys: string[];
  selectedSuggestionKeys: string[];
  description: string;
  imageFile: string | null;
  preferredDate: Date | null;
  selectedVehicle: string | null;
}

export default function ServiceScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState<BookingStep>(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [bookingState, setBookingState] = useState<BookingState>({
    selectedServiceKeys: [],
    selectedSuggestionKeys: [],
    description: '',
    imageFile: null,
    preferredDate: null,
    selectedVehicle: null,
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    if (!user) return;
    try {
      const userVehicles = await firebaseService.getVehicles(user.id);
      setVehicles(userVehicles);
      if (userVehicles.length > 0) {
        setBookingState((prev) => ({
          ...prev,
          selectedVehicle: userVehicles[0].id,
        }));
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const toggleService = (serviceKey: string) => {
    setBookingState((prev) => ({
      ...prev,
      selectedServiceKeys: prev.selectedServiceKeys.includes(serviceKey)
        ? prev.selectedServiceKeys.filter((key) => key !== serviceKey)
        : [...prev.selectedServiceKeys, serviceKey],
    }));
  };

  const toggleSuggestion = (suggestionKey: string) => {
    setBookingState((prev) => ({
      ...prev,
      selectedSuggestionKeys: prev.selectedSuggestionKeys.includes(suggestionKey)
        ? prev.selectedSuggestionKeys.filter((key) => key !== suggestionKey)
        : [...prev.selectedSuggestionKeys, suggestionKey],
    }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const url = await firebaseService.uploadFile(
          result.assets[0].uri,
          `jobs/${user?.id}/${Date.now()}-${result.assets[0].fileName || 'image.jpg'}`
        );
        setBookingState((prev) => ({ ...prev, imageFile: url }));
      } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Error', 'Failed to upload image');
      }
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (bookingState.selectedServiceKeys.length === 0) {
        Alert.alert('Error', 'Please select at least one service');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!bookingState.description.trim() && bookingState.selectedSuggestionKeys.length === 0) {
        Alert.alert('Error', 'Please describe the issue or select suggestions');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep((step - 1) as BookingStep);
    }
  };

  const handleSubmit = async () => {
    if (!user || !bookingState.selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    if (!bookingState.preferredDate) {
      Alert.alert('Error', 'Please select a preferred date');
      return;
    }

    setLoading(true);
    try {
      const workshopId = user.workshopId || 'default-workshop';

      const descriptionParts: string[] = [];
      if (bookingState.selectedServiceKeys.length > 0) {
        const serviceNames = bookingState.selectedServiceKeys
          .map((key) => AVAILABLE_SERVICES.find((s) => s.key === key)?.title)
          .filter(Boolean);
        descriptionParts.push(`Services: ${serviceNames.join(', ')}`);
      }
      if (bookingState.selectedSuggestionKeys.length > 0) {
        descriptionParts.push(`Issues: ${bookingState.selectedSuggestionKeys.join(', ')}`);
      }
      if (bookingState.description.trim()) {
        descriptionParts.push(`Description: ${bookingState.description}`);
      }

      const job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.id,
        vehicleId: bookingState.selectedVehicle,
        workshopId,
        type: 'service',
        description: descriptionParts.join('\n\n'),
        status: 'received',
        images: bookingState.imageFile ? [bookingState.imageFile] : undefined,
        scheduledDate: bookingState.preferredDate,
      };

      const jobId = await firebaseService.createJob(job);

      await notificationService.sendNotificationToUser(
        user.id,
        'Service Request Submitted',
        'Your service request has been received and is being processed.',
        'job_update'
      );

      Alert.alert('Success', 'Service request submitted successfully', [
        {
          text: 'OK',
          onPress: () => {
            setStep(1);
            setBookingState({
              selectedServiceKeys: [],
              selectedSuggestionKeys: [],
              description: '',
              imageFile: null,
              preferredDate: null,
              selectedVehicle: bookingState.selectedVehicle,
            });
            router.push('/(customer)/bookings');
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit service request');
    } finally {
      setLoading(false);
    }
  };

  const skipToDescribe = () => {
    setStep(3);
  };

  if (loadingVehicles) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Service</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Service</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No vehicles found</Text>
          <Text style={styles.emptySubtext}>
            Please add a vehicle first before booking a service
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(customer)/vehicles')}
          >
            <Text style={styles.emptyButtonText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const suggestionGroups = getSuggestionsForServices(bookingState.selectedServiceKeys);
  const selectedServices = bookingState.selectedServiceKeys.map((key) =>
    AVAILABLE_SERVICES.find((s) => s.key === key)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book Service</Text>
        <Text style={styles.stepIndicator}>Step {step} of 4</Text>
      </View>

      <ScrollView style={styles.content}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Services</Text>
            <View style={styles.servicesGrid}>
              {AVAILABLE_SERVICES.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.serviceCard,
                    bookingState.selectedServiceKeys.includes(service.key) &&
                      styles.serviceCardSelected,
                  ]}
                  onPress={() => toggleService(service.key)}
                >
                  <View
                    style={[
                      styles.serviceCheckbox,
                      bookingState.selectedServiceKeys.includes(service.key) &&
                        styles.serviceCheckboxSelected,
                    ]}
                  >
                    {bookingState.selectedServiceKeys.includes(service.key) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.serviceTitle,
                      bookingState.selectedServiceKeys.includes(service.key) &&
                        styles.serviceTitleSelected,
                    ]}
                  >
                    {service.title}
                  </Text>
                  <Text
                    style={[
                      styles.serviceDescription,
                      bookingState.selectedServiceKeys.includes(service.key) &&
                        styles.serviceDescriptionSelected,
                    ]}
                  >
                    {service.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.skipButton} onPress={skipToDescribe}>
              <Text style={styles.skipButtonText}>Describe your issue</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Suggestions</Text>
            {suggestionGroups.length === 0 ? (
              <View style={styles.emptySuggestions}>
                <Text style={styles.emptyText}>No suggestions available</Text>
                <TouchableOpacity style={styles.skipButton} onPress={skipToDescribe}>
                  <Text style={styles.skipButtonText}>I want to describe the issue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {suggestionGroups.map((group) => (
                  <View key={group.serviceKey} style={styles.suggestionGroup}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    {group.suggestions.map((suggestion) => (
                      <TouchableOpacity
                        key={suggestion.id}
                        style={[
                          styles.suggestionItem,
                          bookingState.selectedSuggestionKeys.includes(suggestion.key) &&
                            styles.suggestionItemSelected,
                        ]}
                        onPress={() => toggleSuggestion(suggestion.key)}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            bookingState.selectedSuggestionKeys.includes(suggestion.key) &&
                              styles.checkboxSelected,
                          ]}
                        >
                          {bookingState.selectedSuggestionKeys.includes(suggestion.key) && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.suggestionText,
                            bookingState.selectedSuggestionKeys.includes(suggestion.key) &&
                              styles.suggestionTextSelected,
                          ]}
                        >
                          {suggestion.title}
                        </Text>
                        {suggestion.followUpBadges && suggestion.followUpBadges.length > 0 && (
                          <View style={styles.badgesContainer}>
                            {suggestion.followUpBadges.map((badge, idx) => (
                              <View key={idx} style={styles.badge}>
                                <Text style={styles.badgeText}>{badge}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                <TouchableOpacity style={styles.skipButton} onPress={skipToDescribe}>
                  <Text style={styles.skipButtonText}>I want to describe the issue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Describe Issue</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the issue or service needed..."
              value={bookingState.description}
              onChangeText={(text) =>
                setBookingState((prev) => ({ ...prev, description: text }))
              }
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color="#007AFF" />
              <Text style={styles.imageButtonText}>
                {bookingState.imageFile ? 'Change Image' : 'Add Image'}
              </Text>
            </TouchableOpacity>
            {bookingState.imageFile && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: bookingState.imageFile }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setBookingState((prev) => ({ ...prev, imageFile: null }))}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              <Text style={styles.dateButtonText}>
                {bookingState.preferredDate
                  ? bookingState.preferredDate.toLocaleDateString() +
                    ' ' +
                    bookingState.preferredDate.toLocaleTimeString()
                  : 'Select Preferred Date & Time'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={bookingState.preferredDate || new Date()}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setBookingState((prev) => ({ ...prev, preferredDate: selectedDate }));
                  }
                }}
              />
            )}
            {selectedServices.some((s) => s?.pre_post_inspection) && (
              <View style={styles.noteContainer}>
                <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.noteText}>
                  Note: This service includes pre and post inspection
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.navigation}>
          {step > 1 && (
            <TouchableOpacity style={styles.prevButton} onPress={handlePrev}>
              <Ionicons name="arrow-back" size={20} color="#007AFF" />
              <Text style={styles.prevButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, loading && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.nextButtonText}>
              {loading
                ? 'Submitting...'
                : step === 4
                  ? 'Submit'
                  : 'Next'}
            </Text>
            {step < 4 && <Ionicons name="arrow-forward" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  stepIndicator: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  stepContainer: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: '#eee',
    minHeight: 120,
  },
  serviceCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  serviceCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceCheckboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  serviceTitleSelected: {
    color: '#007AFF',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  serviceDescriptionSelected: {
    color: '#007AFF',
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionGroup: {
    marginBottom: 25,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  suggestionItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  suggestionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  badge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptySuggestions: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 10,
    marginBottom: 15,
  },
  imageButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  imagePreview: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 15,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 10,
    marginBottom: 20,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginTop: 20,
    marginBottom: 30,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  prevButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

