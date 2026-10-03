import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.TEST_USERS_PASSWORD;

if (!url || !serviceRole || !password || password.length < 12) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a TEST_USERS_PASSWORD of at least 12 characters.");
}

const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [
  { email: "dean@kingsway.college", role: "dean", full_name: "Daniel Morgan" },
  { email: "checker@kingsway.college", role: "checker", full_name: "Sarah Collins" },
  { email: "student@kingsway.college", role: "student", full_name: "Mateo Silva" },
];

for (const account of users) {
  const { data: created, error } = await supabase.auth.admin.createUser({ email: account.email, password, email_confirm: true, user_metadata: { full_name: account.full_name } });
  let user = created.user;
  if (error?.message.includes("already been registered")) {
    const { data } = await supabase.auth.admin.listUsers();
    user = data.users.find((candidate) => candidate.email === account.email) ?? null;
  } else if (error) throw error;
  if (!user) throw new Error(`Could not resolve ${account.email}`);
  const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, email: account.email, full_name: account.full_name, role: account.role }, { onConflict: "id" });
  if (profileError) throw profileError;
  console.log(`Ready: ${account.email} (${account.role})`);
}
