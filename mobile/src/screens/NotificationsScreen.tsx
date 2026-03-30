import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [messageEnabled, setMessageEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Notifications</Text>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#6C63FF" />
        <Text style={styles.infoText}>
          Push notifications are handled by the OS. New message notifications will deep link into chats once configured.
        </Text>
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications" size={20} color="#9ca3af" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>Receive notifications on your device</Text>
            </View>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ false: '#3f3f46', true: '#6C63FF' }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="chatbubbles" size={20} color="#9ca3af" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Message Notifications</Text>
              <Text style={styles.settingDescription}>Get notified about new messages</Text>
            </View>
          </View>
          <Switch
            value={messageEnabled}
            onValueChange={setMessageEnabled}
            trackColor={{ false: '#3f3f46', true: '#6C63FF' }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="volume-high" size={20} color="#9ca3af" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sound</Text>
              <Text style={styles.settingDescription}>Play sound for notifications</Text>
            </View>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#3f3f46', true: '#6C63FF' }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="phone-portrait" size={20} color="#9ca3af" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Vibration</Text>
              <Text style={styles.settingDescription}>Vibrate on notifications</Text>
            </View>
          </View>
          <Switch
            value={vibrationEnabled}
            onValueChange={setVibrationEnabled}
            trackColor={{ false: '#3f3f46', true: '#6C63FF' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Notification History */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          <TouchableOpacity>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.emptyNotifications}>
          <Ionicons name="notifications-off-outline" size={48} color="#374151" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>You'll see notifications here when you receive them</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  content: {
    paddingBottom: 32,
  },
  headerContainer: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f9fafb',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 12,
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  clearText: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#e5e7eb',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#9ca3af',
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#27272a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#9ca3af',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
