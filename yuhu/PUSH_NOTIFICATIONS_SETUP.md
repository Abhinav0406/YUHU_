# Push Notifications Setup Guide

## ✅ What I've Done:

1. **Removed the notification banner** - No more "Notifications enabled" banner
2. **Added Capacitor Push Notifications** - For out-of-app notifications
3. **Created Supabase integration** - Uses your existing Supabase backend
4. **Updated notification service** - Now supports both in-app and push notifications

## 🚀 Next Steps to Enable Push Notifications:

### 1. **Set up Firebase Cloud Messaging (FCM)**
You need to create a Firebase project and get your FCM server key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Add Android app to your project
4. Download `google-services.json` and place it in `android/app/`
5. Get your **Server Key** from Project Settings > Cloud Messaging

### 2. **Add FCM Server Key to Supabase**
Add your FCM server key as an environment variable in Supabase:

```bash
# In Supabase Dashboard > Settings > Edge Functions
FCM_SERVER_KEY=your_fcm_server_key_here
```

### 3. **Run the SQL Migration**
Run the SQL migration in your Supabase SQL editor to create the `user_tokens` table.

### 4. **Deploy the Edge Function**
Deploy the push notification Edge Function to Supabase:

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the function
supabase functions deploy send-push-notification
```

### 5. **Build and Test**
```bash
# Build your app
npm run build

# Sync with Capacitor
npx cap sync

# Open in Android Studio
npx cap open android
```

## 📱 How It Works:

1. **App starts** → Capacitor registers for push notifications
2. **FCM token generated** → Stored in Supabase `user_tokens` table
3. **Message sent** → Supabase Edge Function sends push notification via FCM
4. **User receives notification** → Even when app is closed!

## 🔧 Testing:

1. **Install APK** on Android device
2. **Send a message** from another user
3. **Close the app** completely
4. **You should receive push notification!**

## 🐛 Troubleshooting:

- **No notifications?** Check FCM server key is correct
- **Token not stored?** Check Supabase RLS policies
- **Function errors?** Check Supabase Edge Function logs

Your push notifications should now work when the app is closed! 🎉

