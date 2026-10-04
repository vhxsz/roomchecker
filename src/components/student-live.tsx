"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, DoorOpen, LoaderCircle, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { authFetch } from "@/lib/auth-fetch";
import { createClient } from "@/lib/supabase/client";

type Profile={full_name:string;student_code:string;grade:string|null};

export function StudentLive({onLogout}:{onLogout:()=>Promise<void>}){
 const[profile,setProfile]=useState<Profile|null>(null);const[token,setToken]=useState("");const[room,setRoom]=useState("—");const[seconds,setSeconds]=useState(0);const[error,setError]=useState("");const[help,setHelp]=useState(false);
 const refresh=useCallback(async()=>{try{const supabase=createClient();if(!supabase)throw new Error("Supabase is not configured");const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Your session has expired");const[{data:p},qr]=await Promise.all([supabase.from("profiles").select("full_name,student_code,grade").eq("id",user.id).single(),authFetch("/api/student/qr")]);setProfile(p);setToken(qr.token);setRoom(qr.roomNumber);setSeconds(Math.max(0,qr.expiresAt-Math.floor(Date.now()/1000)));setError("")}catch(e){setError(e instanceof Error?e.message:"QR code is unavailable")}},[]);
 useEffect(()=>{queueMicrotask(refresh);const timer=setInterval(()=>setSeconds(value=>{if(value<=1){void refresh();return 30}return value-1}),1000);return()=>clearInterval(timer)},[refresh]);
 if(!profile&&!error)return <div className="student-live"><div className="live-loading"><LoaderCircle/><p>Preparing your secure QR code…</p></div></div>;
 return <main className="student-live"><header><div className="brand compact"><span className="crest">K</span><div><strong>Kingsway</strong><small>Room Check</small></div></div><button onClick={onLogout}><LogOut/></button></header><section className="student-live-intro"><span>NIGHT ROOM CHECK</span><h1>Good evening, {profile?.full_name.split(" ")[0]||"student"}</h1><p>Show this rotating code to the checker in your assigned room.</p></section><section className="student-live-card">{error?<div className="student-qr-error"><ShieldCheck/><h2>QR code unavailable</h2><p>{error}</p><button onClick={refresh}>Try again</button></div>:<><div className="student-qr-top"><span><i/> READY TO SCAN</span><b>Room {room}</b></div><div className="student-qr"><QRCodeCanvas value={token} size={235} bgColor="#ffffff" fgColor="#073f35" level="H"/></div><h2>{profile?.full_name}</h2><p>{profile?.student_code} · {profile?.grade||"Student"}</p><div className="student-timer"><Clock3/><span>Code refreshes in</span><b>00:{String(seconds).padStart(2,"0")}</b></div></>}</section><section className="student-assignment"><DoorOpen/><div><span>YOUR ASSIGNED ROOM</span><strong>Room {room}</strong></div></section><button className="student-help" onClick={()=>setHelp(!help)}><Smartphone/><div><strong>Phone unavailable?</strong><span>Your checker can submit a photo exception.</span></div></button>{help&&<div className="student-help-note">Stay in your assigned room and ask your checker to use “No phone.” The Dean must approve the photo before your attendance is confirmed.</div>}<footer>Never share or screenshot this code. It expires automatically.</footer></main>
}
