## Yuhu Mobile (Expo SDK 54)

This is a fresh Expo SDK **54** React Native app that will be wired to your existing **Supabase** backend.

### 1. Logo / assets

- Copy your web logo from `yuhu/public/images/Logo2.png` into the mobile app:
  - Create `mobile/assets/` if it does not exist.
  - Save the logo as `mobile/assets/icon.png`.
  - (Optional) also save a larger splash image as `mobile/assets/splash.png` or reuse the same file.

The `app.json` is already configured to use `./assets/icon.png` and `./assets/splash.png`.

### 2. Supabase configuration

`mobile/app.json` has:

```json
"extra": {
  "supabaseUrl": "https://awazxytwuhmsyogfdrho.supabase.co",
  "supabaseAnonKey": "<your anon key>"
}
```

and `src/lib/supabase.ts` reads these values to create the Supabase client with persisted auth.

### 3. Install dependencies and run

From the repo root:

```bash
cd mobile
npm install
npm start
```

Then open the project in **Expo Go** (SDK 54) by scanning the QR code.

Once this shell is running reliably, we can plug in your existing auth and chat UI on top of it.

## Yuhu Mobile (Expo + Supabase)

This is the native mobile client for Yuhu, built with **Expo (React Native + TypeScript)** and reusing the existing **Supabase** project (auth, DB, Realtime, Edge Functions).

### 1. Configure Supabase

- Open `mobile/app.json` and set:
  - `expo.extra.supabaseUrl` to your project URL
  - `expo.extra.supabaseAnonKey` to your public anon key

These should match the values used in the existing web app.

### 2. Install dependencies

From the repo root:

```bash
cd mobile
npm install
```

### 3. Run the app

```bash
npm start
```

Then open on a simulator or device with the Expo Go app.

### 4. Push notifications

The mobile app:

- Uses `expo-notifications` to get the **native device push token** via `getDevicePushTokenAsync`.
- Stores that token in the existing Supabase `user_tokens` table (`fcm_token` column, `platform` = `ios`/`android`).
- Expects the existing Supabase Edge Function `send-push-notification` to deliver pushes using FCM to those tokens.

To ensure notifications work when the app is closed and deep-link into chats:

- Configure FCM/APNs credentials for your Expo project (via EAS or native config).
- Make sure your backend triggers `send-push-notification` on new messages, passing:
  - `toUserId`: recipient `auth.users.id`
  - `title`, `body`
  - `data.chatId`: the target chat ID (the app will route to `/chat/[id]`).

