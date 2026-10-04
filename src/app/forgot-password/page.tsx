"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Check, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) { setError("Supabase is not configured"); return; }
    setBusy(true); setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setMessage("If this email belongs to an account, a secure reset link is on its way.");
  }

  return <main className="register-page"><form className="register-card" onSubmit={submit}><div className="login-seal">K</div><span>KINGSWAY COLLEGE</span><h1>Reset your password</h1><p>Enter your account email and we will send you a secure reset link.</p>{message?<div className="register-success"><Check/><p>{message}</p><Link href="/">Return to sign in</Link></div>:<><label>Email address<div><Mail/><input required type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)}/></div></label>{error&&<div className="live-alert error">{error}</div>}<button className="sign-in" disabled={busy}>{busy?"Sending…":"Send reset link"}</button><Link className="register-back" href="/">Return to sign in</Link></>}</form></main>;
}
