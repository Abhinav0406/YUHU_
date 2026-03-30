# Setting Up a New Firebase Project for Push Notifications

**Yes, creating a new Firebase project is perfectly fine!** Here's what you need to do:

## Step 1: Create New Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name (e.g., `Yuhu Mobile`)
4. Follow the setup wizard
5. **Skip Google Analytics** (optional)

## Step 2: Add Android App

1. In Firebase project, click **Android icon** (or "Add app")
2. **Android package name**: `com.yuhu.app` (must match your app.json)
3. **App nickname**: `Yuhu Android` (optional)
4. Click **"Register app"**
5. **Download `google-services.json`**
6. **Replace** the existing file: `mobile/google-services.json`

## Step 3: Get FCM Server Key

1. In Firebase Console → **Project Settings** (gear icon)
2. Go to **"Cloud Messaging"** tab
3. Find **"Server key"** (or "Legacy server key")
4. **Copy this key** - you'll need it for Supabase

## Step 4: Update Supabase Secrets

1. Go to Supabase Dashboard → **Edge Functions → Secrets**
2. Update or add:
   - **Name**: `FCM_SERVER_KEY`
   - **Value**: Paste your new Firebase Server Key
3. Click **"Save"**

## Step 5: Rebuild Your App

Since you changed `google-services.json`, you need to rebuild:

```bash
cd mobile
eas build --platform android --profile production
```

## Step 6: Test

1. Install the new APK on your device
2. Login to the app (this will register for push notifications)
3. Check Supabase `user_tokens` table - should see FCM token saved
4. Send a message from another device
5. Check Edge Function logs - should see function being called

---

## Why No Logs Appear?

**Possible reasons:**

1. **Function not deployed** - Make sure `send-push-notification` is deployed in Supabase
2. **Function not being called** - Check device logs for `📤 Calling Edge Function...`
3. **Wrong logs location** - Go to: Supabase Dashboard → Edge Functions → `send-push-notification` → **"Logs"** tab
4. **Function erroring immediately** - Check if function exists and is deployed correctly

**To debug:**
- Check your device console logs (via `adb logcat` or Expo logs)
- Look for messages starting with `📤` or `❌`
- Check Supabase Edge Functions → Logs after sending a message

---

## Quick Test

After deploying the Edge Function, you can test it manually:

1. Go to Supabase Dashboard → Edge Functions → `send-push-notification`
2. Click **"Invoke"** button
3. Use this test payload:
```json
{
  "toUserId": "your-test-user-id",
  "title": "Test Notification",
  "body": "This is a test",
  "data": {
    "chatId": "test-chat-id"
  }
}
```

This will help you see if the function works and generates logs.
