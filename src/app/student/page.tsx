"use client";

import { RoleGate } from "@/components/role-gate";
import { StudentLive } from "@/components/student-live";
export default function StudentPage(){ return <RoleGate allowed={["student"]}>{(logout)=><StudentLive onLogout={logout}/>}</RoleGate> }
