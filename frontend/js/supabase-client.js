/**
 * supabase-client.js — Supabase Client Initialization
 *
 * Creates the Supabase client using supabase-js CDN.
 * Used ONLY for authentication (login, logout, session).
 * All data operations go through Edge Functions via api.js.
 */

// The supabase global comes from the CDN script tag in HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

