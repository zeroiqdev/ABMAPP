import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { Job, Vehicle } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { BrandLogo } from '@/components/BrandLogo';
import { Colors, Spacing, Typography, BorderRadius, useColors } from '@/constants/design';

export default function MaintenanceScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const colors = useColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load jobs when user is available or on refresh
    const loadJobs = async () => {
        if (!user) return;
        try {
            // Fetch jobs for this user
            const userJobs = await firebaseService.getJobs(user.id);
            setJobs(userJobs);
        } catch (error) {
            console.error('Error loading jobs:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, [user?.id]);

    useEffect(() => {
        filterJobs();
    }, [jobs, filter, searchQuery]);

    const filterJobs = () => {
        let result = jobs;

        // Status Filter
        if (filter === 'active') {
            result = result.filter(j => ['received', 'diagnosed', 'repairing'].includes(j.status));
        } else if (filter === 'completed') {
            result = result.filter(j => j.status === 'completed');
        }

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(j =>
                j.description.toLowerCase().includes(query) ||
                j.id.toLowerCase().includes(query)
            );
        }

        setFilteredJobs(result);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadJobs();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Maintenance</Text>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search jobs..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.textTertiary}
                    />
                </View>

                <View style={styles.filterContainer}>
                    <FilterPill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
                    <FilterPill label="Active" active={filter === 'active'} onPress={() => setFilter('active')} />
                    <FilterPill label="Completed" active={filter === 'completed'} onPress={() => setFilter('completed')} />
                </View>
            </View>

            <FlatList
                data={filteredJobs}
                renderItem={({ item }) => <JobCard job={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        {loading ? (
                            <Text style={styles.emptyText}>Loading...</Text>
                        ) : (
                            <>
                                <Ionicons name="construct-outline" size={64} color={colors.textTertiary} />
                                <Text style={styles.emptyText}>No maintenance jobs found</Text>
                            </>
                        )}
                    </View>
                }
            />
        </View>
    );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const colors = useColors();
    return (
        <TouchableOpacity
            style={[
                {
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                },
                active && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
            ]}
            onPress={onPress}
        >
            <Text style={[
                { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
                active && { color: colors.textInverse }
            ]}>{label}</Text>
        </TouchableOpacity>
    );
}

function JobCard({ job }: { job: Job }) {
    const router = useRouter();
    const colors = useColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);

    useEffect(() => {
        loadVehicle();
    }, [job.vehicleId]);

    const loadVehicle = async () => {
        try {
            if (job.userId) {
                const vehicles = await firebaseService.getVehicles(job.userId);
                const v = vehicles.find(v => v.id === job.vehicleId);
                setVehicle(v || null);
            }
        } catch (error) {
            console.error(error);
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

    const handlePress = () => {
        router.push(`/(customer)/job-details?id=${job.id}`);
    };

    return (
        <TouchableOpacity
            style={styles.itemCard}
            onPress={handlePress}
        >
            <View style={styles.itemLeft}>
                <View style={[styles.iconBox, { backgroundColor: vehicle ? 'transparent' : getStatusColor(job.status) }]}>
                    {vehicle ? (
                        <BrandLogo brand={vehicle.make} size={30} />
                    ) : (
                        <Ionicons name="car-sport-outline" size={24} color={colors.textInverse} />
                    )}
                </View>

                <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                        {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                        {vehicle?.licensePlate || 'No Reg'} • {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                    </Text>
                </View>
            </View>

            <View style={styles.itemRight}>
                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '15' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.surface,
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.textPrimary,
    },
    filterContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    filterPill: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterPillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterPillText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    filterPillTextActive: {
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
        fontSize: 13,
        color: colors.textSecondary,
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 16,
        marginTop: 10,
    },
});
