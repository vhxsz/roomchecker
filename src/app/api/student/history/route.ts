import { requireUser } from "@/lib/supabase/admin";

export async function GET(request:Request) {
 try {
 const auth=await requireUser(request);
 if("error" in auth)return Response.json({error:auth.error},{status:auth.status});
 const{data,error}=await auth.supabase.from("verifications").select("id,status,method,verified_at,check_events(scheduled_for,check_templates(name)),rooms(room_number)").eq("student_id",auth.user.id).order("verified_at",{ascending:false}).limit(30);
 if(error)return Response.json({error:"Attendance history unavailable"},{status:503});
 return Response.json({records:data});
 }catch{return Response.json({error:"Attendance history unavailable"},{status:503});}
}
