import React, { useEffect, useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User, Vehicle, Job, Invoice } from '@/types';
import { BrandLogo } from '@/components/BrandLogo';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { Colors, Typography, Spacing, BorderRadius, Shadows, StatusColors } from '@/constants/design';

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
    // Technician specific
    techWeeklyAssigned: 0,
    techWeeklyCompleted: 0,
    techRating: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentJobVehicles, setRecentJobVehicles] = useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [user])
  );

  const loadDashboardData = async () => {
    if (!user?.workshopId) return;
    setRefreshing(true);

    try {
      const [jobs, invoices] = await Promise.all([
        firebaseService.getJobs(undefined, user.workshopId),
        firebaseService.getInvoices(undefined, user.workshopId),
      ]);

      // Ensure arrays are defined
      const safeJobs = Array.isArray(jobs) ? jobs : [];
      const safeInvoices = Array.isArray(invoices) ? invoices : [];

      // --- Revenue Metrics ---
      const now = new Date();
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Calculate total revenue from all paid amounts (including partial payments)
      const paidInvoices = safeInvoices.filter((inv) => inv && (inv.paymentStatus === 'paid' || inv.paymentStatus === 'partially_paid'));
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv?.amountPaid || 0), 0);

      // Calculate last month revenue from payment history
      const lastMonthRevenue = safeInvoices.reduce((sum, inv) => {
        if (!inv || !inv.paymentHistory || !Array.isArray(inv.paymentHistory) || inv.paymentHistory.length === 0) return sum;

        const lastMonthPayments = inv.paymentHistory.filter((payment) => {
          if (!payment || !payment.date) return false;
          try {
            const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
            return isWithinInterval(paymentDate, { start: lastMonthStart, end: lastMonthEnd });
          } catch (e) {
            return false;
          }
        });

        return sum + lastMonthPayments.reduce((paymentSum, p) => paymentSum + (p?.amount || 0), 0);
      }, 0);

      // --- Technician Revenue Breakdown ---
      const jobMap = new Map(safeJobs.map(j => j && j.id ? [j.id, j] : null).filter(Boolean) as [string, Job][]);
      const techRevenueMap = new Map<string, number>();

      // Calculate technician earnings from payment history
      safeInvoices.forEach(inv => {
        const job = jobMap.get(inv.jobId);
        if (job && job.assignedTechnicianId && inv.paymentHistory && Array.isArray(inv.paymentHistory) && inv.paymentHistory.length > 0) {
          const techName = job.technicianName || 'Unknown Tech';
          const current = techRevenueMap.get(techName) || 0;
          // Add all payments for this invoice to technician's earnings
          const invoicePayments = inv.paymentHistory.reduce((sum, p) => sum + (p?.amount || 0), 0);
          techRevenueMap.set(techName, current + invoicePayments);
        }
      });

      const technicianRevenue = Array.from(techRevenueMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      // --- Completed Jobs ---
      const completedJobs = safeJobs.filter(j => j && j.status === 'completed').length;
      const lastMonthCompletedJobs = safeJobs.filter(j =>
        j &&
        j.status === 'completed' &&
        j.completedAt &&
        isWithinInterval(j.completedAt, { start: lastMonthStart, end: lastMonthEnd })
      ).length;

      // --- Technician Specific Stats ---
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      let techWeeklyAssigned = 0;
      let techWeeklyCompleted = 0;
      const techRating = 4.9; // Placeholder for now

      let filteredRecentJobs: Job[] = [];

      if (user.role === 'technician') {
        const myJobs = safeJobs.filter(j => j && j.assignedTechnicianId === user.id);

        techWeeklyAssigned = myJobs.filter(j =>
          j && j.createdAt && isWithinInterval(j.createdAt, { start: weekStart, end: weekEnd })
        ).length;

        techWeeklyCompleted = myJobs.filter(j =>
          j &&
          j.status === 'completed' &&
          j.completedAt && isWithinInterval(j.completedAt, { start: weekStart, end: weekEnd })
        ).length;

        // For technicians, recent jobs should be their assigned ACTIVE jobs
        const activeJobs = myJobs.filter(j => j && ['received', 'diagnosed', 'repairing'].includes(j.status));
        filteredRecentJobs = activeJobs.slice(0, 5);
      } else {
        filteredRecentJobs = safeJobs.slice(0, 5);
      }

      setRecentJobs(filteredRecentJobs);
      setStats({
        totalRevenue,
        lastMonthRevenue,
        technicianRevenue,
        completedJobs,
        lastMonthCompletedJobs,
        techWeeklyAssigned,
        techWeeklyCompleted,
        techRating,
      });

      // --- Fetch Vehicles for Recent Jobs ---
      const vehicleMap: Record<string, any> = {};
      await Promise.all(
        filteredRecentJobs.map(async (job) => {
          if (job.vehicleId && job.userId) {
            // In a real app we might have getVehicleById, but here we might have to get user vehicles
            // Assuming we can get all vehicles and filter (inefficient) or get by user
            try {
              const vehicles = await firebaseService.getVehicles(job.userId);
              const vehicle = vehicles.find(v => v.id === job.vehicleId);
              if (vehicle) {
                vehicleMap[job.id] = vehicle;
              }
            } catch (e) {
              console.log('Error fetching vehicle for job', job.id, e);
            }
          }
        })
      );
      setRecentJobVehicles(vehicleMap);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <DashboardHeader user={user} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.textPrimary} />
        }
      >
        {getRoleDashboard({ user, stats, recentJobs, recentJobVehicles })}
      </ScrollView>
    </View>
  );
}

function getRoleDashboard({ user, stats, recentJobs, recentJobVehicles }: { user: any, stats: any, recentJobs: Job[], recentJobVehicles: Record<string, any> }) {
  switch (user?.role) {
    case 'admin':
      return <AdminDashboard stats={stats} recentJobs={recentJobs} recentJobVehicles={recentJobVehicles} />;
    case 'technician':
      return <TechnicianDashboard stats={stats} recentJobs={recentJobs} recentJobVehicles={recentJobVehicles} />;
    default:
      return <Text>Dashboard not available for this role</Text>;
  }
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
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/(workshop)/settings')}
            >
              <Ionicons name="person-circle-outline" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function TechnicianDashboard({ stats, recentJobs, recentJobVehicles }: { stats: any, recentJobs: Job[], recentJobVehicles: Record<string, any> }) {
  const router = useRouter();

  return (
    <View style={styles.contentContainer}>
      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PADDING,
            paddingBottom: 20,
          }}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          snapToAlignment="start"
        >
          <View style={styles.slideContainer}>
            <WeeklyMetricsCard assigned={stats.techWeeklyAssigned} completed={stats.techWeeklyCompleted} />
          </View>
        </ScrollView>
      </View>

      <View style={styles.recentSectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Jobs In Progress</Text>
        </View>

        {recentJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active jobs assigned.</Text>
          </View>
        ) : (
          recentJobs.map((job) => (
            <RecentJobItem key={job.id} job={job} vehicle={recentJobVehicles[job.id]} />
          ))
        )}
      </View>
    </View>
  );
}

function WeeklyMetricsCard({ assigned, completed }: { assigned: number, completed: number }) {
  return (
    <View style={styles.blackCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricTitle}>Weekly Overview</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 40, marginTop: 20 }}>
        <View>
          <Text style={styles.metricValue}>{assigned}</Text>
          <Text style={styles.growthLabel}>Assigned</Text>
        </View>
        <View>
          <Text style={styles.metricValue}>{completed}</Text>
          <Text style={styles.growthLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.metricFooter}>
        <Text style={{ color: Colors.textSecondary, fontSize: Typography.fontSize.xs }}>Performance this week</Text>
      </View>
    </View>
  );
}

function AdminDashboard({
  stats,
  recentJobs,
  recentJobVehicles,
}: {
  stats: any;
  recentJobs: Job[];
  recentJobVehicles: Record<string, any>;
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
            <RecentJobItem key={job.id} job={job} vehicle={recentJobVehicles[job.id]} />
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
          <Ionicons name="arrow-up" size={14} color={Colors.textPrimary} style={{ transform: [{ rotate: '45deg' }] }} />
        </View>
      </View>

      <Text style={styles.metricValue}>{value}</Text>

      <View style={styles.metricFooter}>
        <View style={styles.growthContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={isPositive ? "arrow-up" : "arrow-down"}
              size={16}
              color={isPositive ? Colors.success : Colors.error}
            />
            <Text style={[styles.growthText, { color: isPositive ? Colors.success : Colors.error }]}>
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
                  backgroundColor: Colors.surface,
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
          <Ionicons name="people" size={14} color={Colors.textPrimary} />
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

function RecentJobItem({ job, vehicle }: { job: Job, vehicle?: any }) {
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
    return StatusColors[status] || Colors.textSecondary;
  };

  const getIssueLabel = () => {
    if (job.issues && job.issues.length > 0) {
      const [first, ...rest] = job.issues;
      return rest.length > 0 ? `${first} +${rest.length}` : first;
    }
    return job.description;
  };

  return (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => router.push(`/(workshop)/job-details?id=${job.id}`)}
    >
      {/* Icon/Logo Column */}
      <View style={[styles.iconBox, { backgroundColor: vehicle ? 'transparent' : getStatusColor(job.status), marginRight: 15 }]}>
        {vehicle ? (
          <BrandLogo brand={vehicle.make} size={30} />
        ) : (
          <Ionicons name={getStatusIcon(job.status)} size={24} color="#fff" />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={styles.recentTitle} numberOfLines={1}>{getIssueLabel()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '15', marginLeft: 8 }]}>
            <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
          </View>
        </View>

        <Text style={styles.tagText}>
          {vehicle ? `${vehicle.make} ${vehicle.model}` : (job.type === 'service' ? 'Service' : 'Complaint')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    paddingTop: Platform.OS === 'android' ? 40 : Spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  headerName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing.xl,
    height: 200,
    justifyContent: 'space-between',
    ...Shadows.xl,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricTitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
    fontWeight: Typography.fontWeight.medium,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textInverse,
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
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.regular,
    fontSize: Typography.fontSize.xs,
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
    backgroundColor: Colors.borderDark,
  },
  paginationDotActive: {
    backgroundColor: Colors.secondary,
    width: 24,
  },
  recentSectionContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDark,
  },
  recentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  recentInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  recentTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  recentMeta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  tagContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  emptyTextWhite: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  techList: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondaryLight,
    paddingBottom: Spacing.sm,
  },
  techName: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
  },
  techAmount: {
    color: Colors.success,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
});
