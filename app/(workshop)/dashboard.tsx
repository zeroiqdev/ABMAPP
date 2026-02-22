import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User, Vehicle, Job, Invoice } from '@/types';
import { BrandLogo } from '@/components/BrandLogo';
import { MonthPickerModal } from '@/components/MonthPickerModal';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, differenceInMonths, sub } from 'date-fns';
import { Colors, Typography, Spacing, BorderRadius, Shadows, StatusColors, useColors } from '@/constants/design';
import { useThemeStore } from '@/store/themeStore';
import { AppConfig } from '@/constants/config';



const { width } = Dimensions.get('window');
const CARD_SPACING = 16; // Changed from 15
const SIDE_PADDING = 20; // Changed from (width - CARD_WIDTH) / 2
const CARD_WIDTH = width - (SIDE_PADDING * 2); // Changed from width * 0.85




export default function WorkshopDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { themeMode } = useThemeStore();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });

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

    totalOwed: 0,
    pendingJobsCount: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentJobVehicles, setRecentJobVehicles] = useState<Record<string, any>>({});
  const [birthdaysToday, setBirthdaysToday] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.workshopId) {
        loadDashboardData();
      }
    }, [user?.workshopId, dateRange])
  );

  const loadDashboardData = async () => {
    if (!user?.workshopId) return;
    setRefreshing(true);

    try {
      const [jobs, invoices, allUsers] = await Promise.all([
        firebaseService.getJobs(undefined, user.workshopId),
        firebaseService.getInvoices(undefined, user.workshopId),
        firebaseService.getUsersByWorkshop(user.workshopId),
      ]);

      // Ensure arrays are defined
      const safeJobs = Array.isArray(jobs) ? jobs : [];
      const safeInvoices = Array.isArray(invoices) ? invoices : [];

      // --- Revenue Metrics ---
      const currentPeriodStart = startOfMonth(dateRange.start);
      const currentPeriodEnd = endOfMonth(dateRange.end);

      // Calculate previous period based on duration
      const durationInMonths = differenceInMonths(currentPeriodEnd, currentPeriodStart) + 1;
      const prevPeriodStart = startOfMonth(sub(currentPeriodStart, { months: durationInMonths }));
      const prevPeriodEnd = endOfMonth(sub(currentPeriodEnd, { months: durationInMonths }));

      // Calculate Revenue based on Payment History within the period
      const calculateRevenueForPeriod = (start: Date, end: Date) => {
        return safeInvoices.reduce((sum, inv) => {
          if (!inv || !inv.paymentHistory || !Array.isArray(inv.paymentHistory) || inv.paymentHistory.length === 0) return sum;

          const periodPayments = inv.paymentHistory.filter((payment) => {
            if (!payment || !payment.date) return false;
            try {
              const pDate = payment.date;
              const paymentDate = (pDate as any).toDate ? (pDate as any).toDate() : new Date(pDate);
              return isWithinInterval(paymentDate, { start, end });
            } catch (e) {
              return false;
            }
          });

          return sum + periodPayments.reduce((pSum, p) => pSum + (p?.amount || 0), 0);
        }, 0);
      };

      const totalRevenue = calculateRevenueForPeriod(currentPeriodStart, currentPeriodEnd);

      const lastMonthRevenue = calculateRevenueForPeriod(prevPeriodStart, prevPeriodEnd);

      // --- New Metrics: Outstanding Payments & Pending Jobs ---
      const totalOwed = safeInvoices.reduce((sum, inv) => {
        const paid = inv.amountPaid || 0;
        const total = inv.total || 0;
        const balance = total - paid;
        return sum + (balance > 0 ? balance : 0);
      }, 0);

      const pendingJobsCount = safeJobs.filter(j =>
        j && j.status !== 'completed' && j.status !== 'cancelled'
      ).length;

      // --- Technician Revenue Breakdown (Current Period) ---
      const jobMap = new Map(safeJobs.map(j => j && j.id ? [j.id, j] : null).filter(Boolean) as [string, Job][]);
      const techRevenueMap = new Map<string, number>();

      safeInvoices.forEach(inv => {
        if (!inv.jobId) return;
        const job = jobMap.get(inv.jobId);
        if (job && job.assignedTechnicianId && inv.paymentHistory && Array.isArray(inv.paymentHistory)) {
          // Only count payments in current period
          const periodPayments = inv.paymentHistory.filter((payment) => {
            if (!payment || !payment.date) return false;
            try {
              const pDate = payment.date;
              const paymentDate = (pDate as any).toDate ? (pDate as any).toDate() : new Date(pDate);
              return isWithinInterval(paymentDate, { start: currentPeriodStart, end: currentPeriodEnd });
            } catch (e) {
              return false;
            }
          });

          if (periodPayments.length > 0) {
            const techName = job.technicianName || 'Unknown Tech';
            const current = techRevenueMap.get(techName) || 0;
            const amount = periodPayments.reduce((sum, p) => sum + (p?.amount || 0), 0);
            techRevenueMap.set(techName, current + amount);
          }
        }
      });

      const technicianRevenue = Array.from(techRevenueMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
      // Removed .slice(0, 3) to give full list for interactive card later? Or keep it?
      // Let's keep all data for the interactive card task.

      // --- Completed Jobs ---
      const getJobDate = (dateField: any) => {
        if (!dateField) return new Date();
        return dateField.toDate ? dateField.toDate() : new Date(dateField);
      };

      const completedJobs = safeJobs.filter(j =>
        j &&
        j.status === 'completed' &&
        j.completedAt &&
        isWithinInterval(getJobDate(j.completedAt), { start: currentPeriodStart, end: currentPeriodEnd })
      ).length;

      const lastMonthCompletedJobs = safeJobs.filter(j =>
        j &&
        j.status === 'completed' &&
        j.completedAt &&
        isWithinInterval(getJobDate(j.completedAt), { start: prevPeriodStart, end: prevPeriodEnd })
      ).length;

      // --- Technician Specific Metrics (Keep weekly for now as it's a specific metric?)
      // Or update to use dateRange too? User request "metrics card... select timeframe". 
      // Technician Dashboard has "Weekly Overview". This explicitly says "Weekly". 
      // Changing it to arbitrary range might break context.
      // But adding "Month/Range Picker" to Technician dashboard implies it affects SOMETHING.
      // Let's make it affect "Assigned" and "Completed" counts instead of "Weekly".

      const rangeStart = startOfMonth(dateRange.start); // Enforce full month if picker only does months
      const rangeEnd = endOfMonth(dateRange.end);

      const techAssigned = safeJobs.filter(j =>
        j.assignedTechnicianId === user.id &&
        j.createdAt &&
        isWithinInterval(getJobDate(j.createdAt), { start: rangeStart, end: rangeEnd })
      ).length;

      const techCompleted = safeJobs.filter(j =>
        j.assignedTechnicianId === user.id &&
        j.status === 'completed' &&
        j.completedAt &&
        isWithinInterval(getJobDate(j.completedAt), { start: rangeStart, end: rangeEnd })
      ).length;

      // Mock rating (replace with real data if available)
      const techRating = 4.8;

      setStats({
        totalRevenue,
        lastMonthRevenue,
        technicianRevenue, // Now has all techs
        completedJobs,
        lastMonthCompletedJobs,
        techWeeklyAssigned: techAssigned, // reusing state name but it's now Period Assigned
        techWeeklyCompleted: techCompleted,
        techRating,

        totalOwed,
        pendingJobsCount,
      });

      // ... recent jobs logic same ...
      let filteredRecentJobs: Job[] = [];
      if (user.role === 'admin' || user.role === 'super_admin') {
        filteredRecentJobs = safeJobs
          .sort((a, b) => (getJobDate(b.createdAt).getTime() || 0) - (getJobDate(a.createdAt).getTime() || 0))
          .slice(0, 5);
      } else if (user.role === 'technician') {
        filteredRecentJobs = safeJobs
          .filter(j => j.assignedTechnicianId === user.id && j.status !== 'completed' && j.status !== 'cancelled')
          .sort((a, b) => (getJobDate(b.createdAt).getTime() || 0) - (getJobDate(a.createdAt).getTime() || 0))
          .slice(0, 5);
      }
      setRecentJobs(filteredRecentJobs);

      // ... vehicle fetching same ...
      const vehicleMap: Record<string, any> = {};
      await Promise.all(
        filteredRecentJobs.map(async (job) => {
          if (job.vehicleId) {
            try {
              const vehicle = await firebaseService.getVehicle(job.vehicleId);
              if (vehicle) {
                vehicleMap[job.id] = vehicle;
              }
            } catch (e) {
              console.log('Error fetching vehicle', e);
            }
          }
        })
      );
      setRecentJobVehicles(vehicleMap);

      // --- Birthdays Today ---
      const today = format(new Date(), 'MM-dd');
      const celebratingToday = allUsers.filter(u => {
        if (!u.birthday) return false;
        // birthday format: YYYY-MM-DD or MM-DD
        return u.birthday.includes(today);
      });
      setBirthdaysToday(celebratingToday);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeMode === 'dark' ? "light-content" : "dark-content"} />
      <DashboardHeader
        user={user}
      />

      <ScrollView
        style={[styles.content, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
      >
        {getRoleDashboard({ user, stats, recentJobs, recentJobVehicles, birthdaysToday, onOpenMonthPicker: () => setMonthPickerVisible(true) })}
      </ScrollView>

      <MonthPickerModal
        visible={monthPickerVisible}
        dateRange={dateRange}
        onRangeChange={setDateRange}
        onClose={() => setMonthPickerVisible(false)}
      />
    </View>
  );
}

function getRoleDashboard({ user, stats, recentJobs, recentJobVehicles, birthdaysToday, onOpenMonthPicker }: { user: any, stats: any, recentJobs: Job[], recentJobVehicles: Record<string, any>, birthdaysToday: User[], onOpenMonthPicker: () => void }) {
  const router = useRouter();

  switch (user?.role) {
    case 'admin':
    case 'super_admin':
      return <AdminDashboard user={user} stats={stats} recentJobs={recentJobs} recentJobVehicles={recentJobVehicles} birthdaysToday={birthdaysToday} onOpenMonthPicker={onOpenMonthPicker} />;
    case 'technician':
      return <TechnicianDashboard stats={stats} recentJobs={recentJobs} recentJobVehicles={recentJobVehicles} onOpenMonthPicker={onOpenMonthPicker} />;
    default:
      // If user ends up here without dashboard access, redirect them to finance (most common for custom roles)
      // The layout's initialRouteName should handle this, but as fallback redirect to finance
      useEffect(() => {
        router.replace('/(workshop)/finance');
      }, []);
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 16, color: Colors.textSecondary, textAlign: 'center' }}>
            Redirecting to your available modules...
          </Text>
        </View>
      );
  }
}

function DashboardHeader({
  user,
}: {
  user: any;
}) {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
      <SafeAreaView>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerGreeting, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.headerName, { color: colors.textPrimary }]}>{user?.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/(workshop)/settings')}
            >
              <Ionicons name="person-circle-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function TechnicianDashboard({ stats, recentJobs, recentJobVehicles, onOpenMonthPicker }: { stats: any, recentJobs: Job[], recentJobVehicles: Record<string, any>, onOpenMonthPicker: () => void }) {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
            <WeeklyMetricsCard
              assigned={stats.techWeeklyAssigned}
              completed={stats.techWeeklyCompleted}
              onPressIcon={onOpenMonthPicker}
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.recentSectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Jobs In Progress</Text>
        </View>

        {recentJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active jobs assigned.</Text>
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

function WeeklyMetricsCard({ assigned, completed, onPressIcon }: { assigned: number, completed: number, onPressIcon?: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.blackCard, { backgroundColor: colors.secondary }]}>
      <View style={[styles.metricHeader, { alignItems: 'center' }]}>
        <Text style={[styles.metricTitle, { color: colors.textInverse }]}>Weekly Overview</Text>
        {onPressIcon && (
          <TouchableOpacity onPress={onPressIcon} style={[styles.metricIconCircle, { backgroundColor: colors.surface }]}>
            <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 40, marginTop: 20 }}>
        <View>
          <Text style={[styles.metricValue, { color: colors.textInverse }]}>{assigned}</Text>
          <Text style={[styles.growthLabel, { color: colors.textInverse, opacity: 0.7 }]}>Assigned</Text>
        </View>
        <View>
          <Text style={[styles.metricValue, { color: colors.textInverse }]}>{completed}</Text>
          <Text style={[styles.growthLabel, { color: colors.textInverse, opacity: 0.7 }]}>Completed</Text>
        </View>
      </View>

      <View style={styles.metricFooter}>
        <Text style={{ color: colors.textInverse, opacity: 0.7, fontSize: Typography.fontSize.xs }}>Performance this week</Text>
      </View>
    </View>
  );
}

function AdminDashboard({
  user,
  stats,
  recentJobs,
  recentJobVehicles,
  birthdaysToday,
  onOpenMonthPicker,
}: {
  user: any;
  stats: any;
  recentJobs: Job[];
  recentJobVehicles: Record<string, any>;
  birthdaysToday: User[];
  onOpenMonthPicker: () => void;
}) {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
              onPressIcon={onOpenMonthPicker}
            />
          </View>

          {/* Slide 2: Technician Revenue */}
          <View style={styles.slideContainer}>
            <TechnicianRevenueCard data={stats.technicianRevenue} />
          </View>

          {/* Slide 3: Outstanding Payments */}
          <View style={styles.slideContainer}>
            <MetricCard
              title="Outstanding Payments"
              value={`₦${stats.totalOwed.toLocaleString()}`}
              growth={0} // No growth tracking for now
              chartData={[50, 40, 60, 55, 70, 45, 60]} // Mock trend
              isCurrency={true}
              hideGrowth={true}
            />
          </View>

          {/* Slide 4: Pending Jobs */}
          <View style={styles.slideContainer}>
            <MetricCard
              title="Pending Jobs"
              value={stats.pendingJobsCount.toString()}
              growth={0}
              chartData={[30, 45, 35, 50, 40, 55, 45]}
              isCurrency={false}
              hideGrowth={true}
            />
          </View>

          {/* Slide 3: Jobs Completed */}
          <View style={styles.slideContainer}>
            <MetricCard
              title="Jobs Completed"
              value={stats.completedJobs.toString()}
              growth={jobsGrowth}
              chartData={[20, 30, 25, 40, 35, 50, 45]}
              isCurrency={false}
              onPressIcon={onOpenMonthPicker}
            />
          </View>

          {/* Birthdays Today */}
          {birthdaysToday.length > 0 && (
            <View style={styles.slideContainer}>
              <BirthdayCard users={birthdaysToday} />
            </View>
          )}
        </ScrollView>

        <View style={styles.pagination}>
          {[0, 1, 2, 3, 4, ...(birthdaysToday.length > 0 ? [5] : [])].map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === activeIndex ? styles.paginationDotActive : { backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>
      </View>

      {user?.workshopId === AppConfig.MASTER_WORKSHOP_ID && (
        <View style={{ paddingHorizontal: SIDE_PADDING, marginBottom: 20 }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.secondary,
              padding: 20,
              borderRadius: 20,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onPress={() => router.push('/(workshop)/marketplace-orders')}
          >
            <View>
              <Text style={{ color: colors.textInverse, fontSize: 18, fontWeight: 'bold' }}>
                Marketplace Orders
              </Text>
              <Text style={{ color: colors.textInverse, opacity: 0.7, fontSize: 14, marginTop: 4 }}>
                Manage & Process Payouts
              </Text>
            </View>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="cube-outline" size={24} color={colors.textPrimary} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.recentSectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Jobs and Requests</Text>
          <TouchableOpacity
            style={[styles.arrowButton, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/(workshop)/jobs')}
          >
            <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {recentJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No recent activity</Text>
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
  onPressIcon,
  hideGrowth,
}: {
  title: string;
  value: string;
  growth: number;
  chartData: number[];
  isCurrency?: boolean;
  onPressIcon?: () => void;
  hideGrowth?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isPositive = growth >= 0;

  return (
    <View style={[styles.blackCard, { backgroundColor: colors.secondary }]}>
      <View style={styles.metricHeader}>
        <Text style={[styles.metricTitle, { color: colors.textInverse, opacity: 0.7 }]}>{title}</Text>
        {onPressIcon ? (
          <TouchableOpacity onPress={onPressIcon} style={[styles.metricIconCircle, { backgroundColor: colors.surface }]}>
            <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.metricIconCircle, { backgroundColor: colors.surface }]}>
            <Ionicons name="stats-chart" size={14} color={colors.textPrimary} />
          </View>
        )}
      </View>

      <Text style={[styles.metricValue, { color: colors.textInverse }]}>{value}</Text>

      <View style={styles.metricFooter}>
        {!hideGrowth ? (
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
            <Text style={[styles.growthLabel, { color: colors.textInverse, opacity: 0.7 }]}>Than last month</Text>
          </View>
        ) : (
          <View style={styles.growthContainer}>
            <Text style={[styles.growthLabel, { color: colors.textInverse, opacity: 0.7 }]}>Current Status</Text>
          </View>
        )}

        <View style={styles.miniChart}>
          {chartData.map((height, index) => (
            <View
              key={index}
              style={[
                styles.chartBar,
                {
                  height: `${height}%`,
                  backgroundColor: colors.surface,
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Reset to 0 when data changes so we always show top tech initially
  useEffect(() => {
    setCurrentIndex(0);
  }, [data]);

  const currentTech = data && data.length > 0 ? data[currentIndex] : null;

  return (
    <>
      <View style={[styles.blackCard, { backgroundColor: colors.secondary }]}>
        <View style={styles.metricHeader}>
          <Text style={[styles.metricTitle, { color: colors.textInverse, opacity: 0.7 }]}>Technician Revenue</Text>
          <TouchableOpacity
            style={[styles.metricIconCircle, { backgroundColor: colors.surface }]}
            onPress={() => setPickerVisible(true)}
            disabled={!data || data.length === 0}
          >
            <Ionicons name="people" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {currentTech ? (
          <>
            <Text style={[styles.metricValue, { color: colors.textInverse }]}>₦{currentTech.amount.toLocaleString()}</Text>
            <View style={styles.metricFooter}>
              <View>
                <Text style={{ color: colors.textInverse, fontSize: Typography.fontSize.sm, fontWeight: 'bold' }}>
                  {currentTech.name}
                </Text>
                <Text style={{ color: colors.textInverse, opacity: 0.7, fontSize: Typography.fontSize.xs, marginTop: 4 }}>
                  Rank: #{currentIndex + 1}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={[styles.emptyTextWhite, { color: colors.textInverse, opacity: 0.7 }]}>No data available</Text>
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.monthPickerContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.monthPickerTitle, { marginBottom: 15, color: colors.textPrimary }]}>Select Technician</Text>
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {data.map((tech, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.techRow,
                    {
                      borderBottomColor: colors.border,
                      paddingVertical: 12,
                      backgroundColor: index === currentIndex ? colors.background : 'transparent',
                      borderRadius: 8,
                      paddingHorizontal: 8
                    }
                  ]}
                  onPress={() => {
                    setCurrentIndex(index);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={[styles.techName, { color: colors.textPrimary }]}>{tech.name}</Text>
                  <Text style={[styles.techAmount, { color: colors.primary }]}>₦{tech.amount.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.monthPickerCancelButton} onPress={() => setPickerVisible(false)}>
              <Text style={[styles.monthPickerCancelButtonText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function RecentJobItem({ job, vehicle }: { job: Job, vehicle?: any }) {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
    return StatusColors[status] || colors.textSecondary;
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
      style={[styles.recentItem, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/(workshop)/job-details?id=${job.id}`)}
    >
      {/* Icon/Logo Column */}
      <View style={[styles.iconBox, { backgroundColor: (vehicle || job.vehicleId) ? 'transparent' : getStatusColor(job.status), marginRight: 15 }]}>
        {vehicle ? (
          <BrandLogo brand={vehicle.make} size={30} />
        ) : job.vehicleId ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <Ionicons name={getStatusIcon(job.status)} size={24} color="#fff" />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={[styles.recentTitle, { color: colors.textPrimary }]} numberOfLines={1}>{getIssueLabel()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '15', marginLeft: 8 }]}>
            <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
          </View>
        </View>

        <Text style={[styles.tagText, { color: colors.textSecondary }]}>
          {vehicle ? `${vehicle.make} ${vehicle.model}` : (job.type === 'service' ? 'Service' : 'Complaint')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}



function BirthdayCard({ users }: { users: User[] }) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.blackCard, { backgroundColor: colors.secondary }]}>
      <View style={styles.metricHeader}>
        <Text style={[styles.metricTitle, { color: colors.textInverse, opacity: 0.7 }]}>Birthdays Today 🎂</Text>
        <View style={[styles.metricIconCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name="gift" size={16} color={colors.textPrimary} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, marginTop: 10 }}>
        {users.map((u) => (
          <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success }} />
            <Text style={{ color: colors.textInverse, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{u.name}</Text>
            <Text style={{ color: colors.textInverse, opacity: 0.7, fontSize: 12 }}>({u.role === 'customer' ? 'Member' : 'Staff'})</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.metricFooter}>
        <Text style={{ color: colors.textInverse, opacity: 0.7, fontSize: 12 }}>Don't forget to send a wish!</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    backgroundColor: colors.surface,
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
    alignItems: 'center',
    gap: Spacing.base,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 5,
  },
  dateNavButton: {
    padding: 4,
  },
  dateText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginHorizontal: 8,
    minWidth: 100,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  carouselContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    marginBottom: 10,
  },
  slideContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  blackCard: {
    backgroundColor: colors.secondary,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing.xl,
    height: 200,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricTitle: {
    fontSize: Typography.fontSize.base,
    color: colors.textTertiary,
    fontWeight: Typography.fontWeight.medium,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: colors.textInverse,
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tagContainer: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#EEEEEE',
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
  tagText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  monthPickerCancelButton: {
    paddingVertical: 12,
    marginTop: 10,
  },
  monthPickerCancelButtonText: {
    color: '#666',
    fontSize: 16,
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
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  techName: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  techAmount: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
});

