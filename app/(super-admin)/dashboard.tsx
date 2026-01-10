import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/config/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Colors } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { firebaseService } from '@/services/firebaseService';

export default function SuperAdminDashboard() {
    const router = useRouter();
    const { logout } = useAuthStore();
    const [workshops, setWorkshops] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminEmails, setAdminEmails] = useState<Record<string, string>>({});

    useEffect(() => {
        const q = query(collection(db, 'workshops'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setWorkshops(data);
            setLoading(false);

            // Fetch admin emails for each workshop
            const emailsMap: Record<string, string> = {};
            for (const workshop of data) {
                try {
                    const admins = await firebaseService.getUsersByRole('admin', workshop.id);
                    if (admins && admins.length > 0) {
                        emailsMap[workshop.id] = admins[0].email;
                    }
                } catch (error) {
                    console.error(`Error fetching admin for workshop ${workshop.id}:`, error);
                }
            }
            setAdminEmails(emailsMap);
        });
        return () => unsubscribe();
    }, []);

    const handleDeleteWorkshop = async (workshop: any) => {
        Alert.alert(
            'Delete Workshop',
            `Are you sure you want to delete "${workshop.name}"? This action cannot be undone and will remove all associated data types (users, jobs, etc. must be handled manually or via cloud functions).`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'workshops', workshop.id));
                            Alert.alert('Success', 'Workshop deleted successfully');
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete workshop');
                        }
                    }
                }
            ]
        );
    };

    const renderRightActions = (progress: any, dragX: any, workshop: any) => {
        return (
            <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => handleDeleteWorkshop(workshop)}
            >
                <Ionicons name="trash-outline" size={24} color="#fff" />
                <Text style={styles.deleteActionText}>Delete</Text>
            </TouchableOpacity>
        );
    };

    const renderWorkshop = ({ item }: { item: any }) => {
        const isExpired = item.subscriptionExpiry?.toDate() < new Date();
        const statusColor = item.subscriptionStatus === 'active' ? Colors.success : Colors.error;

        return (
            <Swipeable
                renderRightActions={(p, d) => renderRightActions(p, d, item)}
                containerStyle={{ overflow: 'hidden' }} // helpful for rounded corners if needed
            >
                <TouchableOpacity
                    style={styles.card}
                    onPress={() => router.push({ pathname: '/(super-admin)/workshop-details', params: { id: item.id } })}
                >
                    <View style={styles.cardHeader}>
                        <Text style={styles.workshopName}>{item.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {item.subscriptionStatus.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.cardRow, { marginBottom: 8 }]}>
                        <Text style={[styles.cardLabel, { fontSize: 12 }]}>ID:</Text>
                        <Text style={[styles.cardValue, { fontSize: 12, color: '#888' }]} selectable>{item.id}</Text>
                    </View>

                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Plan:</Text>
                        <Text style={styles.cardValue}>{item.subscriptionPlan}</Text>
                    </View>
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Expiry:</Text>
                        <Text style={[styles.cardValue, isExpired && { color: Colors.error }]}>
                            {item.subscriptionExpiry?.toDate().toLocaleDateString()}
                        </Text>
                    </View>
                    {adminEmails[item.id] && (
                        <View style={styles.cardRow}>
                            <Text style={styles.cardLabel}>Admin:</Text>
                            <Text style={[styles.cardValue, { fontSize: 13 }]} selectable>
                                {adminEmails[item.id]}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -10, padding: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Workshops</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.actionContainer}>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/(super-admin)/create-workshop')}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add Workshop</Text>
                </TouchableOpacity>

                <View style={[styles.dangerZone, { marginTop: 20 }]}>
                    <Text style={styles.dangerTitle}>Danger Zone</Text>
                    <TouchableOpacity
                        style={styles.resetButton}
                        onPress={() => {
                            Alert.alert(
                                'Reset Database',
                                'DANGER: This will delete ALL workshops, jobs, invoices, vehicles, and users (except YOU). Using this requires Cloud Functions to be deployed.\n\nAre you absolutely sure?',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Yes, Wipe Everything',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const { getFunctions, httpsCallable } = require('firebase/functions');
                                                const functions = getFunctions();
                                                const resetDatabase = httpsCallable(functions, 'resetDatabase');

                                                Alert.alert('Processing', 'Resetting database... This may take a few moments.');

                                                const result: any = await resetDatabase();

                                                if (result.data.success) {
                                                    Alert.alert('Success', result.data.message);
                                                    setWorkshops([]); // Clear local state immediately
                                                } else {
                                                    Alert.alert('Error', 'Reset returned invalid response.');
                                                }
                                            } catch (error: any) {
                                                console.error('Reset Error:', error);
                                                Alert.alert('Reset Failed', error.message || 'Unknown error occurred.');
                                            }
                                        }
                                    }
                                ]
                            );
                        }}
                    >
                        <Ionicons name="nuclear" size={20} color="#fff" />
                        <Text style={styles.resetButtonText}>Reset Database</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={workshops}
                renderItem={renderWorkshop}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No workshops found.'}</Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    actionContainer: {
        padding: 20,
        paddingBottom: 0,
    },
    addButton: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    list: {
        padding: 20,
        gap: 15,
    },
    card: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    workshopName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    cardLabel: {
        fontSize: 14,
        color: '#666',
    },
    cardValue: {
        fontSize: 14,
        color: '#000',
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: '#666',
    },
    deleteAction: {
        backgroundColor: '#dd2c00',
        justifyContent: 'center',
        alignItems: 'center',
        width: 100,
        borderRadius: 12,
        marginVertical: 1, // Visual adjustment to align with card border?
        height: '100%',
    },
    deleteActionText: {
        color: 'white',
        fontWeight: '600',
        marginTop: 4,
    },
});
