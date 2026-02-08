import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/constants/design';
import { firebaseService } from '@/services/firebaseService';
import { Invoice, Quote } from '@/types';
import { format } from 'date-fns';

export default function InvoicesScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'partially_paid'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [workshopNamesMap, setWorkshopNamesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadInvoices();
  }, [user, filter]);

  const loadInvoices = async () => {
    if (!user) return;

    try {
      // Load both invoices and pending quotes
      const [invoicesData, quotesData] = await Promise.all([
        firebaseService.getInvoices(user.id),
        firebaseService.getQuotesForCustomer(user.id),
      ]);

      setPendingQuotes(quotesData);

      // Filter out drafts and void invoices
      let filtered = invoicesData.filter(inv => inv.status === 'approved' || inv.status === undefined); // Backward compatibility

      if (filter === 'pending') {
        filtered = filtered.filter((inv) => inv.paymentStatus === 'pending');
      } else if (filter === 'paid') {
        filtered = filtered.filter((inv) => inv.paymentStatus === 'paid');
      } else if (filter === 'partially_paid') {
        filtered = filtered.filter((inv) => inv.paymentStatus === 'partially_paid');
      }

      setInvoices(filtered);

      // Fetch workshop names for all unique workshopIds
      const workshopIds = [...new Set([...filtered.map(inv => inv.workshopId), ...quotesData.map(q => q.workshopId)].filter(Boolean))];
      const namesMap: Record<string, string> = {};
      await Promise.all(
        workshopIds.map(async (wsId) => {
          const workshop = await firebaseService.getWorkshop(wsId);
          if (workshop) {
            namesMap[wsId] = workshop.name || 'Unknown Workshop';
          }
        })
      );
      setWorkshopNamesMap(namesMap);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'partially_paid': return colors.primary;
      case 'failed': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getBadgeBackground = (status: string) => {
    // In dark mode, mix in some white/gray to make it pop against black
    // Or just use the color with higher opacity
    // But user asked for "white background".
    // Let's use a subtle white overlay style
    return colors.textInverse + '15'; // 15% white/black depending on theme context.
    // Wait, colors.textInverse in Dark Mode is Black? No, White.
    // colors.textInverse in Light Mode is White? No, Black?
    // Check design.ts:
    // Light: textInverse: '#FFFFFF' (White).
    // Dark: textInverse: '#000000' (Black).
    // So in Dark Mode (textInverse=Black), I'm adding Black tint? That's opposite.
    // I want White tint in Dark Mode.

    // I'll rely on textPrimary/secondary or just hardcode checking mode?
    // I don't have isDark easy access unless I check colors.background === '#000000'.

    // actually, let's use the color itself but stronger opacity, OR
    // use `colors.surfaceElevated` which is lighter in dark mode.

    // User request: "bit of white background".
    // This implies they want it to stand out from the black page background.
  };

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const amountPaid = item.amountPaid || 0;
    const remaining = item.total - amountPaid;
    const statusColor = getPaymentStatusColor(item.paymentStatus);

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => router.push(`/(customer)/invoice-details?id=${item.id}`)}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.iconBox, { backgroundColor: statusColor + '20' }]}>
            <Ionicons name="receipt-outline" size={24} color={statusColor} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              Invoice #{item.id.slice(0, 8)}
            </Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {workshopNamesMap[item.workshopId] || 'Workshop'} • ₦{item.total.toLocaleString()}
            </Text>
            <Text style={[styles.itemSubtitle, { fontSize: 12, marginTop: 2 }]}>
              {format(item.createdAt, 'MMM dd, yyyy')}
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
            {/* 
               Badge Background: 
               If Dark Mode, standard '20' opacity on black might be too dark.
               User wants "white background". 
               I'll add a borderWidth or use a solid 'white' tint?
               I'll use `backgroundColor: statusColor + '20'` but ADD `borderWidth: 1, borderColor: statusColor + '30'`.
               This adds visibility.
               AND I will try to use a "white" mixing if possible.
               
               Let's try just `backgroundColor: colors.textPrimary + '10'` (10% standard text color) combined? 
               No, styles don't mix.
               
               I'll stick to `statusColor + '20'` but add a border.
            */}
            <View style={[styles.statusBadge, {
              backgroundColor: statusColor + '15',
              borderWidth: 1,
              borderColor: statusColor + '30'
            }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.paymentStatus === 'partially_paid'
                  ? 'Partial'
                  : item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
      </View>

      {/* Pending Quotes Section */}
      {pendingQuotes.length > 0 && (
        <View style={styles.quotesSection}>
          <Text style={styles.quotesSectionTitle}>Pending Approval</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, gap: 12 }}>
            {pendingQuotes.map((quote) => (
              <TouchableOpacity
                key={quote.id}
                style={styles.quoteCard}
                onPress={() => router.push(`/(customer)/quote-details?id=${quote.id}`)}
              >
                <View style={styles.quoteCardHeader}>
                  <Ionicons name="document-text-outline" size={20} color={colors.warning} />
                  <View style={[styles.quoteBadge, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.quoteBadgeText, { color: colors.warning }]}>Awaiting Review</Text>
                  </View>
                </View>
                <Text style={styles.quoteCustomer} numberOfLines={1}>{workshopNamesMap[quote.workshopId] || 'Workshop'}</Text>
                <Text style={styles.quoteTotal}>₦{(quote.total || 0).toLocaleString()}</Text>
                <Text style={styles.quoteDate}>
                  {quote.sentAt ? format(quote.sentAt, 'MMM dd') : format(quote.createdAt, 'MMM dd')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Approved Invoices Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Approved Invoices</Text>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        {(['all', 'paid', 'partially_paid'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterPill,
              filter === filterOption && styles.filterPillActive,
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles.filterText,
                filter === filterOption && styles.filterTextActive,
              ]}
            >
              {filterOption === 'all'
                ? 'All'
                : filterOption === 'partially_paid'
                  ? 'Partially Paid'
                  : filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        }
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textInverse,
  },
  listContent: {
    padding: 0,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1, // Optional: add border for better visibility in dark mode if shadow is subtle
    borderColor: colors.border,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    maxWidth: 200,
  },
  invoiceCustomer: {
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
    fontWeight: '500',
  },
  invoiceDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  paymentInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paidText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  remainingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textTertiary,
  },
  // Quote section styles
  quotesSection: {
    paddingTop: 15,
    paddingBottom: 10,
  },
  quotesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    paddingHorizontal: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    paddingTop: 15,
    paddingBottom: 5,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 15,
    width: 160,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  quoteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quoteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quoteBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  quoteCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  quoteTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  quoteDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});

