import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { Colors } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { firebaseService } from '@/services/firebaseService';

export default function WorkshopDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [workshop, setWorkshop] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [adminEmail, setAdminEmail] = useState<string>('');

    // Form State
    const [status, setStatus] = useState('');
    const [expiry, setExpiry] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchWorkshop = async () => {
            try {
                const docRef = doc(db, 'workshops', id as string);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setWorkshop(data);
                    setStatus(data.subscriptionStatus);
                    if (data.subscriptionExpiry) {
                        setExpiry(data.subscriptionExpiry.toDate());
                    }
                }

                // Fetch admin email
                try {
                    const admins = await firebaseService.getUsersByRole('admin', id as string);
                    if (admins && admins.length > 0) {
                        setAdminEmail(admins[0].email);
                    }
                } catch (error) {
                    console.error('Error fetching admin email:', error);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkshop();
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'workshops', id as string), {
                subscriptionStatus: status,
                subscriptionExpiry: Timestamp.fromDate(expiry)
            });
            Alert.alert('Success', 'Workshop updated successfully');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to update workshop');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{workshop?.name}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.infoCard}>
                    <Text style={styles.label}>Workshop ID</Text>
                    <Text style={styles.value}>{id}</Text>

                    <Text style={[styles.label, { marginTop: 15 }]}>Current Plan</Text>
                    <Text style={styles.value}>{workshop?.subscriptionPlan?.toUpperCase()}</Text>

                    {adminEmail && (
                        <>
                            <Text style={[styles.label, { marginTop: 15 }]}>Admin Email</Text>
                            <Text style={[styles.value, { fontSize: 14 }]} selectable>{adminEmail}</Text>
                        </>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Subscription Settings</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Status</Text>
                        <View style={styles.statusRow}>
                            {['active', 'inactive', 'trial'].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.statusOption, status === s && styles.statusOptionSelected]}
                                    onPress={() => setStatus(s)}
                                >
                                    <Text style={[styles.statusText, status === s && styles.statusTextSelected]}>
                                        {s.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Expiry Date</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color="#333" />
                            <Text style={styles.dateText}>{expiry.toDateString()}</Text>
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={expiry}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) setExpiry(selectedDate);
                            }}
                        />
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Update Subscription'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    infoCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    section: {
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 12,
        color: '#666',
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    statusRow: {
        flexDirection: 'row',
        gap: 10,
    },
    statusOption: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#fff',
    },
    statusOptionSelected: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    statusTextSelected: {
        color: '#fff',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        gap: 10,
    },
    dateText: {
        fontSize: 16,
        color: '#333',
    },
    saveButton: {
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
