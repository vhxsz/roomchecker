import { requireUser } from "@/lib/supabase/admin";

export async function GET(request:Request) {
 try {
  const auth=await requireUser(request);
  if("error" in auth)return Response.json({error:auth.error},{status:auth.status});
  let query=auth.supabase.from("maintenance_requests").select("*,rooms(room_number),profiles!maintenance_requests_reported_by_fkey(full_name)").order("created_at",{ascending:false}).limit(200);
  if(auth.profile.role!=="dean")query=query.eq("reported_by",auth.user.id);
  const{data,error}=await query;
  if(error)throw error;
  return Response.json({requests:data});
 }catch {return Response.json({error:"Requests unavailable. Check the residence database migration."},{status:503});}
}

export async function POST(request:Request) {
 try {
  const auth=await requireUser(request);
  if("error" in auth)return Response.json({error:auth.error},{status:auth.status});
  const body=await request.json();
  if(body.action==="update") {
   if(auth.profile.role!=="dean")return Response.json({error:"Dean permission required"},{status:403});
   if(!["open","in_progress","resolved"].includes(body.status))return Response.json({error:"Invalid status"},{status:400});
   const resolution=String(body.resolution??"").trim().slice(0,2000);
   if(body.status==="resolved"&&!resolution)return Response.json({error:"Add a resolution before closing the request"},{status:400});
   const{data,error}=await auth.supabase.from("maintenance_requests").update({status:body.status,resolution:resolution||null,updated_at:new Date().toISOString()}).eq("id",body.id).select().single();
   if(error)throw error;
   await auth.supabase.from("audit_logs").insert({actor_id:auth.user.id,action:"update_maintenance",entity_type:"maintenance",entity_id:data.id,metadata:{status:body.status}});
   return Response.json({request:data});
  }
  const title=String(body.title??"").trim(),description=String(body.description??"").trim(),priority=body.priority??"normal";
  if(title.length<3||title.length>120||description.length<10||description.length>2000||!["normal","urgent"].includes(priority))return Response.json({error:"Provide a title (3–120 characters) and description (10–2000 characters)"},{status:400});
  const{data:room,error:roomError}=await auth.supabase.from("rooms").select("id,active,checker_id").eq("id",body.roomId).maybeSingle();
  if(roomError)throw roomError;
  if(!room?.active)return Response.json({error:"Select an active room"},{status:409});
  if(auth.profile.role!=="dean"&&room.checker_id!==auth.user.id) {
   const{data:assignment,error}=await auth.supabase.from("room_assignments").select("id").eq("student_id",auth.user.id).eq("room_id",room.id).eq("active",true).maybeSingle();
   if(error)throw error;
   if(!assignment)return Response.json({error:"You can report only your own or assigned rooms"},{status:403});
  }
  const{data,error}=await auth.supabase.from("maintenance_requests").insert({room_id:room.id,reported_by:auth.user.id,title,description,priority}).select().single();
  if(error)throw error;
  await auth.supabase.from("audit_logs").insert({actor_id:auth.user.id,action:"report_maintenance",entity_type:"maintenance",entity_id:data.id,metadata:{roomId:room.id,priority}});
  return Response.json({request:data},{status:201});
 }catch {return Response.json({error:"Request could not be saved. Check the database migration."},{status:503});}
}
