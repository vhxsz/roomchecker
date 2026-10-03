"use client";

import { CheckerPortal } from "../page";
import { RoleGate } from "@/components/role-gate";
export default function CheckerPage(){ return <RoleGate allowed={["checker","dean"]}>{(logout)=><CheckerPortal onLogout={logout}/>}</RoleGate> }
