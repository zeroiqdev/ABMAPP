import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { InventoryItem } from '@/types';
import { Colors, useColors } from '@/constants/design';

export default function InventoryScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadInventory = () => {
    if (!user?.workshopId) return;

    console.log('Subscribing to inventory for workshop:', user.workshopId);
    const unsubscribe = firebaseService.subscribeToInventory(user.workshopId, (inventoryItems) => {
      console.log('Received', inventoryItems.length, 'inventory items');
      setItems(inventoryItems);
      setRefreshing(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (user?.workshopId) {
      unsubscribe = loadInventory();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.workshopId]);

  const onRefresh = async () => {
    setRefreshing(true);
    // With real-time listener, we don't really need to "fetch", 
    // but we can simulate a refresh or just rely on the listener.
    // For now, let's just wait a bit and turn off refreshing since the listener is active.
    setTimeout(() => setRefreshing(false), 1000);
  };

  const colors = useColors();

  const renderItem = ({ item }: { item: InventoryItem }) => {
    return (
      <View style={[styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.textPrimary }]}>
          <Ionicons name="cube-outline" size={24} color={colors.textInverse} />
        </View>

        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
            {item.sku ? `${item.sku} • ` : ''}{item.quantity} in Stock
          </Text>
        </View>

        <View style={styles.itemRight}>
          <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>₦{(item.sellingPrice || item.unitPrice || 0).toLocaleString()}</Text>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.textPrimary }]}
            onPress={() => router.push(`/(workshop)/create-inventory-item?id=${item.id}`)}
          >
            <Text style={[styles.editText, { color: colors.textInverse }]}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Inventory</Text>
        <TouchableOpacity onPress={() => router.push('/(workshop)/create-inventory-item')}>
          <View style={[styles.addButton, { backgroundColor: colors.textPrimary }]}>
            <Ionicons name="add" size={20} color={colors.textInverse} />
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No inventory items found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'left',
    color: '#000',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 0,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000',
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
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});
