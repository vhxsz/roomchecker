"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, prefer-const */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Building2, Camera, Check, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, DoorOpen, Download, LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, MoreHorizontal, Plus, QrCode, ScanLine, Search, Settings, ShieldCheck, Smartphone, UserMinus, Users, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { rooms, sessions, students } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";

const nav = [["Overview", LayoutDashboard], ["Live room check", ClipboardCheck], ["Students", Users], ["Rooms & floors", DoorOpen], ["Reports", Building2], ["Settings", Settings]] as const;
const floors = [
  { name: "North Hall · Floor 1", done: 24, total: 26, color: "#0e6b4f" },
  { name: "North Hall · Floor 2", done: 21, total: 24, color: "#0e6b4f" },
  { name: "South Hall · Floor 1", done: 18, total: 23, color: "#d6932a" },
  { name: "South Hall · Floor 2", done: 14, total: 25, color: "#c34b46" },
];

export default function Home() {
  const [demo, setDemo] = useState<"dean"|"checker"|"student"|null>(null);
  const [role, setRole] = useState<"student"|"staff">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function signInWithEmail() {
    const supabase = createClient();
    if (!supabase) {
      setAuthError("Supabase authentication is not configured yet. Use a demo account below.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setAuthError(error?.message ?? "We could not sign you in.");
      setAuthLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    window.location.assign(profile?.role === "dean" ? "/admin" : profile?.role === "checker" ? "/checker" : "/student");
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    if (!supabase) {
      setAuthError("Supabase authentication is not configured yet. Use a demo account below.");
      return;
    }
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setAuthError(error.message);
  }

  if (demo === "dean") return <DeanDashboard onLogout={() => setDemo(null)}/>;
  if (demo === "checker") return <CheckerPortal onLogout={() => setDemo(null)}/>;
  if (demo === "student") return <StudentPortal onLogout={() => setDemo(null)}/>;
  return <main className="login-page"><section className="login-brand"><div className="login-seal">K</div><span>KINGSWAY COLLEGE</span><h1>Every student.<br/>Safely accounted for.</h1><p>A secure, simple way to complete residence room checks — with real-time verification and clear accountability.</p><div className="trust"><ShieldCheck/><div><strong>Built for student safety</strong><small>Private records · Role-based access · Complete audit trail</small></div></div></section><section className="login-panel"><div className="login-card"><div className="mobile-brand"><span className="crest">K</span><strong>Kingsway Room Check</strong></div><h2>Welcome back</h2><p>Sign in to continue to Room Check.</p><div className="role-tabs"><button className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>Student</button><button className={role === "staff" ? "active" : ""} onClick={() => setRole("staff")}>Staff & Dean</button></div><button className="google-btn" onClick={signInWithGoogle}><b>G</b>Continue with Google</button><div className="or"><span/>or use your email<span/></div><label className="form-label">Email address<div className="input-wrap"><Mail size={18}/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={role === "student" ? "student@kingsway.college" : "staff@kingsway.college"}/></div></label><label className="form-label">Password<div className="input-wrap"><LockKeyhole size={18}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password"/></div></label><div className="forgot"><label><input type="checkbox"/> Remember me</label><Link href="/forgot-password">Forgot password?</Link></div>{authError&&<p className="auth-error">{authError}</p>}<button className="sign-in" onClick={signInWithEmail} disabled={authLoading}>{authLoading ? "Signing in…" : "Sign in"}</button>{role==="student"&&<p className="register-prompt">New student? <Link href="/register">Create your account</Link></p>}<div className="demo-access"><span>Preview the complete system</span><div><button onClick={() => setDemo("student")}>Student demo</button><button onClick={() => setDemo("checker")}>Checker demo</button><button onClick={() => setDemo("dean")}>Dean demo</button></div></div><small className="privacy">By continuing, you agree to the school&apos;s Acceptable Use and Privacy policies.</small></div></section></main>;
}

export function DeanDashboard({onLogout}:{onLogout?:()=>void}) {
  const [active, setActive] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <main className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand"><span className="crest">K</span><div><strong>Kingsway</strong><small>Room Check</small></div></div>
        <nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => { setActive(label); setMobileNav(false); }}><Icon size={19}/><span>{label}</span></button>)}</nav>
        <div className="side-user"><div className="avatar">DM</div><div><strong>Daniel Morgan</strong><span>Dean · Administrator</span></div><button className="logout-plain" onClick={onLogout}><LogOut size={18}/></button></div>
      </aside>
      <section className="content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><Menu/></button>
          <div><h1>Good evening, Daniel</h1><p>Friday, October 2 · Evening duty</p></div>
          <div className="top-actions"><label><Search size={18}/><input placeholder="Search students or rooms"/></label><button className="icon-btn"><Bell size={19}/><i/></button><button className="profile">DM <ChevronDown size={15}/></button></div>
        </header>
        {active === "Overview" ? <><div className="live-banner">
          <div className="live-icon"><QrCode size={24}/></div><div><span className="eyebrow">ROOM CHECK IN PROGRESS</span><h2>Night Check · 10:00 PM</h2><p>58 of 98 students verified across 4 floors</p></div>
          <div className="banner-progress"><div><span>59%</span><small>complete</small></div><div className="progress"><i style={{width:"59%"}}/></div></div><button>Open live check</button>
        </div>
        <div className="section-title"><div><h2>Tonight at a glance</h2><p>Live attendance across all residence halls</p></div><button className="date-select">Tonight, Oct 2 <ChevronDown size={16}/></button></div>
        <div className="stats"><Stat title="Students verified" value="58" meta="of 98 expected" tone="green"/><Stat title="Still pending" value="36" meta="across 21 rooms" tone="gold"/><Stat title="Photo exceptions" value="4" meta="awaiting review" tone="blue"/><Stat title="Accuracy this week" value="96.4%" meta="↑ 2.1% from last week" tone="purple"/></div>
        <div className="dashboard-grid">
          <section className="panel floors-panel"><div className="panel-head"><div><h3>Floor progress</h3><p>Night Check · updates live</p></div><button>View all</button></div><div className="floor-list">{floors.map((floor) => { const pct=Math.round(floor.done/floor.total*100); return <div className="floor-row" key={floor.name}><div className="floor-icon"><Building2 size={20}/></div><div className="floor-main"><div><strong>{floor.name}</strong><span>{floor.done} / {floor.total} verified</span></div><div className="thin-progress"><i style={{width:`${pct}%`,background:floor.color}}/></div></div><b style={{color:floor.color}}>{pct}%</b></div>})}</div></section>
          <section className="panel attention"><div className="panel-head"><div><h3>Needs attention</h3><p>Exceptions from tonight</p></div><span className="count">6</span></div><div className="attention-list"><Attention room="N-214" name="Mateo Silva" type="Photo submitted" initials="MS"/><Attention room="S-108" name="Liam Chen" type="No phone · review" initials="LC"/><Attention room="S-221" name="Amara Okafor" type="Not yet verified" initials="AO"/></div><button className="full-link">Review all exceptions</button></section>
        </div></> : <DeanSection active={active}/>} 
      </section>
    </main>
  );
}
function Stat({title,value,meta,tone}:{title:string;value:string;meta:string;tone:string}) { return <div className="stat-card"><span className={`stat-dot ${tone}`}/><p>{title}</p><strong>{value}</strong><small>{meta}</small></div> }
function Attention({room,name,type,initials}:{room:string;name:string;type:string;initials:string}) { return <div className="attention-row"><div className="student-avatar">{initials}</div><div><strong>{name}</strong><span>{room} · {type}</span></div><button aria-label={`Review ${name}`}><CheckCircle2 size={18}/></button></div> }

function DeanSection({active}:{active:string}) {
  const [query,setQuery]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [toast,setToast]=useState("");
  if(active === "Students") return <div className="workspace"><div className="workspace-head"><div><span className="page-kicker">STUDENT DIRECTORY</span><h2>Students</h2><p>Manage profiles, school accounts and room assignments.</p></div><button className="primary-btn" onClick={()=>setShowModal(true)}><Plus size={17}/> Add student</button></div><div className="toolbar"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, ID, email or room"/></label><button>All grades <ChevronDown size={15}/></button><button>All floors <ChevronDown size={15}/></button><button><Download size={15}/> Export CSV</button></div><div className="data-card"><table><thead><tr><th>Student</th><th>Student ID</th><th>Grade</th><th>Nationality</th><th>Room</th><th>Status</th><th/></tr></thead><tbody>{students.filter(s=>`${s.name} ${s.email} ${s.room}`.toLowerCase().includes(query.toLowerCase())).map(s=><tr key={s.id}><td><div className="table-student"><span>{s.initials}</span><div><strong>{s.name}</strong><small>{s.email}</small></div></div></td><td>{s.id}</td><td>{s.grade}</td><td>{s.nationality}</td><td><b>{s.room}</b><small>{s.floor}</small></td><td><em className="status-pill active">Active</em></td><td><button className="dots"><MoreHorizontal/></button></td></tr>)}</tbody></table></div><p className="table-count">Showing {students.length} of 98 students</p>{showModal&&<Modal title="Add a student" onClose={()=>setShowModal(false)}><div className="form-grid"><label>Full name<input placeholder="Student's full name"/></label><label>School email<input placeholder="name@kingsway.college"/></label><label>Age<input type="number" placeholder="16"/></label><label>Grade<select><option>Grade 9</option><option>Grade 10</option><option>Grade 11</option><option>Grade 12</option></select></label><label>Nationality<input placeholder="e.g. Canadian"/></label><label>Assign room<select><option>Unassigned</option>{rooms.map(r=><option key={r.id}>{r.number}</option>)}</select></label></div><div className="modal-actions"><button onClick={()=>setShowModal(false)}>Cancel</button><button className="primary-btn" onClick={()=>{setShowModal(false);setToast("Student invitation created")}}>Create student</button></div></Modal>}{toast&&<div className="toast"><Check size={17}/>{toast}<button onClick={()=>setToast("")}><X size={15}/></button></div>}</div>;
  if(active === "Rooms & floors") return <div className="workspace"><div className="workspace-head"><div><span className="page-kicker">RESIDENCE SETUP</span><h2>Rooms & floors</h2><p>Assign students and staff to their residence locations.</p></div><button className="primary-btn"><Plus size={17}/> Add room</button></div><div className="floor-tabs"><button className="active">All floors <span>4</span></button><button>North Hall</button><button>South Hall</button></div><div className="rooms-grid">{rooms.map(room=><article className="room-card" key={room.id}><div className="room-top"><div><span>{room.hall} · {room.floor}</span><h3>Room {room.number}</h3></div><button><MoreHorizontal/></button></div><div className="occupancy"><span>{room.students.length} of {room.capacity} beds assigned</span><div><i style={{width:`${room.students.length/room.capacity*100}%`}}/></div></div><div className="room-students">{room.students.map((name,i)=><div key={name}><span>{name.split(" ").map(n=>n[0]).join("")}</span><strong>{name}</strong><button aria-label={`Remove ${name}`}><UserMinus size={16}/></button></div>)}{room.students.length<room.capacity&&<button className="add-bed"><Plus size={15}/> Assign a student</button>}</div><footer><Users size={15}/><span>Checker: {room.checker}</span></footer></article>)}</div></div>;
  if(active === "Live room check") return <div className="workspace"><div className="workspace-head"><div><span className="live-label"><i/> LIVE NOW</span><h2>Night Room Check</h2><p>October 2, 2026 · 10:00 PM–10:20 PM</p></div><div className="workspace-actions"><button>Close session</button><button className="primary-btn"><Plus/> Add note</button></div></div><div className="live-summary"><div><strong>58</strong><span>Verified</span></div><div><strong>36</strong><span>Pending</span></div><div><strong>4</strong><span>Photo review</span></div><div><strong>0</strong><span>Confirmed absent</span></div><div className="big-progress"><b>59%</b><span>Overall completion</span><div><i style={{width:"59%"}}/></div></div></div><div className="data-card live-table"><table><thead><tr><th>Floor</th><th>Assigned checker</th><th>Progress</th><th>Exceptions</th><th>Last update</th><th/></tr></thead><tbody>{[...new Set(rooms.map(r=>`${r.hall} · ${r.floor}`))].map((floor,i)=><tr key={floor}><td><b>{floor}</b><small>{i+5} rooms</small></td><td>Sarah Collins</td><td><div className="table-progress"><div><i style={{width:`${92-i*12}%`}}/></div><b>{92-i*12}%</b></div></td><td>{i===2?<em className="status-pill review">2 to review</em>:"—"}</td><td>{i+1} min ago</td><td><button className="ghost-btn">View floor</button></td></tr>)}</tbody></table></div></div>;
  if(active === "Reports") return <div className="workspace"><div className="workspace-head"><div><span className="page-kicker">ATTENDANCE ANALYTICS</span><h2>Reports</h2><p>Room check performance and exception trends.</p></div><button className="primary-btn"><Download size={17}/> Export report</button></div><div className="report-filters"><button>This week <ChevronDown/></button><button>All sessions <ChevronDown/></button><button>All floors <ChevronDown/></button></div><div className="stats report-stats"><Stat title="Checks completed" value="1,342" meta="of 1,392 expected" tone="green"/><Stat title="Verification rate" value="96.4%" meta="↑ 2.1% vs last week" tone="blue"/><Stat title="Photo exceptions" value="18" meta="1.3% of check-ins" tone="gold"/><Stat title="Confirmed absences" value="7" meta="0.5% of check-ins" tone="purple"/></div><div className="report-grid"><section className="panel"><div className="panel-head"><div><h3>Weekly verification rate</h3><p>Study Hall and Night Check combined</p></div></div><div className="bar-chart">{[94,97,95,98,96,99,96].map((n,i)=><div key={i}><span>{n}%</span><i style={{height:`${n-70}%`}}/><small>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i]}</small></div>)}</div></section><section className="panel"><div className="panel-head"><div><h3>Verification methods</h3><p>This week</p></div></div><div className="donut-wrap"><div className="donut"><span><b>1,342</b>checks</span></div><ul><li><i className="qr"/>QR scan <b>98.7%</b></li><li><i className="photo"/>Photo exception <b>1.3%</b></li></ul></div></section></div></div>;
  return <div className="workspace"><div className="workspace-head"><div><span className="page-kicker">SYSTEM CONFIGURATION</span><h2>Room check settings</h2><p>Configure recurring sessions, timing and verification rules.</p></div><button className="primary-btn"><Plus size={17}/> Add schedule</button></div><section className="settings-card"><h3>Recurring check schedules</h3><p>Active schedules automatically appear for assigned checkers.</p>{sessions.map(s=><div className="schedule-row" key={s.id}><div className="schedule-icon"><Clock3/></div><div><strong>{s.name}</strong><span>{s.days}</span></div><b>{s.time}</b><label className="switch"><input defaultChecked={s.enabled} type="checkbox"/><span/></label><button><MoreHorizontal/></button></div>)}</section><section className="settings-card"><h3>Verification security</h3><p>Rules that keep each check-in accurate and auditable.</p><div className="setting-line"><div><strong>Rotating student QR codes</strong><span>Codes expire and refresh every 30 seconds.</span></div><label className="switch"><input type="checkbox" defaultChecked/><span/></label></div><div className="setting-line"><div><strong>Require Dean review for photo exceptions</strong><span>A photo never counts as verified until approved.</span></div><label className="switch"><input type="checkbox" defaultChecked/><span/></label></div><div className="setting-line"><div><strong>Room assignment validation</strong><span>Reject scans made for the wrong assigned room.</span></div><label className="switch"><input type="checkbox" defaultChecked/><span/></label></div></section></div>;
}

export function StudentPortal({onLogout}:{onLogout?:()=>void}) {
 const [seconds,setSeconds]=useState(24); const [help,setHelp]=useState(false); const [qrToken,setQrToken]=useState("kingsway://demo/KWC-2026-1042"); const [roomNumber,setRoomNumber]=useState("N-214");
 useEffect(()=>{let timer:ReturnType<typeof setInterval>; async function refresh(){const supabase=createClient();if(!supabase)return;const {data:{session}}=await supabase.auth.getSession();if(!session)return;const response=await fetch("/api/student/qr",{headers:{Authorization:`Bearer ${session.access_token}`}});if(!response.ok)return;const data=await response.json();setQrToken(data.token);setRoomNumber(data.roomNumber);setSeconds(Math.max(0,data.expiresAt-Math.floor(Date.now()/1000)))} refresh();timer=setInterval(()=>setSeconds(value=>{if(value<=1){refresh();return 30}return value-1}),1000);return()=>clearInterval(timer)},[]);
 return <main className="student-app"><header><div className="brand compact"><span className="crest">K</span><div><strong>Kingsway</strong><small>Room Check</small></div></div><button onClick={onLogout}><LogOut size={19}/></button></header><section className="student-hero"><span className="eyebrow">NIGHT ROOM CHECK</span><h1>Good evening, Mateo</h1><p>Your checker will scan this code in your assigned room.</p></section><section className="qr-card"><div className="qr-status"><span><i/> Ready to scan</span><b>Room {roomNumber}</b></div><div className="qr-frame"><QRCodeCanvas value={qrToken} size={230} bgColor="#ffffff" fgColor="#073f35" level="H"/><span className="corner a"/><span className="corner b"/><span className="corner c"/><span className="corner d"/></div><h2>Mateo Silva</h2><p>KWC-2026-1042 · Grade 12</p><div className="refresh"><Clock3 size={17}/><span>Code refreshes in</span><b>00:{String(seconds).padStart(2,"0")}</b></div></section><section className="student-room"><DoorOpen/><div><span>YOUR ASSIGNMENT</span><strong>North Hall · Room {roomNumber}</strong><small>2nd floor · with Liam Chen</small></div></section><button className="no-phone" onClick={()=>setHelp(!help)}><Smartphone/><span><b>Can&apos;t use your phone?</b><small>Your checker can verify you with a photo.</small></span><ChevronDown/></button>{help&&<div className="help-box">Tell your checker you need a photo exception. The Dean will review the photo before your attendance is confirmed.</div>}<footer>Your QR code is personal and changes frequently. Do not share screenshots.</footer></main>
}

export function CheckerPortal({onLogout}:{onLogout?:()=>void}) {
 const [scan,setScan]=useState(false); const [done,setDone]=useState<string[]>(["Noah Williams"]); const [photo,setPhoto]=useState(false);
 return <main className="checker-app"><header><button className="checker-menu"><Menu/></button><div className="brand compact"><span className="crest">K</span><div><strong>Kingsway</strong><small>Checker</small></div></div><button onClick={onLogout}><LogOut/></button></header><section className="checker-heading"><div><span className="live-label"><i/> IN PROGRESS</span><h1>South Hall · 1st floor</h1><p>Night Check · 10:00 PM</p></div><div className="checker-count"><b>{done.length}</b><span>of 4 verified</span></div></section><div className="checker-progress"><i style={{width:`${done.length/4*100}%`}}/></div><button className="scan-btn" onClick={()=>setScan(true)}><ScanLine/><span><b>Scan student QR</b><small>Point your camera at the student&apos;s screen</small></span></button><div className="room-checklist"><div className="checklist-head"><h2>Room checklist</h2><span>2 rooms</span></div>{rooms.filter(r=>r.hall==="South Hall"&&r.floor==="1st floor").concat([{...rooms[3],number:"S-110",floor:"1st floor",students:["Ava Martin","Oliver Brown"]}]).map(room=><article key={room.number}><header><div><DoorOpen/><strong>Room {room.number}</strong></div><span>{room.students.filter(n=>done.includes(n)).length}/{room.students.length}</span></header>{room.students.map(name=><div className="check-person" key={name}><span className={done.includes(name)?"verified":""}>{done.includes(name)?<Check/>:name.split(" ").map(n=>n[0]).join("")}</span><div><strong>{name}</strong><small>{done.includes(name)?"Verified by QR · 10:04 PM":"Waiting for verification"}</small></div>{!done.includes(name)&&<button onClick={()=>setPhoto(true)}><Camera/> No phone</button>}</div>)}</article>)}</div>{scan&&<Modal title="Scan student QR" onClose={()=>setScan(false)}><div className="scanner"><ScanLine size={84}/><div className="scan-corners"/><p>Hold the student&apos;s QR code inside the frame.</p></div><button className="primary-btn full" onClick={()=>{setDone([...done,"Ethan Park"]);setScan(false)}}>Simulate successful scan</button></Modal>}{photo&&<Modal title="Photo exception" onClose={()=>setPhoto(false)}><div className="photo-capture"><Camera size={44}/><strong>Capture student photo</strong><p>The image will be stored privately and sent to the Dean for review.</p><button className="primary-btn" onClick={()=>setPhoto(false)}>Open camera</button></div></Modal>}</main>
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="modal-backdrop"><div className="modal"><header><h2>{title}</h2><button onClick={onClose}><X/></button></header>{children}</div></div>}
