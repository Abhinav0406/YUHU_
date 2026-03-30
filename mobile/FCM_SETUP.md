# FCM Push Notifications Setup Guide for EAS Build

This guide will help you set up Firebase Cloud Messaging (FCM) for push notifications in your Expo app using EAS Build.

## Prerequisites

1. **EAS CLI installed**
   ```bash
   npm install -g eas-cli
   ```

2. **Expo account** (sign up at https://expo.dev)

3. **Firebase project** (create at https://console.firebase.google.com)

## Step 1: Create EAS Project

1. Login to EAS:
   ```bash
   eas login
   ```

2. Initialize EAS in your project:
   ```bash
   cd mobile
   eas init
   ```

3. This will create an `eas.json` file and give you a project ID. Update `app.json` with your project ID:
   ```json
   "extra": {
     "eas": {
       "projectId": "your-project-id-here"
     }
   }
   ```

## Step 2: Set Up Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Add an Android app:
   - Click "Add app" → Select Android
   - Package name: `com.yuhu.app` (from your app.json)
   - Download `google-services.json`
   - Place it in `mobile/` directory

4. Get your FCM Server Key:
   - Go to Project Settings → Cloud Messaging
   - Copy the "Server key" (you'll need this for Supabase)

## Step 3: Configure EAS Build for FCM

1. Create/update `eas.json`:
   ```json
   {
     "build": {
       "production": {
         "android": {
           "buildType": "apk",
           "googleServicesFile": "./google-services.json"
         }
       },
       "development": {
         "android": {
           "buildType": "apk",
           "googleServicesFile": "./google-services.json"
         }
       }
     }
   }
   ```

2. Update `app.json` to include the project ID in expo-notifications:
   ```json
   "plugins": [
     [
       "expo-notifications",
       {
         "icon": "./assets/icon.png",
         "color": "#6C63FF",
         "sounds": ["default"],
         "mode": "production"
       }
     ]
   ]
   ```

## Step 4: Set Up Supabase

1. **Create user_tokens table** (if not exists):
   ```sql
   CREATE TABLE IF NOT EXISTS user_tokens (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     fcm_token TEXT NOT NULL,
     platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(user_id, platform)
   );

   CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
   CREATE INDEX IF NOT EXISTS idx_user_tokens_fcm_token ON user_tokens(fcm_token);
   ```

2. **Add FCM Server Key to Supabase**:
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Add environment variable: `FCM_SERVER_KEY=your_fcm_server_key_here`

3. **Deploy/Update Edge Function** (if you have one):
   - The Edge Function should send notifications using FCM
   - Make sure it uses the `FCM_SERVER_KEY` environment variable

## Step 5: Build with EAS

1. **Configure build credentials**:
   ```bash
   eas build:configure
   ```

2. **Build Android APK**:
   ```bash
   eas build --platform android --profile production
   ```

   Or for development:
   ```bash
   eas build --platform android --profile development
   ```

3. **Download and install** the APK on your device

## Step 6: Test Push Notifications

1. **Install the app** on a physical Android device
2. **Login** to the app - it will automatically register for push notifications
3. **Check Supabase** - verify that the token is saved in `user_tokens` table
4. **Send a test notification** using your backend/Edge Function

## How It Works

1. **App starts** → `NotificationService` registers for push notifications
2. **Expo Push Token generated** → Stored in Supabase `user_tokens` table
3. **Message sent** → Your backend/Edge Function sends push notification via FCM
4. **User receives notification** → Even when app is closed!

## Troubleshooting

### Token not saving to Supabase
- Check that `user_tokens` table exists
- Verify user is logged in
- Check console logs for errors

### Notifications not received
- Ensure you're using a physical device (not emulator)
- Check that FCM Server Key is correct in Supabase
- Verify `google-services.json` is in the correct location
- Check that the app has notification permissions

### Build errors
- Make sure `google-services.json` is in the `mobile/` directory
- Verify `eas.json` is configured correctly
- Check that your EAS project ID is set in `app.json`

## Next Steps

1. Set up notification triggers in your backend when new messages arrive
2. Add notification badges for unread messages
3. Implement notification actions (reply, mark as read, etc.)
4. Add iOS support (requires Apple Developer account and APNs setup)
