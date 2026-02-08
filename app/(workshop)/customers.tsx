import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { User } from '@/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useCallback } from 'react';
import { Colors, Typography, Spacing, BorderRadius, useColors } from '@/constants/design';

export default function CustomersScreen() {
  const colors = useColors();
  const { user } = useAuthStore();
  const router = useRouter();
  const [customers, setCustomers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (!user?.workshopId) return;
    try {
      // Query by direct workshopId field (staff-created customers)
      const directQuery = query(
        collection(db, 'users'),
        where('role', '==', 'customer'),
        where('workshopId', '==', user.workshopId)
      );

      // Query by selectedWorkshopIds array (member mode customers)
      const arrayQuery = query(
        collection(db, 'users'),
        where('role', '==', 'customer'),
        where('selectedWorkshopIds', 'array-contains', user.workshopId)
      );

      // Execute both queries
      const [directSnapshot, arraySnapshot] = await Promise.all([
        getDocs(directQuery),
        getDocs(arrayQuery)
      ]);

      // Combine results using Map to avoid duplicates
      const customerMap = new Map<string, User>();

      const processDoc = (doc: any) => {
        if (!customerMap.has(doc.id)) {
          const data = doc.data();
          customerMap.set(doc.id, {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as User);
        }
      };

      directSnapshot.docs.forEach(processDoc);
      arraySnapshot.docs.forEach(processDoc);

      const customersList = Array.from(customerMap.values());
      setCustomers(customersList);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }, [user?.workshopId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  };

  const getInitial = (name?: string) => (name && name.length > 0 ? name[0].toUpperCase() : '?');

  const renderCustomer = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.customerRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={() => router.push({
        pathname: '/(workshop)/customer-details',
        params: {
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date().toISOString(),
          workshopId: item.workshopId,
          role: item.role,
        }
      })}
    >
      <View style={styles.customerInfo}>
        <View style={[styles.avatar, { backgroundColor: colors.textPrimary }]}>
          <Text style={[styles.avatarText, { color: colors.textInverse }]}>{getInitial(item.name)}</Text>
        </View>
        <View style={styles.customerDetails}>
          <Text style={[styles.customerName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.customerEmail, { color: colors.textSecondary }]}>{item.email}</Text>
          <Text style={[styles.customerPhone, { color: colors.textTertiary }]}>{item.phone}</Text>
        </View>

      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Customers</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.textPrimary }]}
          onPress={() => router.push('/(workshop)/register-customer')}
        >
          <Ionicons name="add" size={20} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={customers}
        renderItem={renderCustomer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No customers found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing['5xl'],
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    flex: 1,
    textAlign: 'left',
    color: Colors.textPrimary,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.base,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  avatarText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textInverse,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: Spacing.base,
    fontSize: Typography.fontSize.base,
    color: Colors.textTertiary,
  },
});


