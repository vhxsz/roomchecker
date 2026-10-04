"use client";

import { RoleGate } from "@/components/role-gate";
import { CheckerLive } from "@/components/checker-live";
export default function CheckerPage(){ return <RoleGate allowed={["checker","dean"]}>{(logout)=><CheckerLive onLogout={logout}/>}</RoleGate> }
