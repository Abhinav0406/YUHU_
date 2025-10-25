import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationRequest {
  toUserId: string
  title: string
  body: string
  data?: any
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { toUserId, title, body, data }: PushNotificationRequest = await req.json()

    // Get the FCM token for the recipient user
    const { data: userToken, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('fcm_token')
      .eq('user_id', toUserId)
      .single()

    if (tokenError || !userToken?.fcm_token) {
      console.error('No FCM token found for user:', toUserId)
      return new Response(
        JSON.stringify({ error: 'No FCM token found for user' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send push notification using FCM
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userToken.fcm_token,
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          sound: 'default',
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
      }),
    })

    if (!fcmResponse.ok) {
      const errorText = await fcmResponse.text()
      console.error('FCM error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send push notification' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const fcmResult = await fcmResponse.json()
    console.log('Push notification sent successfully:', fcmResult)

    return new Response(
      JSON.stringify({ success: true, messageId: fcmResult.message_id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

