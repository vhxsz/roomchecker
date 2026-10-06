"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {isSchoolGoogleSession} from "@/lib/school-auth";

type Role = "dean" | "checker" | "student";

export function RoleGate({ allowed, children }: { allowed: Role[]; children: (logout: () => Promise<void>) => ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "setup">("loading");

  useEffect(() => {
    async function validate() {
      const supabase = createClient();
      if (!supabase) { setState("setup"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.replace("/"); return; }
      const{data:{session}}=await supabase.auth.getSession();
      if(!session||!isSchoolGoogleSession(user,session.access_token)){await supabase.auth.signOut();setState("denied");return;}
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setState(profile && allowed.includes(profile.role) ? "allowed" : "denied");
    }
    validate();
  }, [allowed]);

  async function logout() {
    await createClient()?.auth.signOut();
    window.location.replace("/");
  }

  if (state === "allowed") return children(logout);
  return <main className="access-state"><div className="login-seal">K</div><h1>{state === "loading" ? "Checking access…" : state === "setup" ? "Setup required" : "Access restricted"}</h1><p>{state === "setup" ? "Add the Supabase publishable key to enable secure sign-in." : state === "denied" ? "Your account does not have permission to open this area." : "Verifying your Kingsway account."}</p>{state !== "loading"&&<a href="/">Return to sign in</a>}</main>;
}
