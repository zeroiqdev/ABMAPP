import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { StaffInvitation, UserRole, User } from '@/types';
import VendorDetailsModal from '@/components/VendorDetailsModal';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { AppConfig } from '@/constants/config';

// Added 'customer' to system roles so it can be selected for invites
const SYSTEM_ROLES: string[] = ['service_advisor', 'technician', 'storekeeper', 'accountant', 'admin', 'vendor'];

export default function StaffInvitationsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [invites, setInvites] = useState<StaffInvitation[]>([]);
  const [activeStaff, setActiveStaff] = useState<User[]>([]);
  const [activeVendors, setActiveVendors] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>(SYSTEM_ROLES);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>('technician');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'vendors' | 'pending'>('active');

  // Modals
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<User | null>(null);

  const [userPermissions, setUserPermissions] = useState<any>({});

  const canInvite = user?.role === 'admin' || user?.role === 'super_admin' || userPermissions?.canInviteStaff;

  useEffect(() => {
    loadData();
  }, [user?.workshopId]);

  const loadData = async () => {
    if (!user?.workshopId) return;
    setLoadingData(true);
    try {
      // Load Invites
      const invitesData = await firebaseService.getStaffInvitations(user.workshopId);
      setInvites(invitesData);

      // Load Active Staff - Filter out customers
      const usersData = await firebaseService.getUsersByWorkshop(user.workshopId);
      const staffOnly = usersData.filter(u => u.role !== 'customer' && u.role !== 'vendor');
      const vendorsOnly = usersData.filter(u => u.role === 'vendor');

      setActiveStaff(staffOnly);
      setActiveVendors(vendorsOnly);

      // Load Roles
      const permissions = await firebaseService.getWorkshopPermissions(user.workshopId);
      setUserPermissions(permissions[user.role] || {});

      const customRoles = Object.keys(permissions || {});
      // Merge unique roles
      // Merge unique roles
      let allRoles = Array.from(new Set([...SYSTEM_ROLES, ...customRoles]));

      // Restrict Vendor role if not Master Workshop
      if (user.workshopId !== AppConfig.MASTER_WORKSHOP_ID) {
        allRoles = allRoles.filter(r => r !== 'vendor');
      }

      setAvailableRoles(allRoles);

    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!canInvite) {
      Alert.alert('Permission Denied', 'You do not have permission to send staff invites.');
      return;
    }
    if (!user?.workshopId) {
      Alert.alert('Error', 'Workshop information not found.');
      return;
    }
    if (!name || !email) {
      Alert.alert('Error', 'Name and email are required.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Error', 'Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const { invitationCode } = await firebaseService.createStaffInvitation(
        email,
        name,
        role as UserRole,
        user.id,
        user.workshopId,
        phone || undefined
      );
      Alert.alert(
        'Invite Created',
        `Share this code with ${name}:\n\n${invitationCode}\n\nThey can redeem it from the staff invite screen.`
      );

      // Reset and Close
      setName('');
      setEmail('');
      setPhone('');
      setShowInviteModal(false);

      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create invite.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = (targetUser: User) => {
    if (user?.id === targetUser.id) {
      Alert.alert('Error', 'You cannot remove yourself.');
      return;
    }
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${targetUser.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoadingData(true);
            try {
              await firebaseService.deleteUser(targetUser.id);
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setLoadingData(false);
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (progress: any, dragX: any, staff: User) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => confirmDeleteUser(staff)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={styles.deleteActionText}>Remove</Text>
      </TouchableOpacity>
    );
  };

  const renderActiveStaff = (staff: User) => {
    const content = (
      <View style={styles.itemCard}>
        <View style={[styles.iconBox, { backgroundColor: '#000' }]}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
            {staff.name ? staff.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{staff.name}</Text>
          <Text style={styles.itemSubtitle}>{(staff.role || 'Unknown').replace('_', ' ')} • {staff.email}</Text>
        </View>
        <View style={styles.itemRight}>
          <View style={[styles.statusBadge, { backgroundColor: '#d1fae5', marginBottom: 4 }]}>
            <Text style={[styles.statusText, { color: '#065f46' }]}>Active</Text>
          </View>
        </View>
      </View>
    );

    if (user?.role === 'admin' || user?.role === 'super_admin') {
      return (
        <Swipeable
          key={staff.id}
          renderRightActions={(p, d) => renderRightActions(p, d, staff)}
        >
          {content}
        </Swipeable>
      );
    }

    return <View key={staff.id}>{content}</View>;
  };

  const handleCancelInvitation = async (invite: StaffInvitation) => {
    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation for ${invite.name || invite.email}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Invitation',
          style: 'destructive',
          onPress: async () => {
            try {
              await firebaseService.cancelStaffInvitation(invite.id);
              await loadData();
              Alert.alert('Success', 'Invitation cancelled.');
            } catch (error) {
              console.error('Error cancelling invitation:', error);
              Alert.alert('Error', 'Failed to cancel invitation.');
            }
          }
        }
      ]
    );
  };

  const renderCancelInviteAction = (progress: any, dragX: any, invite: StaffInvitation) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleCancelInvitation(invite)}
      >
        <Ionicons name="close-outline" size={24} color="#fff" />
        <Text style={styles.deleteActionText}>Cancel</Text>
      </TouchableOpacity>
    );
  };

  const renderInviteCard = (invite: StaffInvitation) => {
    const content = (
      <View style={styles.itemCard}>
        <View style={[styles.iconBox, { backgroundColor: '#000' }]}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
            {(invite.name || invite.email || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{invite.name || invite.email}</Text>
          <Text style={styles.itemSubtitle}>Role: {invite.role.replace('_', ' ')}</Text>
        </View>
        <View style={styles.itemRight}>
          <View style={[styles.statusBadge, { backgroundColor: invite.used ? '#f1f5f9' : '#fffbeb' }]}>
            <Text style={[styles.statusText, { color: invite.used ? '#64748b' : '#b45309' }]}>
              {invite.used ? 'Used' : 'Pending'}
            </Text>
          </View>
          <Text style={[styles.metaTimestamp, { fontSize: 13, fontWeight: '600', color: '#111', marginTop: 4 }]}>
            {invite.invitationCode}
          </Text>
        </View>
      </View>
    );

    // Wrap in Swipeable only for pending (unused) invites
    if (!invite.used) {
      return (
        <Swipeable
          key={invite.id}
          renderRightActions={(p, d) => renderCancelInviteAction(p, d, invite)}
        >
          {content}
        </Swipeable>
      );
    }

    return <View key={invite.id}>{content}</View>;
  };

  if (!canInvite) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Staff Invites</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.permissionCard}>
          <Ionicons name="shield-checkmark" size={48} color="#000" />
          <Text style={styles.permissionTitle}>Permission Required</Text>
          <Text style={styles.permissionText}>
            You do not have permission to invite new staff. Contact an admin.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Management</Text>
        <TouchableOpacity onPress={() => setShowInviteModal(true)}>
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Staff ({activeStaff.length})</Text>
          </TouchableOpacity>
          {user?.workshopId === AppConfig.MASTER_WORKSHOP_ID && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'vendors' && styles.tabActive]}
              onPress={() => setActiveTab('vendors')}
            >
              <Text style={[styles.tabText, activeTab === 'vendors' && styles.tabTextActive]}>Vendors ({activeVendors.length})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending ({invites.length})</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.listSection}>
          {loadingData ? (
            <ActivityIndicator color="#000" style={{ marginTop: 20 }} />
          ) : activeTab === 'active' ? (
            activeStaff.length === 0 ? (
              <Text style={styles.emptyText}>No active staff members found.</Text>
            ) : (
              activeStaff.map(renderActiveStaff)
            )
          ) : activeTab === 'vendors' ? (
            activeVendors.length === 0 ? (
              <Text style={styles.emptyText}>No active vendors found.</Text>
            ) : (
              activeVendors.map((vendor) => (
                <TouchableOpacity
                  key={vendor.id}
                  style={styles.itemCard}
                  onPress={() => setSelectedVendor(vendor)}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#000' }]}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
                      {vendor.name ? vendor.name.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{vendor.name || 'Unnamed Vendor'}</Text>
                    <Text style={styles.itemSubtitle}>{vendor.email}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    {vendor.vendorStatus === 'active' ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.statusText, { color: '#16a34a' }]}>Active</Text>
                      </View>
                    ) : vendor.vendorStatus === 'pending_approval' ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#fef9c3' }]}>
                        <Text style={[styles.statusText, { color: '#ca8a04' }]}>Pending</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: '#f3f4f6' }]}>
                        <Text style={[styles.statusText, { color: '#4b5563' }]}>Incomplete</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : (
            invites.length === 0 ? (
              <Text style={styles.emptyText}>No invitations sent yet.</Text>
            ) : (
              invites.map(renderInviteCard)
            )
          )}
        </View>
      </ScrollView>

      {/* Vendor Details Modal */}
      <VendorDetailsModal
        visible={!!selectedVendor}
        vendor={selectedVendor}
        onClose={() => setSelectedVendor(null)}
        onApprove={() => {
          loadData();
        }}
      />

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowInviteModal(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite New Member</Text>
                <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#666"
                  value={name}
                  onChangeText={setName}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Phone Number (Optional)"
                  placeholderTextColor="#666"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Text style={styles.roleLabel}>Assign Role</Text>
                <View style={styles.roleSelector}>
                  <Text style={styles.roleSelectorText}>{role.replace('_', ' ')}</Text>
                  <View style={styles.roleSelectorControls}>
                    <TouchableOpacity
                      onPress={() => {
                        const currentIndex = availableRoles.indexOf(role);
                        const prevIndex = (currentIndex - 1 + availableRoles.length) % availableRoles.length;
                        setRole(availableRoles[prevIndex]);
                      }}
                      style={styles.roleControlBtn}
                    >
                      <Ionicons name="chevron-up" size={20} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const currentIndex = availableRoles.indexOf(role);
                        const nextIndex = (currentIndex + 1) % availableRoles.length;
                        setRole(availableRoles[nextIndex]);
                      }}
                      style={styles.roleControlBtn}
                    >
                      <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleCreateInvite}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Generate Invite</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 22,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  listSection: {
    paddingHorizontal: 0,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 15, // Ensure title still has padding if used (it's unused in listSection loop but defined)
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  roleSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    paddingLeft: 15,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  roleSelectorText: {
    fontSize: 16,
    color: '#333',
    textTransform: 'capitalize',
    flex: 1,
  },
  roleSelectorControls: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: 10,
  },
  roleControlBtn: {
    padding: 2,
  },
  button: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 16,
    paddingHorizontal: 15,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  permissionCard: {
    margin: 20,
    padding: 30,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
    marginTop: 15,
    gap: 10,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  tabActive: {
    backgroundColor: '#111827',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  tabTextActive: {
    color: '#fff',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
    textTransform: 'capitalize',
  },
  modalOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  inlineRoleList: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    marginTop: -10,
    marginBottom: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  modalCloseButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    marginTop: 4,
  },
});

