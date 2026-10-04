"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const supabase = createClient();
      if (!supabase) { setError("Supabase is not configured"); return; }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { setError(exchangeError.message); return; }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setError("This reset link is invalid or has expired."); return; }
      setReady(true);
    }
    void establishSession();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else { await supabase.auth.signOut(); setMessage("Your password has been updated. You can now sign in."); }
  }

  return <main className="register-page"><form className="register-card" onSubmit={submit}><div className="login-seal">K</div><span>KINGSWAY COLLEGE</span><h1>Choose a new password</h1><p>Use at least 12 characters and do not reuse a school password.</p>{message?<div className="register-success"><Check/><p>{message}</p><Link href="/">Sign in</Link></div>:<><label>New password<div><LockKeyhole/><input required disabled={!ready} minLength={12} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)}/></div></label>{error&&<div className="live-alert error">{error}</div>}<button className="sign-in" disabled={!ready||busy}>{busy?"Updating…":ready?"Update password":"Validating link…"}</button><Link className="register-back" href="/">Return to sign in</Link></>}</form></main>;
}
