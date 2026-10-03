"use client";

import { StudentPortal } from "../page";
import { RoleGate } from "@/components/role-gate";
export default function StudentPage(){ return <RoleGate allowed={["student"]}>{(logout)=><StudentPortal onLogout={logout}/>}</RoleGate> }
