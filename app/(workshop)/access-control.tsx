import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { UserRole } from '@/types';

const SYSTEM_ROLES: string[] = [
    'admin',
    'technician',
    'storekeeper',
    'accountant',
    'service_advisor',
];

const PERMISSIONS = [
    { key: 'canManageJobs', label: 'Manage Jobs', description: 'Create, update, and delete jobs' },
    { key: 'canViewInventory', label: 'View Inventory', description: 'View items in inventory' },
    { key: 'canManageInventory', label: 'Manage Inventory', description: 'Add, update, and delete inventory items' },
    { key: 'canViewFinance', label: 'View Finance', description: 'View financial reports and invoices' },
    { key: 'canManageFinance', label: 'Manage Finance', description: 'Create and update invoices, payments' },
    { key: 'canInviteStaff', label: 'Invite Staff', description: 'Send invitations to new staff members' },
    { key: 'canManageStaff', label: 'Manage Staff', description: 'Update and remove existing staff' },
    { key: 'canManageSettings', label: 'Manage Settings', description: 'Update workshop settings' },
    { key: 'canViewReports', label: 'View Reports', description: 'Access workshop performance reports' },
];

const DEFAULT_PERMISSIONS = {
    canManageJobs: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewFinance: false,
    canManageFinance: false,
    canInviteStaff: false,
    canManageStaff: false,
    canManageSettings: false,
    canViewReports: false,
};

export default function AccessControlScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<Record<string, any>>({});
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Dynamic Roles State
    const [availableRoles, setAvailableRoles] = useState<string[]>(SYSTEM_ROLES);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    useEffect(() => {
        fetchPermissions();
    }, [user?.workshopId]);

    const fetchPermissions = async () => {
        if (!user?.workshopId) return;
        try {
            const perms = await firebaseService.getWorkshopPermissions(user.workshopId);
            setPermissions(perms || {});

            // Merge system roles with custom roles found in permissions
            const customRoles = Object.keys(perms || {});
            const allRoles = Array.from(new Set([...SYSTEM_ROLES, ...customRoles]))
                .filter(role => role !== 'customer' && role !== 'vendor');
            setAvailableRoles(allRoles);
        } catch (error) {
            console.error('Error fetching permissions:', error);
            Alert.alert('Error', 'Failed to load permissions');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePermission = async (role: string, permissionKey: string, value: boolean) => {
        if (!user?.workshopId) return;

        // Optimistic update
        const updatedRolePermissions = {
            ...(permissions[role] || {}),
            [permissionKey]: value,
        };

        const updatedPermissions = {
            ...permissions,
            [role]: updatedRolePermissions,
        };

        setPermissions(updatedPermissions);
        setSaving(true);

        try {
            await firebaseService.updateWorkshopPermissions(user.workshopId, role, updatedRolePermissions);
        } catch (error) {
            console.error('Error updating permission:', error);
            Alert.alert('Error', 'Failed to save permission change');
            fetchPermissions();
        } finally {
            setSaving(false);
        }
    };

    const handleCreateRole = async () => {
        if (!user?.workshopId) return;
        if (!newRoleName.trim()) {
            Alert.alert('Error', 'Role name cannot be empty');
            return;
        }

        const roleKey = newRoleName.toLowerCase().trim().replace(/\s+/g, '_');
        if (availableRoles.includes(roleKey)) {
            Alert.alert('Error', 'Role already exists');
            return;
        }

        setSaving(true);
        try {
            // Create with empty permissions
            await firebaseService.updateWorkshopPermissions(user.workshopId, roleKey, DEFAULT_PERMISSIONS);
            setNewRoleName('');
            setShowCreateModal(false);
            await fetchPermissions();
            Alert.alert('Success', `Role "${newRoleName}" created.`);
        } catch (error) {
            console.error('Error creating role:', error);
            Alert.alert('Error', 'Failed to create role');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (role: string) => {
        if (!user?.workshopId) return;
        if (SYSTEM_ROLES.includes(role)) {
            Alert.alert('Error', 'Cannot delete system roles');
            return;
        }

        Alert.alert(
            'Delete Role',
            `Are you sure you want to delete "${role}" role? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            await firebaseService.deleteWorkshopRole(user.workshopId!, role);
                            await fetchPermissions();
                        } catch (error) {
                            console.error('Error deleting role:', error);
                            Alert.alert('Error', 'Failed to delete role');
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

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
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Access Control</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                    <Ionicons name="add" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.infoSection}>
                    <Text style={styles.infoText}>
                        Configure permissions for roles. System roles cannot be deleted.
                    </Text>
                </View>

                {availableRoles.map((role) => {
                    const isSystem = SYSTEM_ROLES.includes(role);
                    return (
                        <View key={role} style={styles.roleCard}>
                            <TouchableOpacity
                                style={styles.roleHeader}
                                onPress={() => setSelectedRole(selectedRole === role ? null : role)}
                            >
                                <View style={styles.roleHeaderLeft}>
                                    <View style={[styles.roleIcon, !isSystem && styles.customRoleIcon]}>
                                        <Ionicons
                                            name={isSystem ? "shield-checkmark-outline" : "person-outline"}
                                            size={20}
                                            color={isSystem ? "#000" : "#007AFF"}
                                        />
                                    </View>
                                    <View>
                                        <Text style={styles.roleTitle}>
                                            {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                                        </Text>
                                        {!isSystem && <Text style={styles.customBadge}>Custom Role</Text>}
                                    </View>
                                </View>
                                <Ionicons
                                    name={selectedRole === role ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>

                            {selectedRole === role && (
                                <View style={styles.permissionsList}>
                                    {!isSystem && (
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteRole(role)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                            <Text style={styles.deleteButtonText}>Delete Role</Text>
                                        </TouchableOpacity>
                                    )}

                                    {PERMISSIONS.map((perm) => {
                                        const isEnabled = permissions[role]?.[perm.key] || false;
                                        return (
                                            <View key={perm.key} style={styles.permissionRow}>
                                                <View style={styles.permissionInfo}>
                                                    <Text style={styles.permissionLabel}>{perm.label}</Text>
                                                    <Text style={styles.permissionDesc}>{perm.description}</Text>
                                                </View>
                                                <Switch
                                                    trackColor={{ false: '#ddd', true: '#000' }}
                                                    thumbColor={isEnabled ? '#fff' : '#f4f3f4'}
                                                    value={isEnabled}
                                                    onValueChange={(val) => handleTogglePermission(role, perm.key, val)}
                                                    disabled={saving}
                                                />
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal
                visible={showCreateModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create New Role</Text>
                        <Text style={styles.modalSubtitle}>Enter a name for the new role</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Supervisor"
                            value={newRoleName}
                            onChangeText={setNewRoleName}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setShowCreateModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.createButton]}
                                onPress={handleCreateRole}
                            >
                                <Text style={styles.createButtonText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    content: {
        flex: 1,
        padding: 20,
    },
    infoSection: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    infoText: {
        color: '#666',
        lineHeight: 20,
    },
    roleCard: {
        backgroundColor: '#fff',
        marginBottom: 15,
        borderRadius: 8,
        overflow: 'hidden',
    },
    roleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    roleHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    roleIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    customRoleIcon: {
        backgroundColor: '#e0f2fe',
    },
    roleTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    customBadge: {
        fontSize: 10,
        color: '#007AFF',
        fontWeight: '500',
    },
    permissionsList: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        padding: 15,
    },
    permissionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    permissionInfo: {
        flex: 1,
        paddingRight: 10,
    },
    permissionLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 4,
    },
    permissionDesc: {
        fontSize: 12,
        color: '#666',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        marginBottom: 20,
        gap: 8,
    },
    deleteButtonText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 14,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: 400,
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f5f5f5',
    },
    createButton: {
        backgroundColor: '#111827',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    createButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
