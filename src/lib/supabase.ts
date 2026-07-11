import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-side Supabase client using the service role key.
 * This bypasses RLS — only use in API routes, never expose to the client.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
