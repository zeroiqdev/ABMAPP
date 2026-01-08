import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { Job, Vehicle } from '@/types';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { BrandLogo } from '@/components/BrandLogo';

export default function VehicleHistoryScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, [id, user]);

    const loadData = async () => {
        if (!id || !user) return;
        try {
            // Load vehicle
            const vehicles = await firebaseService.getVehicles(user.id);
            const vehicleData = vehicles.find(v => v.id === id);
            if (vehicleData) setVehicle(vehicleData);

            // Load jobs for this vehicle
            const allJobs = await firebaseService.getJobs(user.id);
            const vehicleJobs = allJobs.filter(job => job.vehicleId === id);
            setJobs(vehicleJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
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
            case 'cancelled': return '#FF3B30';
            default: return '#666';
        }
    };

    const renderJob = ({ item }: { item: Job }) => (
        <TouchableOpacity
            style={styles.itemCard}
            onPress={() => router.push(`/(customer)/job-details?id=${item.id}`)}
        >
            <View style={[styles.iconBox, { backgroundColor: '#000' }]}>
                <Ionicons name="construct-outline" size={24} color="#fff" />
            </View>

            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                    {item.description}
                </Text>
                <Text style={styles.itemSubtitle}>
                    {format(item.createdAt, 'MMM dd, yyyy')}
                </Text>
            </View>

            <View style={styles.itemRight}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(customer)/vehicles')}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Service History</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Vehicle Info */}
            {vehicle && (
                <View style={styles.vehicleInfoCard}>
                    <View style={styles.vehicleIcon}>
                        <BrandLogo brand={vehicle.make} size={32} />
                    </View>
                    <View style={styles.vehicleInfo}>
                        <Text style={styles.vehicleName}>
                            {vehicle.make} {vehicle.model}
                        </Text>
                        <Text style={styles.vehicleDetails}>
                            {vehicle.year} • {vehicle.licensePlate}
                        </Text>
                    </View>
                </View>
            )}

            <FlatList
                data={jobs}
                renderItem={renderJob}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponent={
                    <View style={styles.listHeader}>
                        <Text style={styles.listHeaderText}>
                            {jobs.length} Service Record{jobs.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="briefcase-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No service records yet</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 20,
        fontWeight: 'bold',
    },
    vehicleInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 20,
        marginBottom: 10,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    vehicleIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    vehicleInfo: {
        flex: 1,
    },
    vehicleName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 4,
    },
    vehicleDetails: {
        fontSize: 14,
        color: '#666',
    },
    listHeader: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    listHeaderText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    listContent: {
        padding: 20,
        paddingTop: 0,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
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
        justifyContent: 'center',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
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
