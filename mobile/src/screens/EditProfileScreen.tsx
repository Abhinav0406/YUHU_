import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  email?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  status?: string;
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export default function EditProfileScreen({ navigation }: any) {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [statusText, setStatusText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: loadError } = await supabase
          .from('profiles')
          .select('id, email, full_name, username, avatar_url, status')
          .eq('id', user.id)
          .single();

        if (loadError) {
          console.error('Error loading profile', loadError);
          setError('Failed to load profile');
        } else if (data) {
          setProfile(data as Profile);
          setFullName(data.full_name || '');
          setUsername(data.username || '');
          setStatusText(data.status || '');
          setAvatarUrl(data.avatar_url || null);
        }
      } catch (e: any) {
        console.error('Unexpected error loading profile', e);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission required to access photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      if (!user?.id) return;

      setSaving(true);
      setError(null);

      // Read file and upload as bytes like other uploads in the app
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e: any) {
        console.error('Error reading avatar file', e);
        setError('Failed to read image file');
        setSaving(false);
        return;
      }

      const bytes = base64ToUint8Array(base64);

      const ext = (asset.fileName || 'avatar.jpg').split('.').pop() || 'jpg';
      const filePath = `avatars/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading avatar', uploadError);
        setError(uploadError.message || 'Failed to upload avatar');
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      setAvatarUrl(publicUrl);
      setSaving(false);
    } catch (e: any) {
      console.error('Error picking avatar', e);
      setError('Failed to pick avatar');
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);

    try {
      const updates: Partial<Profile> & { id: string } = {
        id: user.id,
        full_name: fullName.trim() || null as any,
        username: username.trim() || null as any,
        status: statusText.trim() || null as any,
        avatar_url: avatarUrl || null as any,
        email: profile?.email || user?.email || null as any,
      };

      const { error: updateError } = await supabase.from('profiles').upsert(updates);

      if (updateError) {
        console.error('Error saving profile', updateError);
        setError('Failed to save profile');
      } else {
        navigation.goBack();
      }
    } catch (e: any) {
      console.error('Unexpected error saving profile', e);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const initials =
    fullName.trim() ||
    profile?.username ||
    profile?.email?.split('@')[0] ||
    'User';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#f9fafb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#6C63FF" />
          </View>
        ) : (
          <>
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={pickAvatar}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {initials.toString().slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera-outline" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#6b7280"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#6b7280"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <Text style={styles.label}>About</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Say something about yourself"
                placeholderTextColor="#6b7280"
                value={statusText}
                onChangeText={setStatusText}
                multiline
                numberOfLines={3}
                maxLength={160}
              />

              <Text style={styles.label}>Email</Text>
              <View style={[styles.input, styles.readonlyInput]}>
                <Text style={styles.readonlyText}>{profile?.email || user?.email}</Text>
              </View>
            </View>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    paddingRight: 8,
    paddingVertical: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#020617',
  },
  fieldSection: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 15,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  readonlyInput: {
    backgroundColor: '#111827',
  },
  readonlyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#f97373',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

