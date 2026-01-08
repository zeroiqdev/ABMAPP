import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { firebaseService } from '@/services/firebaseService';

export default function WorkshopSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/');
            } catch (error) {
              console.error('Logout failed:', error);
            }
          },
        },
      ]
    );
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>

        {/* Account Section - First */}
        <View style={[styles.section, { marginTop: 30 }]}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {user?.role ? user.role.replace('_', ' ').toUpperCase() : 'STAFF'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.settingRow} onPress={handleResetPassword}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={20} color="#000" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Reset Password</Text>
              <Text style={styles.settingDesc}>Send password reset email</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Workshop Settings - Admin Only */}
        {(user?.role === 'admin' || user?.role === 'service_advisor') && (
          <View style={[styles.section, { marginTop: 40 }]}>
            <Text style={styles.sectionTitle}>Team & Access</Text>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/(workshop)/staff-invitations')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="people" size={22} color="#000" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Staff Management</Text>
                <Text style={styles.settingDesc}>Manage invites, roles, and vendors</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/(workshop)/access-control')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={22} color="#000" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Access Control</Text>
                <Text style={styles.settingDesc}>Configure detailed permissions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        )}

        {/* Preferences */}
        <View style={[styles.section, { marginTop: 40 }]}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="notifications" size={22} color="#000" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDesc}>Receive job and system updates</Text>
            </View>
            <Switch
              trackColor={{ false: '#e0e0e0', true: '#000' }}
              value={true}
              onValueChange={() => { }}
              thumbColor="#fff"
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
    paddingLeft: 20,
  },
  sectionTitle: {
    position: 'absolute',
    top: -28,
    left: 20,
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  // Profile Styles
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#8E8E93',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  // Row Styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#000',
  },
  settingDesc: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
