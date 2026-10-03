"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing your secure sign-in…");

  useEffect(() => {
    async function completeSignIn() {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get("code");
      if (!supabase || !code) {
        setMessage("This sign-in link is incomplete. Please return to the login page.");
        return;
      }
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.user) {
        setMessage(error?.message ?? "We could not complete your sign-in.");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      window.location.replace(profile?.role === "dean" ? "/admin" : profile?.role === "checker" ? "/checker" : "/student");
    }
    completeSignIn();
  }, []);

  return <main className="callback-page"><div className="login-seal">K</div><h1>Kingsway Room Check</h1><p>{message}</p><Link href="/">Return to sign in</Link></main>;
}
