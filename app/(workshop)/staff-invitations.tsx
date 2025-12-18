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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';
import { StaffInvitation, UserRole } from '@/types';

const staffRoles: UserRole[] = ['service_advisor', 'technician', 'storekeeper', 'accountant', 'admin', 'vendor'];

export default function StaffInvitationsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [invites, setInvites] = useState<StaffInvitation[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('technician');
  const [loading, setLoading] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const canInvite = user?.role === 'admin' || user?.role === 'service_advisor';

  useEffect(() => {
    loadInvites();
  }, [user?.workshopId]);

  const loadInvites = async () => {
    if (!user?.workshopId) return;
    setLoadingInvites(true);
    try {
      const data = await firebaseService.getStaffInvitations(user.workshopId);
      setInvites(data);
    } catch (error) {
      console.error('Failed to load invites', error);
    } finally {
      setLoadingInvites(false);
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
        role,
        user.id,
        user.workshopId,
        phone || undefined
      );
      Alert.alert(
        'Invite Created',
        `Share this code with ${name}:\n\n${invitationCode}\n\nThey can redeem it from the staff invite screen.`
      );
      setName('');
      setEmail('');
      setPhone('');
      setRole('technician');
      await loadInvites();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create invite.');
    } finally {
      setLoading(false);
    }
  };

  const renderInviteCard = (invite: StaffInvitation) => (
    <View key={invite.id} style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <View>
          <Text style={styles.inviteName}>{invite.name}</Text>
          <Text style={styles.inviteEmail}>{invite.email}</Text>
        </View>
        <View style={styles.statusPill(invite.used)}>
          <Text style={styles.statusText}>{invite.used ? 'Used' : 'Pending'}</Text>
        </View>
      </View>
      <View style={styles.inviteMeta}>
        <Text style={styles.metaLabel}>Role</Text>
        <Text style={styles.metaValue}>{invite.role.replace('_', ' ')}</Text>
      </View>
      <View style={styles.inviteMeta}>
        <Text style={styles.metaLabel}>Code</Text>
        <Text style={styles.codeValue}>{invite.invitationCode}</Text>
      </View>
      <Text style={styles.metaTimestamp}>
        Sent on {invite.createdAt.toLocaleDateString()} at {invite.createdAt.toLocaleTimeString()}
      </Text>
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
            Only workshop admins or service advisors can send staff invitations. Please contact your
            administrator for access.
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
        <Text style={styles.headerTitle}>Staff Invitations</Text>
        <TouchableOpacity onPress={loadInvites}>
          <Ionicons name="refresh" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite New Staff</Text>
          <Text style={styles.sectionSubtitle}>
            Send a secure invite code so teammates can create their own login.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Work Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.roleLabel}>Assign Role</Text>
          <View style={styles.roleChips}>
            {staffRoles.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, role === r && styles.roleChipActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                  {r.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
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
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Invites</Text>
            <Text style={styles.sectionSubtitle}>{invites.length} total</Text>
          </View>
          {loadingInvites ? (
            <ActivityIndicator color="#000" />
          ) : invites.length === 0 ? (
            <Text style={styles.emptyText}>No invitations sent yet.</Text>
          ) : (
            invites.map(renderInviteCard)
          )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#777',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  roleChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleChipText: {
    fontSize: 14,
    color: '#555',
    textTransform: 'capitalize',
  },
  roleChipTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#777',
  },
  inviteCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  inviteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  inviteEmail: {
    fontSize: 13,
    color: '#666',
  },
  statusPill: (used: boolean) => ({
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: used ? '#e2e8f0' : '#d1fae5',
  }),
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
  },
  inviteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: '#777',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  codeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  metaTimestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
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
});

