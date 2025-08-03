import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, token: googleToken, refresh_token, event_data, timeMin, timeMax, timeZone, event_id } = await req.json()

    // Function to refresh Google token
    async function refreshGoogleToken(refreshToken: string) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
        token_type: data.token_type
      }
    }

    // Function to check if token is expired
    function isTokenExpired(token: string): boolean {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const currentTime = Math.floor(Date.now() / 1000)
        return payload.exp < currentTime
      } catch {
        return true // Assume expired if we can't decode
      }
    }

    // Function to get valid token (with automatic refresh)
    async function getValidToken(userId: string) {
      // First try to get from google_auth_tokens (user-specific)
      let { data: userTokens, error: userError } = await supabase
        .from('google_auth_tokens')
        .select('token, refresh_token')
        .eq('user_id', userId)
        .single()

      if (userError || !userTokens?.token) {
        // Fallback to global tokens
        const { data: globalTokens, error: globalError } = await supabase
          .from('google_calendar_tokens')
          .select('token, refresh_token')
          .eq('id', 1)
          .single()

        if (globalError || !globalTokens?.token) {
          throw new Error('No tokens found')
        }

        userTokens = globalTokens
      }

      // Check if token is expired
      if (isTokenExpired(userTokens.token)) {
        console.log('Token expired, refreshing...')
        
        if (!userTokens.refresh_token) {
          throw new Error('REAUTH_REQUIRED')
        }

        // Refresh the token
        const newTokens = await refreshGoogleToken(userTokens.refresh_token)
        
        // Update in database
        if (userId) {
          await supabase
            .from('google_auth_tokens')
            .upsert({
              user_id: userId,
              token: newTokens.access_token,
              refresh_token: userTokens.refresh_token,
              updated_at: new Date().toISOString()
            })
        } else {
          await supabase
            .from('google_calendar_tokens')
            .update({
              token: newTokens.access_token,
              updated_at: new Date().toISOString()
            })
            .eq('id', 1)
        }

        return newTokens.access_token
      }

      return userTokens.token
    }

    switch (action) {
      case 'store':
        if (googleToken === null && refresh_token === null) {
          // Delete tokens
          await supabase
            .from('google_auth_tokens')
            .delete()
            .eq('user_id', user.id)
          
          await supabase
            .from('google_calendar_tokens')
            .update({
              token: null,
              refresh_token: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', 1)

          return new Response(
            JSON.stringify({ success: true, message: 'Tokens deleted' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Store tokens
        const { error: storeError } = await supabase
          .from('google_auth_tokens')
          .upsert({
            user_id: user.id,
            token: googleToken,
            refresh_token: refresh_token,
            updated_at: new Date().toISOString()
          })

        if (storeError) {
          throw new Error(`Failed to store tokens: ${storeError.message}`)
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Tokens stored successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'retrieve':
        try {
          const validToken = await getValidToken(user.id)
          return new Response(
            JSON.stringify({ token: validToken }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          if (error.message === 'REAUTH_REQUIRED') {
            return new Response(
              JSON.stringify({ error: 'REAUTH_REQUIRED' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw error
        }

      case 'check_token_status':
        try {
          const validToken = await getValidToken(user.id)
          return new Response(
            JSON.stringify({ status: 'valid', token: validToken }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          if (error.message === 'REAUTH_REQUIRED') {
            return new Response(
              JSON.stringify({ status: 'reauth_required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ status: 'error', error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'get_events':
        try {
          const validToken = await getValidToken(user.id)
          
          const calendarResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&timeZone=${timeZone}`,
            {
              headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json',
              },
            }
          )

          if (!calendarResponse.ok) {
            if (calendarResponse.status === 401) {
              return new Response(
                JSON.stringify({ error: 'ADMIN_REAUTH_REQUIRED' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            throw new Error(`Calendar API error: ${calendarResponse.statusText}`)
          }

          const events = await calendarResponse.json()
          return new Response(
            JSON.stringify(events),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          if (error.message === 'REAUTH_REQUIRED' || error.message === 'ADMIN_REAUTH_REQUIRED') {
            return new Response(
              JSON.stringify({ error: 'ADMIN_REAUTH_REQUIRED' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw error
        }

             case 'create_event':
         try {
           const validToken = await getValidToken(user.id)
           
           const calendarResponse = await fetch(
             'https://www.googleapis.com/calendar/v3/calendars/primary/events',
             {
               method: 'POST',
               headers: {
                 'Authorization': `Bearer ${validToken}`,
                 'Content-Type': 'application/json',
               },
               body: JSON.stringify(event_data),
             }
           )

           if (!calendarResponse.ok) {
             if (calendarResponse.status === 401) {
               return new Response(
                 JSON.stringify({ error: 'ADMIN_REAUTH_REQUIRED' }),
                 { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
               )
             }
             throw new Error(`Calendar API error: ${calendarResponse.statusText}`)
           }

           const event = await calendarResponse.json()
           return new Response(
             JSON.stringify(event),
             { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           )
         } catch (error) {
           if (error.message === 'REAUTH_REQUIRED' || error.message === 'ADMIN_REAUTH_REQUIRED') {
             return new Response(
               JSON.stringify({ error: 'ADMIN_REAUTH_REQUIRED' }),
               { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
             )
           }
           throw error
         }

       case 'delete_event':
         try {
           const validToken = await getValidToken(user.id)
           
           const calendarResponse = await fetch(
             `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`,
             {
               method: 'DELETE',
               headers: {
                 'Authorization': `Bearer ${validToken}`,
                 'Content-Type': 'application/json',
               },
             }
           )

           if (!calendarResponse.ok) {
             if (calendarResponse.status === 401) {
               return new Response(
                 JSON.stringify({ error: 'ADMIN_REAUTH_REQUIRED' }),
                 { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
               )
             }
             if (calendarResponse.status === 404) {
               return new Response(
                 JSON.stringify({ success: true, message: 'Event already deleted' }),
                 { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
               )
             }
             throw new Error(`Calendar API error: ${calendarResponse.statusText}`)
           }

           return new Response(
             JSON.stringify({ success: true, message: 'Event deleted successfully' }),
             { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           )
         } catch (error) {
           if (error.message === 'REAUTH_REQUIRED' || error.message === 'ADMIN_REAUTH_REQUIRED') {
             return new Response(
               JSON.stringify({ error: 'ADMIN_REAUTH_REQUIRED' }),
               { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
             )
           }
           throw error
         }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 