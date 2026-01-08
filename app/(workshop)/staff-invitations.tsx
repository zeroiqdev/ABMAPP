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

// Added 'customer' to system roles so it can be selected for invites
const SYSTEM_ROLES: string[] = ['service_advisor', 'technician', 'storekeeper', 'accountant', 'admin', 'vendor', 'customer'];

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

  const canInvite = user?.role === 'admin' || user?.role === 'service_advisor';

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
      const customRoles = Object.keys(permissions || {});
      // Merge unique roles
      const allRoles = Array.from(new Set([...SYSTEM_ROLES, ...customRoles]));
      setAvailableRoles(allRoles);

    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!canInvite) {
      Alert.alert('Permission Denied', 'Only admins or service advisors can send invites.');
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

  const renderActiveStaff = (staff: User) => (
    <View key={staff.id} style={styles.itemCard}>
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
        <View style={[styles.statusBadge, { backgroundColor: '#d1fae5' }]}>
          <Text style={[styles.statusText, { color: '#065f46' }]}>Active</Text>
        </View>
      </View>
    </View>
  );

  const renderInviteCard = (invite: StaffInvitation) => (
    <View key={invite.id} style={styles.itemCard}>
      <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
        <Ionicons name="mail-outline" size={24} color="#d97706" />
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
        <Text style={styles.metaTimestamp}>
          {new Date(invite.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

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
          <Ionicons name="shield-checkmark" size={48} color="#007AFF" />
          <Text style={styles.permissionTitle}>Admin Access Required</Text>
          <Text style={styles.permissionText}>
            Only workshop admins or service advisors can send staff invitations.
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
          <TouchableOpacity
            style={[styles.tab, activeTab === 'vendors' && styles.tabActive]}
            onPress={() => setActiveTab('vendors')}
          >
            <Text style={[styles.tabText, activeTab === 'vendors' && styles.tabTextActive]}>Vendors ({activeVendors.length})</Text>
          </TouchableOpacity>
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
              activeVendors.map(renderActiveStaff) // Reusing renderActiveStaff for vendors
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
});

