import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Colors, Spacing, Typography } from '@/constants/design';

export default function CustomerSettingsScreen() {
    const router = useRouter();
    const { deleteAccount } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action involves deleting all your data permanently and cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await deleteAccount();
                            // Auth store handles redirect to login, but we can ensure navigation reset if needed
                            // router.replace('/'); logic is likely in a _layout.tsx based on user state
                        } catch (error: any) {
                            setLoading(false);
                            console.error('Delete account error:', error);
                            if (error.code === 'auth/requires-recent-login') {
                                Alert.alert(
                                    'Authentication Required',
                                    'For security reasons, please log out and log back in, then try deleting your account again.'
                                );
                            } else {
                                Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
                            }
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Deleting account...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Actions</Text>

                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDeleteAccount}
                    >
                        <Ionicons name="trash-outline" size={20} color={Colors.error} />
                        <Text style={styles.deleteButtonText}>Delete Account</Text>
                    </TouchableOpacity>

                    <Text style={styles.disclaimerText}>
                        Deleting your account will remove all your data, including vehicle history and jobs.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    loadingText: {
        marginTop: Spacing.md,
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
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
    backButton: {
        padding: Spacing.xs,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.bold,
        color: Colors.textPrimary,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    section: {
        marginBottom: Spacing.xl,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.semibold,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        backgroundColor: '#fee2e2', // Light red
        borderRadius: 8,
        gap: Spacing.sm,
    },
    deleteButtonText: {
        color: Colors.error,
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.bold,
    },
    disclaimerText: {
        marginTop: Spacing.md,
        fontSize: Typography.fontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
    },
});
