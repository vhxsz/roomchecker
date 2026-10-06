"use client";
import {useState} from "react";
import {ShieldCheck} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {DemoPreview} from "@/components/demo-preview";

export default function Home(){
 const[role,setRole]=useState<"student"|"staff">("student"),[error,setError]=useState(""),[busy,setBusy]=useState(false),[demo,setDemo]=useState<"student"|"checker"|"dean"|null>(null);
 async function signIn(){
  const supabase=createClient();
  if(!supabase){setError("Authentication is not configured yet.");return;}
  setBusy(true);setError("");
  try{
   const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback`,queryParams:{hd:"kingsway.college",prompt:"select_account"}}});
   if(error)throw error;
  }catch(e){setError(e instanceof Error?e.message:"Could not start Google sign-in.");setBusy(false);}
 }
 if(demo)return <DemoPreview role={demo} close={()=>setDemo(null)}/>;
 return <main className="login-page"><section className="login-brand"><div className="login-seal">K</div><span>KINGSWAY COLLEGE</span><h1>Every student.<br/>Safely accounted for.</h1><p>A secure, simple way to complete residence room checks — with real-time verification and clear accountability.</p><div className="trust"><ShieldCheck/><div><strong>Built for student safety</strong><small>School Google accounts · Role-based access · Private records</small></div></div></section><section className="login-panel"><div className="login-card"><div className="mobile-brand"><span className="crest">K</span><strong>Kingsway Room Check</strong></div><h2>Welcome to Room Check</h2><p>Sign in with your school Google account.</p><div className="role-tabs"><button type="button" className={role==="student"?"active":""} onClick={()=>setRole("student")}>Student</button><button type="button" className={role==="staff"?"active":""} onClick={()=>setRole("staff")}>Staff &amp; Dean</button></div><button className="google-btn" disabled={busy} onClick={signIn}><b>G</b>{busy?"Connecting to Google…":"Continue with school Google"}</button><p className="school-login-note">Only <strong>@kingsway.college</strong> accounts are accepted. Your student account is created automatically on your first sign-in. A Dean assigns your room and staff permissions.</p>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="demo-access"><span>Preview the system — no real account required</span><div><button onClick={()=>setDemo("student")}>Student demo</button><button onClick={()=>setDemo("checker")}>Checker demo</button><button onClick={()=>setDemo("dean")}>Dean demo</button></div></div><small className="privacy">By continuing, you agree to the school&apos;s Acceptable Use and Privacy policies.</small></div></section></main>;
}
