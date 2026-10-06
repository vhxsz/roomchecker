"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { completeAuthLink } from "@/lib/auth-callback";
import {isSchoolGoogleSession,SCHOOL_SIGN_IN_MESSAGE} from "@/lib/school-auth";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing your secure sign-in…");
  const started=useRef(false);

  useEffect(() => {
    if(started.current)return;
    started.current=true;
    async function completeSignIn() {
     try {
      const supabase = createClient();
      if(!supabase)throw new Error("Supabase is not configured");
      const {user}=await completeAuthLink(supabase,new URL(window.location.href));
      const{data:{session}}=await supabase.auth.getSession();
      window.history.replaceState(null,"","/auth/callback");
      if(!session||!isSchoolGoogleSession(user,session.access_token)){await supabase.auth.signOut();throw new Error(SCHOOL_SIGN_IN_MESSAGE);}
      const { data: profile,error } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if(error||!profile)throw new Error("Your residence profile is unavailable. Contact the Dean.");
      window.location.replace(profile?.role === "dean" ? "/admin" : profile?.role === "checker" ? "/checker" : "/student");
     }catch(e){setMessage(e instanceof Error?e.message:"Could not complete sign-in.");}
    }
    completeSignIn();
  }, []);

  return <main className="callback-page"><div className="login-seal">K</div><h1>Kingsway Room Check</h1><p>{message}</p><Link href="/">Return to sign in</Link></main>;
}
