import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase server credentials are not configured");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireUser(request: Request, roles?: Array<"dean" | "checker" | "student">) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Missing access token", status: 401 } as const;
  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "Invalid or expired access token", status: 401 } as const;
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, student_code").eq("id", user.id).single();
  if (!profile) return { error: "User profile not found", status: 403 } as const;
  if (roles && !roles.includes(profile.role)) return { error: "Insufficient permissions", status: 403 } as const;
  return { user, profile, supabase } as const;
}
