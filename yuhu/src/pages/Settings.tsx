import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Bell, 
  Shield, 
  Palette, 
  Volume2, 
  Moon, 
  Sun, 
  User, 
  Lock, 
  Smartphone, 
  Globe,
  LogOut,
  Save,
  Camera,
  Trash2
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/lib/supabase';

const Settings = () => {
  const { user, profile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    messages: true,
    calls: true,
    friendRequests: true,
    sound: true,
    vibration: true
  });
  
  // Privacy settings
  const [privacy, setPrivacy] = useState({
    showOnlineStatus: true,
    showLastSeen: true,
    allowFriendRequests: true,
    allowCalls: true
  });
  
  // Appearance settings
  const [appearance, setAppearance] = useState({
    theme: 'dark',
    fontSize: 'medium',
    language: 'en'
  });
  
  // Account settings
  const [account, setAccount] = useState({
    username: profile?.username || '',
    fullName: profile?.fullName || '',
    email: user?.email || '',
    phone: profile?.phone || ''
  });

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      // Save profile updates
      const { error } = await supabase
        .from('profiles')
        .update({
          username: account.username,
          full_name: account.fullName,
          phone: account.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      // Delete user account
      const { error } = await supabase.auth.admin.deleteUser(user?.id);
      
      if (error) throw error;
      
      toast.success('Account deleted successfully');
      logout();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-zinc-400">Manage your account and preferences</p>
          </div>

          {/* Profile Section */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <User className="h-5 w-5 mr-2 text-yuhu-primary" />
                Profile
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20 border-4 border-yuhu-primary">
                  <AvatarImage src={profile?.avatar} alt={profile?.username} />
                  <AvatarFallback className="text-xl font-bold">
                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="text-yuhu-primary border-yuhu-primary hover:bg-yuhu-primary/10">
                    <Camera className="h-4 w-4 mr-2" />
                    Change Photo
                  </Button>
                  <p className="text-sm text-zinc-400">JPG, PNG up to 2MB</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username" className="text-zinc-300">Username</Label>
                  <Input
                    id="username"
                    value={account.username}
                    onChange={(e) => setAccount(prev => ({ ...prev, username: e.target.value }))}
                    className="bg-zinc-700 border-zinc-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName" className="text-zinc-300">Full Name</Label>
                  <Input
                    id="fullName"
                    value={account.fullName}
                    onChange={(e) => setAccount(prev => ({ ...prev, fullName: e.target.value }))}
                    className="bg-zinc-700 border-zinc-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-zinc-300">Email</Label>
                  <Input
                    id="email"
                    value={account.email}
                    disabled
                    className="bg-zinc-700 border-zinc-600 text-zinc-400"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-zinc-300">Phone</Label>
                  <Input
                    id="phone"
                    value={account.phone}
                    onChange={(e) => setAccount(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-zinc-700 border-zinc-600 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Bell className="h-5 w-5 mr-2 text-yuhu-primary" />
                Notifications
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Control how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Message Notifications</Label>
                  <p className="text-sm text-zinc-400">Receive notifications for new messages</p>
                </div>
                <Switch
                  checked={notifications.messages}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, messages: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Call Notifications</Label>
                  <p className="text-sm text-zinc-400">Receive notifications for incoming calls</p>
                </div>
                <Switch
                  checked={notifications.calls}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, calls: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Friend Request Notifications</Label>
                  <p className="text-sm text-zinc-400">Get notified when someone sends a friend request</p>
                </div>
                <Switch
                  checked={notifications.friendRequests}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, friendRequests: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Sound Notifications</Label>
                  <p className="text-sm text-zinc-400">Play sound for notifications</p>
                </div>
                <Switch
                  checked={notifications.sound}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sound: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Vibration</Label>
                  <p className="text-sm text-zinc-400">Vibrate device for notifications</p>
                </div>
                <Switch
                  checked={notifications.vibration}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, vibration: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy Section */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Shield className="h-5 w-5 mr-2 text-yuhu-primary" />
                Privacy
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Control your privacy and visibility
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Show Online Status</Label>
                  <p className="text-sm text-zinc-400">Let others see when you're online</p>
                </div>
                <Switch
                  checked={privacy.showOnlineStatus}
                  onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, showOnlineStatus: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Show Last Seen</Label>
                  <p className="text-sm text-zinc-400">Display when you were last active</p>
                </div>
                <Switch
                  checked={privacy.showLastSeen}
                  onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, showLastSeen: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Allow Friend Requests</Label>
                  <p className="text-sm text-zinc-400">Let others send you friend requests</p>
                </div>
                <Switch
                  checked={privacy.allowFriendRequests}
                  onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, allowFriendRequests: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-zinc-300">Allow Calls</Label>
                  <p className="text-sm text-zinc-400">Let friends call you</p>
                </div>
                <Switch
                  checked={privacy.allowCalls}
                  onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, allowCalls: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Palette className="h-5 w-5 mr-2 text-yuhu-primary" />
                Appearance
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Customize how the app looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-zinc-300">Theme</Label>
                <div className="flex space-x-2 mt-2">
                  <Button
                    variant={appearance.theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAppearance(prev => ({ ...prev, theme: 'light' }))}
                    className="flex items-center"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={appearance.theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAppearance(prev => ({ ...prev, theme: 'dark' }))}
                    className="flex items-center"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="text-zinc-300">Font Size</Label>
                <div className="flex space-x-2 mt-2">
                  {['small', 'medium', 'large'].map((size) => (
                    <Button
                      key={size}
                      variant={appearance.fontSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAppearance(prev => ({ ...prev, fontSize: size }))}
                      className="capitalize"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-zinc-300">Language</Label>
                <select
                  value={appearance.language}
                  onChange={(e) => setAppearance(prev => ({ ...prev, language: e.target.value }))}
                  className="mt-2 w-full p-2 bg-zinc-700 border border-zinc-600 rounded-md text-white"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Lock className="h-5 w-5 mr-2 text-yuhu-primary" />
                Account Actions
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Manage your account and security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="bg-yuhu-primary hover:bg-yuhu-dark text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* App Info */}
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="pt-6">
              <div className="text-center text-zinc-400">
                <p className="text-sm">Yuhu v1.0.0</p>
                <p className="text-xs mt-1">© 2024 Yuhu. All rights reserved.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;

