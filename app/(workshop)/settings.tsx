import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function WorkshopSettingsScreen() {
  const router = useRouter();
  const userRel = useAuthStore();
  const { user } = userRel;

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
        {/* Workshop Settings */}
        {user?.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workshop Settings</Text>
            <TouchableOpacity style={styles.settingRow}>
              <Ionicons name="business-outline" size={24} color="#666" />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Workshop Information</Text>
                <Text style={styles.settingDesc}>Manage workshop details</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingRow}>
              <Ionicons name="calculator-outline" size={24} color="#666" />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>VAT Rate</Text>
                <Text style={styles.settingDesc}>Configure VAT percentage</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/(workshop)/staff-invitations')}
            >
              <Ionicons name="people-outline" size={24} color="#666" />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Staff Management</Text>
                <Text style={styles.settingDesc}>Manage staff roles and permissions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <Ionicons name="notifications-outline" size={24} color="#666" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDesc}>Receive job and system updates</Text>
            </View>
            <Switch
              trackColor={{ false: '#ddd', true: '#007AFF' }}
              value={true}
              onValueChange={() => { }}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.settingRow}>
            <Ionicons name="person-outline" size={24} color="#666" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Profile</Text>
              <Text style={styles.settingDesc}>Update your profile information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <Ionicons name="lock-closed-outline" size={24} color="#666" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Change Password</Text>
              <Text style={styles.settingDesc}>Update your password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={async () => {
              try {
                await userRel.logout();
                router.replace('/');
              } catch (error) {
                console.error('Logout failed:', error);
              }
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Log Out</Text>
              <Text style={styles.settingDesc}>Sign out of your account</Text>
            </View>
          </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 15,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: '#666',
  },
});

