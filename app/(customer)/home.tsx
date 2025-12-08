import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Job, Notification } from '@/types';
import { Ionicons } from '@expo/vector-icons';

export default function CustomerHomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'appointment' | 'tow' | 'orders'>('appointment');
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    try {
      const jobsQuery = query(
        collection(db, 'jobs'),
        where('userId', '==', user.id),
        where('status', 'in', ['received', 'diagnosed', 'repairing']),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobs = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Job[];
      setActiveJobs(jobs);

      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.id),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notifications = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Notification[];
      setNotifications(notifications);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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

  const ongoingJob = activeJobs.length > 0 ? activeJobs[0] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={24} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.welcomeText}>Welcome,</Text>
            <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(customer)/notifications')}>
          <Ionicons name="notifications-outline" size={24} color="#000" />
          {notifications.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notifications.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {ongoingJob && (
          <View style={styles.banner}>
            <View style={styles.bannerContent}>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Ongoing Repair</Text>
                <Text style={styles.bannerSubtitle}>
                  {ongoingJob.type === 'service' ? 'Service' : 'Complaint'} in progress
                </Text>
          <TouchableOpacity
                  style={styles.bannerButton}
                  onPress={() => router.push(`/(customer)/job-details?id=${ongoingJob.id}`)}
          >
                  <Text style={styles.bannerButtonText}>View Details</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
              </View>
              <View style={styles.bannerIcon}>
                <Ionicons name="construct" size={48} color="#fff" />
              </View>
            </View>
          </View>
        )}

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'appointment' && styles.tabActive]}
            onPress={() => {
              setActiveTab('appointment');
              router.push('/(customer)/service');
            }}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={activeTab === 'appointment' ? '#fff' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === 'appointment' && styles.tabTextActive]}>
              Book Appointment
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'tow' && styles.tabActive]}
            onPress={() => {
              setActiveTab('tow');
            }}
          >
            <Ionicons
              name="car-outline"
              size={20}
              color={activeTab === 'tow' ? '#fff' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === 'tow' && styles.tabTextActive]}>
              Request Tow
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
            onPress={() => {
              setActiveTab('orders');
              router.push('/(marketplace)/orders');
            }}
          >
            <Ionicons
              name="bag-outline"
              size={20}
              color={activeTab === 'orders' ? '#fff' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
              Orders
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested Services</Text>
          <View style={styles.servicesList}>
              <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => router.push('/(customer)/service')}
              >
              <View style={styles.serviceIcon}>
                <Ionicons name="build-outline" size={32} color="#666" />
                  </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>General Service</Text>
                <View style={styles.serviceStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.serviceStatusText}>Available</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
              </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => router.push('/(customer)/service')}
            >
              <View style={styles.serviceIcon}>
                <Ionicons name="car-sport-outline" size={32} color="#666" />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>Oil Change</Text>
                <View style={styles.serviceStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.serviceStatusText}>Available</Text>
        </View>
            </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

              <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => router.push('/(customer)/service')}
            >
              <View style={styles.serviceIcon}>
                <Ionicons name="settings-outline" size={32} color="#666" />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>Brake Service</Text>
                <View style={styles.serviceStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.serviceStatusText}>Available</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
          </View>
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
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  banner: {
    backgroundColor: '#007AFF',
    margin: 15,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 12,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  bannerIcon: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  serviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 6,
  },
  serviceStatusText: {
    fontSize: 14,
    color: '#34C759',
  },
});
