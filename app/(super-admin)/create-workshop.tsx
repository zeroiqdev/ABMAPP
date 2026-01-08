import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Colors } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';

export default function CreateWorkshopScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [name, setName] = useState('');
    const [subPlan, setSubPlan] = useState('basic');
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return Alert.alert('Error', 'Workshop name is required');

        // Optional: Require Admin details? Let's make it optional for flexibility
        if (adminEmail && !adminEmail.includes('@')) return Alert.alert('Error', 'Invalid admin email');

        setLoading(true);
        try {
            // Check for existing users or invites if email provided
            if (adminEmail) {
                const normalizedEmail = adminEmail.toLowerCase().trim();

                // Check Users
                const usersQ = query(collection(db, 'users'), where('email', '==', normalizedEmail));
                const usersSnap = await getDocs(usersQ);
                if (!usersSnap.empty) {
                    Alert.alert('Error', 'A user with this email already exists. Currently we do not support multi-workshop users via this flow.');
                    setLoading(false);
                    return;
                }

                // Check Invites
                const invitesQ = query(collection(db, 'staffInvitations'), where('email', '==', normalizedEmail));
                const invitesSnap = await getDocs(invitesQ);
                const pendingInvite = invitesSnap.docs.find(d => !d.data().used);
                if (pendingInvite) {
                    Alert.alert('Error', 'This email already has a pending invitation.');
                    setLoading(false);
                    return;
                }
            }

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 Days default

            const workshopRef = await addDoc(collection(db, 'workshops'), {
                name: name.trim(),
                subscriptionStatus: 'active',
                subscriptionPlan: subPlan,
                subscriptionExpiry: expiryDate,
                settings: {
                    currency: 'NGN',
                    vatRate: 7.5
                },
                createdAt: serverTimestamp(),
            });

            let successMessage = 'Workshop created successfully.';

            // Invite Admin if details provided
            if (adminName && adminEmail && user?.id) {
                try {
                    const { invitationCode } = await firebaseService.createStaffInvitation(
                        adminEmail.trim(),
                        adminName.trim(),
                        'admin',
                        user.id,
                        workshopRef.id
                    );
                    successMessage += `\n\nFIRST ADMIN INVITE CODE:\n${invitationCode}\n\nPlease copy and share this with the user.`;
                } catch (inviteError: any) {
                    console.error('Invite Error:', inviteError);
                    successMessage += `\n\n(Warning: Failed to generate admin invite: ${inviteError.message})`;
                }
            }

            Alert.alert('Workshop Created', successMessage, [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to create workshop');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Workshop</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Workshop Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Allen's Auto Fix"
                    />
                </View>

                {/* New Admin Section */}
                <View style={styles.sectionDivider}>
                    <Text style={styles.sectionTitle}>First Administrator (Optional)</Text>
                    <Text style={styles.sectionSubtitle}>Generate an invite code immediately for the owner.</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Admin Name</Text>
                    <TextInput
                        style={styles.input}
                        value={adminName}
                        onChangeText={setAdminName}
                        placeholder="e.g. John Doe"
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Admin Email</Text>
                    <TextInput
                        style={styles.input}
                        value={adminEmail}
                        onChangeText={setAdminEmail}
                        placeholder="e.g. admin@workshop.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Subscription Plan</Text>
                    <View style={styles.planContainer}>
                        {['basic', 'premium', 'enterprise'].map((plan) => (
                            <TouchableOpacity
                                key={plan}
                                style={[styles.planOption, subPlan === plan && styles.planOptionSelected]}
                                onPress={() => setSubPlan(plan)}
                            >
                                <Text style={[styles.planText, subPlan === plan && styles.planTextSelected]}>
                                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.createButton, loading && { opacity: 0.7 }]}
                    onPress={handleCreate}
                    disabled={loading}
                >
                    <Text style={styles.createButtonText}>{loading ? 'Processing...' : 'Create Workshop & Invite'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
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
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        padding: 4,
    },
    content: {
        padding: 20,
    },
    sectionDivider: {
        marginTop: 10,
        marginBottom: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#000',
    },
    planContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    planOption: {
        flex: 1,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        alignItems: 'center',
    },
    planOptionSelected: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    planText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
    planTextSelected: {
        color: '#fff',
    },
    createButton: {
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
