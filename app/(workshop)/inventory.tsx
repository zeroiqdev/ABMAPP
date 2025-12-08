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

  const renderItem = ({ item }: { item: InventoryItem }) => {
    // Generate a consistent color based on item name char code sum
    const colors = ['#FFCC00', '#5B68F6', '#34C759', '#FF3B30', '#AF52DE'];
    const colorIndex = item.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const iconColor = colors[colorIndex];

    return (
      <View style={styles.itemCard}>
        <View style={[styles.iconBox, { backgroundColor: iconColor }]}>
          <Ionicons name="cube-outline" size={24} color="#fff" />
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>
            {item.sku ? `${item.sku} • ` : ''}{item.quantity} in Stock
          </Text>
        </View>

        <View style={styles.itemRight}>
          <Text style={styles.itemPrice}>₦{(item.sellingPrice || item.unitPrice || 0).toLocaleString()}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/(workshop)/create-inventory-item?id=${item.id}`)}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity onPress={() => router.push('/(workshop)/create-inventory-item')}>
          <View style={styles.addButton}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No inventory items found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // Changed to white as per Monday style usually
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    // Removed shadow/card style for a cleaner list look as per Monday template list
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingBottom: 15,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
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
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
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
