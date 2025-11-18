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
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Job, Invoice, InventoryItem } from '@/types';
import { format } from 'date-fns';

export default function WorkshopDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({
    activeJobs: 0,
    pendingInvoices: 0,
    lowStockItems: 0,
    todayRevenue: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.workshopId) return;

    try {
      const activeJobs = await firebaseService.getJobs(
        undefined,
        user.workshopId,
        ['received', 'diagnosed', 'repairing']
      );
      setStats((prev) => ({ ...prev, activeJobs: activeJobs.length }));
      setRecentJobs(activeJobs.slice(0, 5));

      const invoices = await firebaseService.getInvoices(undefined, user.workshopId);
      const pending = invoices.filter((inv) => inv.paymentStatus === 'pending');
      setStats((prev) => ({ ...prev, pendingInvoices: pending.length }));

      const inventory = await firebaseService.getInventoryItems(user.workshopId);
      const lowStock = inventory.filter(
        (item) => item.quantity <= item.minStockLevel
      );
      setStats((prev) => ({ ...prev, lowStockItems: lowStock.length }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayInvoices = invoices.filter(
        (inv) =>
          inv.paymentStatus === 'paid' &&
          inv.paymentDate &&
          inv.paymentDate >= today
      );
      const revenue = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      setStats((prev) => ({ ...prev, todayRevenue: revenue }));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getRoleDashboard = () => {
    switch (user?.role) {
      case 'admin':
        return <AdminDashboard stats={stats} recentJobs={recentJobs} />;
      case 'technician':
        return <TechnicianDashboard stats={stats} recentJobs={recentJobs} />;
      case 'storekeeper':
        return <StorekeeperDashboard stats={stats} />;
      case 'accountant':
        return <AccountantDashboard stats={stats} />;
      case 'service_advisor':
        return <ServiceAdvisorDashboard stats={stats} recentJobs={recentJobs} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {user?.name} - {user?.role?.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(workshop)/settings')}>
          <Ionicons name="settings-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {getRoleDashboard()}
      </ScrollView>
    </View>
  );
}

// Admin Dashboard
function AdminDashboard({
  stats,
  recentJobs,
}: {
  stats: any;
  recentJobs: Job[];
}) {
  const router = useRouter();

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard
          icon="briefcase-outline"
          label="Active Jobs"
          value={stats.activeJobs.toString()}
          color="#007AFF"
          onPress={() => router.push('/(workshop)/jobs')}
        />
        <StatCard
          icon="receipt-outline"
          label="Pending Invoices"
          value={stats.pendingInvoices.toString()}
          color="#FFA500"
          onPress={() => router.push('/(workshop)/invoices')}
        />
        <StatCard
          icon="cube-outline"
          label="Low Stock"
          value={stats.lowStockItems.toString()}
          color="#FF3B30"
          onPress={() => router.push('/(workshop)/inventory')}
        />
        <StatCard
          icon="cash-outline"
          label="Today's Revenue"
          value={`₦${stats.todayRevenue.toLocaleString()}`}
          color="#30D158"
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          <TouchableOpacity onPress={() => router.push('/(workshop)/jobs')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active jobs</Text>
          </View>
        ) : (
          recentJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))
        )}
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="people-outline"
            label="Customers"
            onPress={() => router.push('/(workshop)/customers')}
          />
          <ActionButton
            icon="car-outline"
            label="Vehicles"
            onPress={() => router.push('/(workshop)/vehicles')}
          />
          <ActionButton
            icon="bar-chart-outline"
            label="Reports"
            onPress={() => router.push('/(workshop)/reports')}
          />
          <ActionButton
            icon="settings-outline"
            label="Settings"
            onPress={() => router.push('/(workshop)/settings')}
          />
        </View>
      </View>
    </>
  );
}

// Technician Dashboard
function TechnicianDashboard({
  stats,
  recentJobs,
}: {
  stats: any;
  recentJobs: Job[];
}) {
  const router = useRouter();
  const { user } = useAuthStore();

  const myJobs = recentJobs.filter(
    (job) => job.assignedTechnicianId === user?.id
  );

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard
          icon="briefcase-outline"
          label="My Jobs"
          value={myJobs.length.toString()}
          color="#007AFF"
          onPress={() => router.push('/(workshop)/jobs')}
        />
        <StatCard
          icon="time-outline"
          label="In Progress"
          value={myJobs.filter((j) => j.status === 'repairing').length.toString()}
          color="#34C759"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Assigned Jobs</Text>
        {myJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No assigned jobs</Text>
          </View>
        ) : (
          myJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))
        )}
      </View>
    </>
  );
}

// Storekeeper Dashboard
function StorekeeperDashboard({ stats }: { stats: any }) {
  const router = useRouter();

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard
          icon="cube-outline"
          label="Low Stock Items"
          value={stats.lowStockItems.toString()}
          color="#FF3B30"
          onPress={() => router.push('/(workshop)/inventory')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory Management</Text>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(workshop)/inventory')}
        >
          <Ionicons name="cube-outline" size={32} color="#007AFF" />
          <Text style={styles.actionText}>Manage Inventory</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// Accountant Dashboard
function AccountantDashboard({ stats }: { stats: any }) {
  const router = useRouter();

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard
          icon="receipt-outline"
          label="Pending Invoices"
          value={stats.pendingInvoices.toString()}
          color="#FFA500"
          onPress={() => router.push('/(workshop)/invoices')}
        />
        <StatCard
          icon="cash-outline"
          label="Today's Revenue"
          value={`₦${stats.todayRevenue.toLocaleString()}`}
          color="#30D158"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Financial Management</Text>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(workshop)/invoices')}
        >
          <Ionicons name="receipt-outline" size={32} color="#007AFF" />
          <Text style={styles.actionText}>Manage Invoices</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(workshop)/reports')}
        >
          <Ionicons name="bar-chart-outline" size={32} color="#007AFF" />
          <Text style={styles.actionText}>View Reports</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// Service Advisor Dashboard
function ServiceAdvisorDashboard({
  stats,
  recentJobs,
}: {
  stats: any;
  recentJobs: Job[];
}) {
  const router = useRouter();

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard
          icon="briefcase-outline"
          label="Active Jobs"
          value={stats.activeJobs.toString()}
          color="#007AFF"
          onPress={() => router.push('/(workshop)/jobs')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Jobs</Text>
        {recentJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active jobs</Text>
          </View>
        ) : (
          recentJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))
        )}
      </View>
    </>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  onPress?: () => void;
}) {
  const Card = onPress ? TouchableOpacity : View;
  return (
    <Card
      style={[styles.statCard, onPress && styles.statCardPressable]}
      onPress={onPress}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// Job Card Component
function JobCard({ job }: { job: Job }) {
  const router = useRouter();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return '#FFA500';
      case 'diagnosed': return '#007AFF';
      case 'repairing': return '#34C759';
      case 'completed': return '#30D158';
      default: return '#666';
    }
  };

  return (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => router.push(`/(workshop)/job-details?id=${job.id}`)}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobType}>
          {job.type === 'service' ? 'Service' : 'Complaint'}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(job.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.jobDescription} numberOfLines={2}>
        {job.description}
      </Text>
      <Text style={styles.jobDate}>
        {format(job.createdAt, 'MMM dd, yyyy')}
      </Text>
    </TouchableOpacity>
  );
}

// Action Button Component
function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon as any} size={24} color="#007AFF" />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardPressable: {
    // Additional styles for pressable cards
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  seeAll: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  jobType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  jobDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  jobDate: {
    fontSize: 12,
    color: '#999',
  },
  quickActions: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  actionButton: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

