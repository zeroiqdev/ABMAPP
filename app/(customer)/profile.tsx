import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, ThemeMode } from '@/store/themeStore';
import { firebaseService } from '@/services/firebaseService';
import { Spacing, Typography, useColors } from '@/constants/design';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const colors = useColors();
  const styles = getStyles(colors);
  const themeSelectorStyles = getThemeSelectorStyles(colors);

  const [editing, setEditing] = useState(false);
  // ... rest of state

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const handleSave = async () => {
    if (!user) return;

    try {
      await firebaseService.updateUser(user.id, {
        name,
        phone,
      });
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            await logout();
            router.replace('/');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    router.push('/(auth)/forgot-password');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Info */}
        <View style={styles.section}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color={colors.textSecondary} />
            </View>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                />
              ) : (
                <Text style={styles.value}>{user?.name}</Text>
              )}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email}</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.value}>{user?.phone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/(customer)/settings')}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>General Settings</Text>
                  <Text style={styles.settingDesc}>
                    Account deletion and other preferences
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            {user?.connectedWorkshopIds && user.connectedWorkshopIds.length > 1 && (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => {
                  Alert.alert(
                    'Switch Workshop',
                    'Select a workshop to switch to',
                    user.connectedWorkshopIds!.map(id => ({
                      text: id === user.workshopId ? `${id} (Active)` : id,
                      onPress: () => {
                        if (id !== user.workshopId) {
                          useAuthStore.getState().switchWorkshop(id);
                          Alert.alert('Success', `Switched to ${id}`);
                        }
                      },
                      style: id === user.workshopId ? 'cancel' : 'default'
                    } as any)).concat([{ text: 'Cancel', style: 'cancel', onPress: () => { } } as any])
                  );
                }}
              >
                <View style={styles.settingInfo}>
                  <Ionicons name="business-outline" size={24} color={colors.textSecondary} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Switch Workshop</Text>
                    <Text style={styles.settingDesc}>
                      Current: {user.workshopId}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingDesc}>
                    Receive notifications about your jobs
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: colors.textPrimary }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="mail-outline" size={24} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingDesc}>
                    Receive email updates
                  </Text>
                </View>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: '#ddd', true: '#000' }}
              />
            </View>
          </View>

          {/* Appearance */}
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="contrast-outline" size={24} color={colors.textSecondary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Appearance</Text>
                <Text style={styles.settingDesc}>Choose your preferred theme</Text>
              </View>
            </View>
          </View>
          <ThemeSelector />
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleChangePassword}
            >
              <Ionicons name="lock-closed-outline" size={24} color={colors.textSecondary} />
              <Text style={styles.actionText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={colors.background} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          {/* Rescue Button for Admins stuck in Customer App */}

        </View>
      </ScrollView>
    </View>
  );
}

// Theme selector component
function ThemeSelector() {
  const { themeMode, setThemeMode } = useThemeStore();
  const colors = useColors();
  const themeSelectorStyles = getThemeSelectorStyles(colors);

  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'sunny' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'System', icon: 'phone-portrait' },
  ];

  return (
    <View style={themeSelectorStyles.container}>
      {themeOptions.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            themeSelectorStyles.option,
            themeMode === option.value && themeSelectorStyles.optionActive,
          ]}
          onPress={() => setThemeMode(option.value)}
        >
          <Ionicons
            name={option.icon as any}
            size={18}
            color={themeMode === option.value ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              themeSelectorStyles.optionText,
              themeMode === option.value && themeSelectorStyles.optionTextActive,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const getThemeSelectorStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 15,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background, // Was #f0f0f0, use background or surface? Surface usually. Or background if on surface.
    // The parent is section (surface/white). So this should be background/grey.
    // In dark mode: Section is Surface (Dark Grey). Option should be Background (Black) or lighter grey?
    // Let's use colors.background for the option background.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  saveButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: 20,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.textPrimary,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.background, // Was #f9f9f9. On surface, use background.
    borderRadius: 12,
    padding: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surface, // Input on background
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  value: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  settingsCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 15,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionsCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 15,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 15,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary, // Uses secondary (black in light, white in dark?) Wait.
    // Colors.secondary is #000 (Black).
    // DarkColors.secondary is #FFFFFF (White).
    // Logout button text is White in hardcode.
    // If background is white in dark mode, text should be black?
    // Let's check original: backgroundColor: '#000', logoutText: { color: '#fff' }.
    // In Dark Mode, we want it to stand out?
    // Usually logout is red or just a button.
    // If we use colors.secondary, in dark mode it is White. Text should be Black.
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  logoutText: {
    color: colors.background, // Text on secondary should be background color (inverted)
    fontSize: 16,
    fontWeight: '600',
  },
});

