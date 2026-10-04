"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Check, LockKeyhole, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage(){
 const[fullName,setFullName]=useState("");const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[message,setMessage]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 async function submit(event:FormEvent){event.preventDefault();const supabase=createClient();if(!supabase){setError("Supabase is not configured");return}setBusy(true);setError("");const{error:signUpError}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:`${window.location.origin}/auth/callback`}});setBusy(false);if(signUpError)setError(signUpError.message);else setMessage("Check your email to confirm your account. A Dean must assign your room before a QR code is available.")}
 return <main className="register-page"><form className="register-card" onSubmit={submit}><div className="login-seal">K</div><span>KINGSWAY COLLEGE</span><h1>Create your account</h1><p>Use your school address or a personal email approved by the residence office.</p>{message?<div className="register-success"><Check/><p>{message}</p><Link href="/">Return to sign in</Link></div>:<><label>Full name<div><User/><input required value={fullName} onChange={e=>setFullName(e.target.value)}/></div></label><label>Email address<div><Mail/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div></label><label>Password<div><LockKeyhole/><input required minLength={12} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div><small>At least 12 characters</small></label>{error&&<div className="live-alert error">{error}</div>}<button className="sign-in" disabled={busy}>{busy?"Creating account…":"Create account"}</button><Link className="register-back" href="/">Already registered? Sign in</Link></>}</form></main>
}
