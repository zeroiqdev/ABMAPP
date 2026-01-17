import React, { useState, useEffect } from 'react';
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
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export default function WorkshopSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [permissions, setPermissions] = useState<any>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.workshopId && user?.role && user.role !== 'admin' && user.role !== 'super_admin') {
        try {
          const allPerms = await firebaseService.getWorkshopPermissions(user.workshopId);
          setPermissions(allPerms[user.role] || {});
        } catch (error) {
          console.error(error);
        }
      }
    };
    fetchPermissions();
  }, [user]);

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

          <TouchableOpacity
            style={styles.settingRow}
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
                        // Redirect handled by auth state change or router logic
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
            <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Delete Account</Text>
              <Text style={styles.settingDesc}>Permanently remove your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Super Admin Access */}
        {user?.role === 'super_admin' && (
          <View style={[styles.section, { marginTop: 40 }]}>
            <Text style={styles.sectionTitle}>Administration</Text>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/(super-admin)/dashboard')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="settings" size={22} color="#000" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Manage Workshops</Text>
                <Text style={styles.settingDesc}>Manage workshops and subscriptions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        )}

        {/* Workshop Settings - Admin Only */}
        {(user?.role === 'admin' || user?.role === 'super_admin' || permissions?.canManageSettings) && (
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
        <PreferencesSection userId={user?.id} styles={styles} />

      </ScrollView>
    </View>
  );
}

// Extracted component to handle notification preferences
function PreferencesSection({ userId, styles }: { userId?: string; styles: any }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    // Load user preferences
    const loadPrefs = async () => {
      try {
        const userData = await firebaseService.getUser(userId);
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
  }, [userId]);

  const updatePreference = async (key: string, value: boolean) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'users', userId), { [key]: value });
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

  return (
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
          value={pushEnabled}
          onValueChange={handlePushToggle}
          thumbColor="#fff"
          disabled={loading}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail" size={22} color="#000" />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Email Notifications</Text>
          <Text style={styles.settingDesc}>Receive updates via email</Text>
        </View>
        <Switch
          trackColor={{ false: '#e0e0e0', true: '#000' }}
          value={emailEnabled}
          onValueChange={handleEmailToggle}
          thumbColor="#fff"
          disabled={loading}
        />
      </View>
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
