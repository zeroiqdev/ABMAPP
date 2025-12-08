import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Job, Invoice } from '@/types';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_SPACING = 15;
const SIDE_PADDING = (width - CARD_WIDTH) / 2;

export default function WorkshopDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    lastMonthRevenue: 0,
    technicianRevenue: [] as { name: string; amount: number }[],
    completedJobs: 0,
    lastMonthCompletedJobs: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.workshopId) return;

    try {
      const [jobs, invoices] = await Promise.all([
        firebaseService.getJobs(undefined, user.workshopId),
        firebaseService.getInvoices(undefined, user.workshopId),
      ]);

      // --- Revenue Metrics ---
      const now = new Date();
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Calculate total revenue from all paid amounts (including partial payments)
      const paidInvoices = invoices.filter((inv) => inv.paymentStatus === 'paid' || inv.paymentStatus === 'partially_paid');
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

      // Calculate last month revenue from payment history
      const lastMonthRevenue = invoices.reduce((sum, inv) => {
        if (!inv.paymentHistory || inv.paymentHistory.length === 0) return sum;
        
        const lastMonthPayments = inv.paymentHistory.filter((payment) => {
          const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
          return isWithinInterval(paymentDate, { start: lastMonthStart, end: lastMonthEnd });
        });
        
        return sum + lastMonthPayments.reduce((paymentSum, p) => paymentSum + p.amount, 0);
      }, 0);

      // --- Technician Revenue Breakdown ---
      const jobMap = new Map(jobs.map(j => [j.id, j]));
      const techRevenueMap = new Map<string, number>();

      // Calculate technician earnings from payment history
      invoices.forEach(inv => {
        const job = jobMap.get(inv.jobId);
        if (job && job.assignedTechnicianId && inv.paymentHistory && inv.paymentHistory.length > 0) {
          const techName = job.technicianName || 'Unknown Tech';
          const current = techRevenueMap.get(techName) || 0;
          // Add all payments for this invoice to technician's earnings
          const invoicePayments = inv.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
          techRevenueMap.set(techName, current + invoicePayments);
        }
      });

      const technicianRevenue = Array.from(techRevenueMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      // --- Completed Jobs ---
      const completedJobs = jobs.filter(j => j.status === 'completed').length;
      const lastMonthCompletedJobs = jobs.filter(j =>
        j.status === 'completed' &&
        j.completedAt &&
        isWithinInterval(j.completedAt, { start: lastMonthStart, end: lastMonthEnd })
      ).length;

      setStats({
        totalRevenue,
        lastMonthRevenue,
        technicianRevenue,
        completedJobs,
        lastMonthCompletedJobs,
      });

      setRecentJobs(jobs.slice(0, 5));

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
    return <AdminDashboard stats={stats} recentJobs={recentJobs} />;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <DashboardHeader user={user} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      >
        {getRoleDashboard()}
      </ScrollView>
    </View>
  );
}

function DashboardHeader({ user }: { user: any }) {
  const router = useRouter();
  return (
    <View style={styles.headerContainer}>
      <SafeAreaView>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerGreeting}>Welcome back,</Text>
            <Text style={styles.headerName}>{user?.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="search-outline" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/(workshop)/settings')}
            >
              <Ionicons name="person-outline" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function AdminDashboard({
  stats,
  recentJobs,
}: {
  stats: any;
  recentJobs: Job[];
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueGrowth = calculateGrowth(stats.totalRevenue, stats.lastMonthRevenue);
  const jobsGrowth = calculateGrowth(stats.completedJobs, stats.lastMonthCompletedJobs);

  const handleScroll = (event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollX / (CARD_WIDTH + CARD_SPACING));
    setActiveIndex(index);
  };

  return (
    <>
      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          snapToAlignment="start"
          contentContainerStyle={{
            paddingHorizontal: SIDE_PADDING,
            paddingBottom: 20,
          }}
        >
          {/* Slide 1: Revenue */}
          <View style={styles.slideContainer}>
            <MetricCard
              title="Revenue Generated"
              value={`₦${stats.totalRevenue.toLocaleString()}`}
              growth={revenueGrowth}
              chartData={[40, 60, 45, 70, 80, 65, 85]}
            />
          </View>

          {/* Slide 2: Technician Revenue */}
          <View style={styles.slideContainer}>
            <TechnicianRevenueCard data={stats.technicianRevenue} />
          </View>

          {/* Slide 3: Jobs Completed */}
          <View style={styles.slideContainer}>
            <MetricCard
              title="Jobs Completed"
              value={stats.completedJobs.toString()}
              growth={jobsGrowth}
              chartData={[20, 30, 25, 40, 35, 50, 45]}
              isCurrency={false}
            />
          </View>
        </ScrollView>

        <View style={styles.pagination}>
          {[0, 1, 2].map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === activeIndex ? styles.paginationDotActive : null,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.recentSectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Jobs and Requests</Text>
          <TouchableOpacity
            style={styles.arrowButton}
            onPress={() => router.push('/(workshop)/jobs')}
          >
            <Ionicons name="arrow-forward" size={20} color="#333" />
          </TouchableOpacity>
        </View>

        {recentJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        ) : (
          recentJobs.map((job) => (
            <RecentJobItem key={job.id} job={job} />
          ))
        )}
      </View>
    </>
  );
}

function MetricCard({
  title,
  value,
  growth,
  chartData,
  isCurrency = true,
}: {
  title: string;
  value: string;
  growth: number;
  chartData: number[];
  isCurrency?: boolean;
}) {
  const isPositive = growth >= 0;

  return (
    <View style={styles.blackCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricTitle}>{title}</Text>
        <View style={styles.metricIconCircle}>
          <Ionicons name="arrow-up" size={14} color="#000" style={{ transform: [{ rotate: '45deg' }] }} />
        </View>
      </View>

      <Text style={styles.metricValue}>{value}</Text>

      <View style={styles.metricFooter}>
        <View style={styles.growthContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={isPositive ? "arrow-up" : "arrow-down"}
              size={16}
              color={isPositive ? "#34C759" : "#FF3B30"}
            />
            <Text style={[styles.growthText, { color: isPositive ? "#34C759" : "#FF3B30" }]}>
              {Math.abs(growth).toFixed(1)}%
            </Text>
          </View>
          <Text style={styles.growthLabel}>Than last month</Text>
        </View>

        <View style={styles.miniChart}>
          {chartData.map((height, index) => (
            <View
              key={index}
              style={[
                styles.chartBar,
                {
                  height: `${height}%`,
                  backgroundColor: '#fff',
                  opacity: 0.6 + (index / chartData.length) * 0.4
                }
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function TechnicianRevenueCard({ data }: { data: { name: string; amount: number }[] }) {
  return (
    <View style={styles.blackCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricTitle}>Technician Revenue</Text>
        <View style={styles.metricIconCircle}>
          <Ionicons name="people" size={14} color="#000" />
        </View>
      </View>

      <View style={styles.techList}>
        {data.length === 0 ? (
          <Text style={styles.emptyTextWhite}>No data available</Text>
        ) : (
          data.map((tech, index) => (
            <View key={index} style={styles.techRow}>
              <Text style={styles.techName}>{tech.name}</Text>
              <Text style={styles.techAmount}>₦{tech.amount.toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function RecentJobItem({ job }: { job: Job }) {
  const router = useRouter();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return 'mail-outline';
      case 'diagnosed': return 'search-outline';
      case 'repairing': return 'construct-outline';
      case 'completed': return 'checkmark-circle-outline';
      default: return 'help-outline';
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

  return (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => router.push(`/(workshop)/job-details?id=${job.id}`)}
    >
      <View style={[styles.recentIconContainer, { backgroundColor: '#F5F6FA' }]}>
        <Ionicons name={getStatusIcon(job.status) as any} size={24} color={getStatusColor(job.status)} />
      </View>
      <View style={styles.recentInfo}>
        <Text style={styles.recentTitle}>{job.type === 'service' ? 'Service' : 'Complaint'}</Text>
        <Text style={styles.recentSubtitle} numberOfLines={1}>
          {format(job.updatedAt, 'MMM dd, yyyy')} | {job.description}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '15' }]}>
        <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    fontSize: 14,
    color: '#666',
  },
  headerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  carouselContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  slideContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  blackCard: {
    backgroundColor: '#000',
    borderRadius: 30,
    padding: 24,
    height: 200,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricTitle: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  growthContainer: {
    flex: 1,
  },
  growthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  growthLabel: {
    color: '#666',
    fontWeight: '400',
    fontSize: 12,
    marginTop: 2,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 30,
    gap: 4,
  },
  chartBar: {
    width: 6,
    borderRadius: 3,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D1D6',
  },
  paginationDotActive: {
    backgroundColor: '#000',
    width: 24,
  },
  recentSectionContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 30,
    padding: 20,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  recentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recentInfo: {
    flex: 1,
    marginRight: 10,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  recentSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  recentMeta: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  emptyTextWhite: {
    fontSize: 14,
    color: '#666',
  },
  techList: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 8,
  },
  techName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  techAmount: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
