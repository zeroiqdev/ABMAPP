import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Notification } from '@/types';
import { format } from 'date-fns';
import { useColors } from '@/constants/design';

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const notificationsData = await firebaseService.getNotifications(user.id);
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await firebaseService.markNotificationAsRead(notification.id);
      await loadNotifications();
    }

    switch (notification.type) {
      case 'job_update':
        if (notification.metadata?.vehicleId && user) {
          router.push(`/(customer)/vehicle-history?vehicleId=${notification.metadata.vehicleId}&customerId=${user.id}`);
        } else {
          router.push('/(customer)/vehicles');
        }
        break;
      case 'payment':
        // If we have invoiceId, we could route deeper, but for now specific invoice deep link might not be set up
        router.push('/(customer)/invoices');
        break;
      default:
        // Use metadata to guess where to go if type matches nothing
        if (notification.metadata?.vehicleId) {
          router.push(`/(customer)/vehicle-history?vehicleId=${notification.metadata.vehicleId}&customerId=${user?.id}`);
        }
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_update':
        return 'build-outline';
      case 'payment':
        return 'card-outline';
      case 'inventory':
        return 'cube-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'job_update':
        return '#007AFF';
      case 'payment':
        return '#30D158';
      case 'inventory':
        return '#FFA500';
      default:
        return '#666';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={colors.textInverse}
        />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.notificationTime}>
          {format(item.createdAt, 'MMM dd, yyyy HH:mm')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadNotifications.map((n) =>
          firebaseService.markNotificationAsRead(n.id)
        )
      );
      await loadNotifications();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No notifications</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  markAllText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadCard: {
    backgroundColor: colors.surface, // Or a slightly highlighted color if needed, but surface is fine for read/unread distinction often handled by dot
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textTertiary,
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
});

