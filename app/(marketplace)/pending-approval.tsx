import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/constants/design';

export default function PendingApprovalScreen() {
    const router = useRouter();
    const { logout } = useAuthStore();
    const colors = useColors();
    const styles = getStyles(colors);

    const handleLogout = async () => {
        await logout();
        router.replace('/');
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="hourglass-outline" size={64} color={colors.warning} />
                </View>
                <Text style={styles.title}>Registration Pending</Text>
                <Text style={styles.message}>
                    Your vendor registration has been submitted and is currently under review by our team.
                </Text>
                <Text style={styles.message}>
                    You will receive access to the vendor dashboard once your application is approved.
                </Text>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={handleLogout}>
                    <Text style={styles.buttonText}>Log Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 30,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 24,
    },
    footer: {
        width: '100%',
        marginBottom: 20,
    },
    button: {
        backgroundColor: colors.textPrimary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
});
