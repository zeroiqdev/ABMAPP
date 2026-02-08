import React, { useEffect, useState, useMemo } from 'react';
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
import { useColors } from '@/constants/design';

const SYSTEM_ROLES: string[] = [
    'admin',
    'technician',
    'storekeeper',
    'accountant',
    'service_advisor',
];

const PERMISSIONS = [
    { key: 'canViewDashboard', label: 'View Dashboard', description: 'Access the home dashboard' },
    { key: 'canManageJobs', label: 'Manage Jobs', description: 'Create, update, and delete jobs' },
    { key: 'canViewCustomers', label: 'View Customers', description: 'View customer list and details' },
    { key: 'canManageCustomers', label: 'Manage Customers', description: 'Create, update, and delete customers' },
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
    canViewDashboard: false,
    canManageJobs: false,
    canViewCustomers: false,
    canManageCustomers: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewFinance: false,
    canManageFinance: false,
    canInviteStaff: false,
    canManageStaff: false,
    canManageSettings: false,
    canViewReports: false,
};

// Default permissions for system roles - these are ON by default when no custom settings exist
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
    admin: {
        canViewDashboard: true,
        canManageJobs: true,
        canViewInventory: true,
        canManageInventory: true,
        canViewFinance: true,
        canManageFinance: true,
        canInviteStaff: true,
        canManageStaff: true,
        canManageSettings: true,
        canViewReports: true,
    },
    technician: {
        canViewDashboard: true,
        canManageJobs: true,
        canViewInventory: true,
        canManageInventory: false,
        canViewFinance: false,
        canManageFinance: false,
        canInviteStaff: false,
        canManageStaff: false,
        canManageSettings: false,
        canViewReports: false,
    },
    storekeeper: {
        canViewDashboard: true,
        canManageJobs: false,
        canViewInventory: true,
        canManageInventory: true,
        canViewFinance: false,
        canManageFinance: false,
        canInviteStaff: false,
        canManageStaff: false,
        canManageSettings: false,
        canViewReports: false,
    },
    accountant: {
        canViewDashboard: true,
        canManageJobs: false,
        canViewInventory: true,
        canManageInventory: false,
        canViewFinance: true,
        canManageFinance: true,
        canInviteStaff: false,
        canManageStaff: false,
        canManageSettings: false,
        canViewReports: true,
    },
    service_advisor: {
        canViewDashboard: true,
        canManageJobs: true,
        canViewInventory: true,
        canManageInventory: false,
        canViewFinance: true,
        canManageFinance: false,
        canInviteStaff: false,
        canManageStaff: false,
        canManageSettings: false,
        canViewReports: true,
    },
};

export default function AccessControlScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const colors = useColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<Record<string, any>>({});
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Dynamic Roles State
    const [availableRoles, setAvailableRoles] = useState<string[]>(SYSTEM_ROLES);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePermissions, setNewRolePermissions] = useState<typeof DEFAULT_PERMISSIONS>(DEFAULT_PERMISSIONS);

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
            // Create with selected permissions
            await firebaseService.updateWorkshopPermissions(user.workshopId, roleKey, newRolePermissions);
            setNewRoleName('');
            setNewRolePermissions(DEFAULT_PERMISSIONS);
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
                <ActivityIndicator size="large" color={colors.textPrimary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(workshop)/settings')}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Access Control</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                    <Ionicons name="add" size={24} color={colors.textPrimary} />
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
                            <View style={styles.roleHeader}>
                                <View style={styles.roleHeaderLeft}>
                                    <View style={styles.roleIcon}>
                                        <Ionicons
                                            name={isSystem ? "shield-checkmark-outline" : "person-outline"}
                                            size={20}
                                            color={colors.textPrimary}
                                        />
                                    </View>
                                    <View>
                                        <Text style={styles.roleTitle}>
                                            {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                                        </Text>
                                        {!isSystem && <Text style={styles.customBadge}>Custom Role</Text>}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setSelectedRole(selectedRole === role ? null : role)}
                                    style={{ padding: 8 }}
                                >
                                    <Ionicons
                                        name={selectedRole === role ? "chevron-up" : "chevron-down"}
                                        size={20}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>

                            {selectedRole === role && (
                                <View style={styles.permissionsList}>
                                    {PERMISSIONS.map((perm) => {
                                        // Use saved permissions, or fall back to role defaults for system roles
                                        const savedValue = permissions[role]?.[perm.key];
                                        const defaultValue = DEFAULT_ROLE_PERMISSIONS[role]?.[perm.key] || false;
                                        const isEnabled = savedValue !== undefined ? savedValue : defaultValue;
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

                                    {!isSystem && (
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteRole(role)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                            <Text style={styles.deleteButtonText}>Delete Role</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )
                }
                )}

                <View style={{ height: 40 }} />
            </ScrollView >

            <Modal
                visible={showCreateModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <TouchableOpacity
                            style={{ position: 'absolute', top: 16, left: 16, zIndex: 1 }}
                            onPress={() => setShowCreateModal(false)}
                        >
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Create New Role</Text>
                        <Text style={styles.modalSubtitle}>Enter info and select permissions</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Role Name (e.g. Supervisor)"
                            value={newRoleName}
                            onChangeText={setNewRoleName}
                            autoFocus
                        />

                        <ScrollView style={{ marginBottom: 20, maxHeight: 300 }}>
                            <Text style={{ fontWeight: '600', marginBottom: 10 }}>Permissions</Text>
                            {PERMISSIONS.map((perm) => (
                                <View key={perm.key} style={styles.permissionRow}>
                                    <View style={styles.permissionInfo}>
                                        <Text style={styles.permissionLabel}>{perm.label}</Text>
                                        <Text style={styles.permissionDesc}>{perm.description}</Text>
                                    </View>
                                    <Switch
                                        trackColor={{ false: '#ddd', true: '#000' }}
                                        thumbColor={(newRolePermissions as any)[perm.key] ? '#fff' : '#f4f3f4'}
                                        value={!!(newRolePermissions as any)[perm.key]}
                                        onValueChange={(val) => setNewRolePermissions((prev) => ({ ...prev, [perm.key]: val }))}
                                    />
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.createButton]}
                            onPress={handleCreateRole}
                        >
                            <Text style={styles.createButtonText}>Create Role</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View >
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
        padding: 0,
    },
    infoSection: {
        marginBottom: 20,
        marginHorizontal: 20,
        marginTop: 20,
        padding: 15,
        backgroundColor: colors.surface,
        borderRadius: 8,
    },
    infoText: {
        color: colors.textSecondary,
        lineHeight: 20,
    },
    roleCard: {
        backgroundColor: colors.surface,
        marginBottom: 0,
        borderRadius: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },

    roleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    customBadge: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    permissionsList: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 20,
        paddingVertical: 15,
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
        color: colors.textPrimary,
    },
    permissionDesc: {
        fontSize: 12,
        color: colors.textSecondary,
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
        backgroundColor: colors.surface,
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
        color: colors.textPrimary,
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 24,
        color: colors.textPrimary,
        backgroundColor: colors.background,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    cancelButton: {
        backgroundColor: colors.background,
    },
    createButton: {
        backgroundColor: colors.secondary,
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontWeight: '600',
    },
    createButtonText: {
        color: colors.textInverse,
        fontWeight: '700',
        fontSize: 16,
    },
});
