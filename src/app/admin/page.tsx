"use client";

import { RoleGate } from "@/components/role-gate";
import { DeanLive } from "@/components/dean-live";
export default function AdminPage(){ return <RoleGate allowed={["dean"]}>{(logout)=><DeanLive onLogout={logout}/>}</RoleGate> }
