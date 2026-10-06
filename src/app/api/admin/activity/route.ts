import { requireUser } from "@/lib/supabase/admin";
export async function GET(request:Request){
 try{
  const auth=await requireUser(request,["dean"]);
  if("error" in auth)return Response.json({error:auth.error},{status:auth.status});
  const{data,error}=await auth.supabase.from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at,profiles(full_name)").order("created_at",{ascending:false}).limit(200);
  if(error)throw error;
  return Response.json({logs:data});
 }catch{return Response.json({error:"Activity log unavailable"},{status:503});}
}
