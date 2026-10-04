import { createClient } from "@/lib/supabase/client";

export async function authFetch(input: string, init: RequestInit = {}) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(input, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed");
  return data;
}
