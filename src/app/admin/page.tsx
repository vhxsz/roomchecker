"use client";

import { DeanDashboard } from "../page";
import { RoleGate } from "@/components/role-gate";
export default function AdminPage(){ return <RoleGate allowed={["dean"]}>{(logout)=><DeanDashboard onLogout={logout}/>}</RoleGate> }
