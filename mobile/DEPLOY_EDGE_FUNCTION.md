# Deploy send-push-notification Edge Function

## Step 1: Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate.

## Step 3: Link to your project

```bash
cd yuhu
supabase link --project-ref awazxytwuhmsyogfdrho
```

## Step 4: Deploy the Edge Function

```bash
supabase functions deploy send-push-notification
```

## Step 5: Verify Deployment

1. Go to Supabase Dashboard → Edge Functions
2. You should see `send-push-notification` listed
3. Click on it to see logs and details

---

## Option 2: Deploy via Supabase Dashboard Editor

1. Go to Supabase Dashboard → Edge Functions
2. Click **"Deploy a new function"** or **"Open Editor"**
3. Create a new function named: `send-push-notification`
4. Copy the code from `yuhu/supabase/functions/send-push-notification/index.ts`
5. Paste it into the editor
6. Click **"Deploy"**

---

## Important: Set FCM_SERVER_KEY Secret

After deploying, make sure the secret is set:

1. Go to Supabase Dashboard → Edge Functions → **Secrets**
2. Add/verify this secret:
   - **Name**: `FCM_SERVER_KEY`
   - **Value**: Your Firebase Server Key (from Firebase Console → Project Settings → Cloud Messaging)

---

## Test the Function

After deployment, you can test it from your mobile app by sending a message. Check the Edge Function logs to see if it's being called and if there are any errors.
