import { requireUser } from "@/lib/supabase/admin";

export async function GET(request:Request){
 try{
  const auth=await requireUser(request,["dean"]);
  if("error" in auth)return Response.json({error:auth.error},{status:auth.status});
  const days=Number(new URL(request.url).searchParams.get("days")??7);
  if(![1,7,30,365].includes(days))return Response.json({error:"Invalid reporting period"},{status:400});
  const cutoff=new Date(Date.now()-days*86400000).toISOString();
  // Fetch every page rather than silently presenting a capped bootstrap as a year report.
  const records:unknown[]=[];let page=0;
  while(true){
   const{data,error}=await auth.supabase.from("verifications").select("id,event_id,student_id,room_id,method,status,verified_at").gte("verified_at",cutoff).order("verified_at").order("id").range(page*500,page*500+499);
   if(error)throw error;
   records.push(...data);if(data.length<500)break;page++;
   if(page>=200)throw new Error("Report exceeds 100,000 records. Choose a shorter period.");
  }
  const events:unknown[]=[];page=0;
  while(true){
   const{data,error}=await auth.supabase.from("check_events").select("id,template_id,scheduled_for,opened_at,closed_at").gte("scheduled_for",cutoff).order("scheduled_for",{ascending:false}).order("id").range(page*500,page*500+499);
   if(error)throw error;
   events.push(...data);if(data.length<500)break;page++;
   if(page>=200)throw new Error("Choose a shorter reporting period.");
  }
  return Response.json({records,events},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Report unavailable"},{status:503});}
}
