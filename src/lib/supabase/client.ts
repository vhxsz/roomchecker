import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Callback pages explicitly consume PKCE codes, invite hashes and OTP links.
  // Auto-consuming here can exchange the same one-time code twice.
  return createBrowserClient(url, key, {auth:{detectSessionInUrl:false}});
}
