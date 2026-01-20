import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function SettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const loadPrefs = async () => {
            try {
                const userData = await firebaseService.getUser(user.id);
                if (userData) {
                    setPushEnabled(userData.pushNotificationsEnabled !== false);
                    setEmailEnabled(userData.emailNotificationsEnabled !== false);
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
            } finally {
                setLoading(false);
            }
        };
        loadPrefs();
    }, [user]);

    const updatePreference = async (key: string, value: boolean) => {
        if (!user?.id) return;
        try {
            await updateDoc(doc(db, 'users', user.id), { [key]: value });
        } catch (error) {
            console.error('Error updating preference:', error);
            Alert.alert('Error', 'Failed to update preference');
        }
    };

    const handlePushToggle = (value: boolean) => {
        setPushEnabled(value);
        updatePreference('pushNotificationsEnabled', value);
    };

    const handleEmailToggle = (value: boolean) => {
        setEmailEnabled(value);
        updatePreference('emailNotificationsEnabled', value);
    };

    const handleResetPassword = async () => {
        if (!user?.email) return;
        try {
            await firebaseService.sendPasswordResetEmail(user.email);
            Alert.alert('Success', `Password reset email sent to ${user.email}`);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send reset email');
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/(auth)/login');
        } catch (error) {
            Alert.alert('Error', 'Failed to logout');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.row}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="person-circle-outline" size={24} color="#000" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>{user?.name || 'Vendor'}</Text>
                            <Text style={styles.rowSubtitle}>{user?.email}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.menuItem} onPress={handleResetPassword}>
                        <Ionicons name="lock-closed-outline" size={22} color="#000" />
                        <Text style={styles.menuText}>Reset Password</Text>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <Ionicons name="notifications-outline" size={22} color="#000" />
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleLabel}>Push Notifications</Text>
                                <Text style={styles.toggleDesc}>Receive order and system updates</Text>
                            </View>
                        </View>
                        <Switch
                            value={pushEnabled}
                            onValueChange={handlePushToggle}
                            trackColor={{ false: '#ddd', true: '#000' }}
                            thumbColor="#fff"
                            disabled={loading}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <Ionicons name="mail-outline" size={22} color="#000" />
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleLabel}>Email Notifications</Text>
                                <Text style={styles.toggleDesc}>Receive updates via email</Text>
                            </View>
                        </View>
                        <Switch
                            value={emailEnabled}
                            onValueChange={handleEmailToggle}
                            trackColor={{ false: '#ddd', true: '#000' }}
                            thumbColor="#fff"
                            disabled={loading}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                            Alert.alert(
                                'Delete Account',
                                'Are you sure you want to delete your account? This action involves deleting all your data permanently and cannot be undone.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const { deleteAccount } = useAuthStore.getState();
                                                await deleteAccount();
                                            } catch (error: any) {
                                                console.error('Delete account error:', error);
                                                if (error.code === 'auth/requires-recent-login') {
                                                    Alert.alert('Authentication Required', 'Please log out and log back in to delete your account.');
                                                } else {
                                                    Alert.alert('Error', error.message || 'Failed to delete account');
                                                }
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                        <Text style={styles.deleteText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    sectionTitle: {
        fontSize: 14,
        color: '#666',
        marginHorizontal: 15,
        marginVertical: 10,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    iconContainer: {
        marginRight: 15,
    },
    rowContent: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    rowSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    menuText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
    },
    logoutText: {
        marginLeft: 10,
        color: '#FF3B30',
        fontWeight: '600',
        fontSize: 16,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        backgroundColor: '#fee2e2',
        marginHorizontal: 15,
        marginBottom: 15,
        borderRadius: 8,
    },
    deleteText: {
        marginLeft: 10,
        color: '#FF3B30',
        fontWeight: '600',
        fontSize: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 15,
    },
    toggleText: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    toggleDesc: {
        fontSize: 12,
        color: '#666',
    },
});
