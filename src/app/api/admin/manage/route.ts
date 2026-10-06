import { requireUser } from "@/lib/supabase/admin";

type Role="dean"|"checker"|"student";
type ActionBody={action:string;[key:string]:unknown};
const roles=new Set<Role>(["dean","checker","student"]);
const text=(value:unknown)=>String(value??"").trim();

export async function POST(request:Request){
 try{
  const auth=await requireUser(request,["dean"]);
  if("error" in auth)return Response.json({error:auth.error},{status:auth.status});
  const body=await request.json() as ActionBody;
  let result:unknown;

  const transactionalActions=new Set(["set_role","set_checker_rooms","assign_student","remove_assignment","open_event","close_event"]);
  if(transactionalActions.has(body.action)){
   if(body.action==="set_role"&&!roles.has(text(body.role) as Role))return Response.json({error:"Invalid role"},{status:400});
   if(body.action==="set_checker_rooms"&&!Array.isArray(body.roomIds))return Response.json({error:"Room selection is required"},{status:400});
   const{data,error}=await auth.supabase.rpc("residence_operation",{p_actor:auth.user.id,p_action:body.action,p_body:body});
   if(error)return Response.json({error:error.code==="PGRST202"?"Database upgrade required: run the residence operations migration":error.message},{status:409});
   return Response.json({data});
  }

  if(body.action==="create_student"||body.action==="create_checker"||body.action==="invite_user"){
   return Response.json({error:"Accounts are created only through school Google sign-in. Manage roles after the user first signs in."},{status:409});
  }else if(body.action==="update_profile"){
   const id=text(body.id),fullName=text(body.fullName),age=body.age?Number(body.age):null;
   if(!id||!fullName)return Response.json({error:"User and name are required"},{status:400});
   if(age!==null&&(!Number.isInteger(age)||age<10||age>30))return Response.json({error:"Age must be between 10 and 30"},{status:400});
   const{data,error}=await auth.supabase.from("profiles").update({full_name:fullName,age,grade:text(body.grade)||null,nationality:text(body.nationality)||null}).eq("id",id).select().single();
   if(error)throw error;result=data;
  }else if(body.action==="delete_user"||body.action==="delete_student"){
   const id=text(body.id);
   if(id===auth.user.id)return Response.json({error:"You cannot delete your own account"},{status:409});
   const{data:target}=await auth.supabase.from("profiles").select("role").eq("id",id).maybeSingle();
   if(target?.role==="dean"){
    const{count}=await auth.supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","dean");
    if((count??0)<=1)return Response.json({error:"The last Dean account cannot be deleted"},{status:409});
   }
   const{error}=await auth.supabase.auth.admin.deleteUser(id);if(error)throw error;result={id};
  }else if(body.action==="create_floor"){
   const hall=text(body.hall),label=text(body.label),floorNumber=Number(body.floorNumber);
   if(!hall||!label||!Number.isInteger(floorNumber))return Response.json({error:"Hall, floor number and label are required"},{status:400});
   const{data,error}=await auth.supabase.from("floors").insert({hall,floor_number:floorNumber,label}).select().single();if(error)throw error;result=data;
  }else if(body.action==="create_room"){
   const roomNumber=text(body.roomNumber),floorId=text(body.floorId),capacity=Number(body.capacity)||2,checkerId=text(body.checkerId)||null;
   if(!roomNumber||!floorId||capacity<1||capacity>8)return Response.json({error:"Valid room, floor and capacity are required"},{status:400});
   if(checkerId){const{data:checker}=await auth.supabase.from("profiles").select("role").eq("id",checkerId).maybeSingle();if(checker?.role!=="checker")return Response.json({error:"Assigned user must be a Checker"},{status:409})}
   const{data,error}=await auth.supabase.from("rooms").insert({floor_id:floorId,room_number:roomNumber,capacity,checker_id:checkerId}).select().single();if(error)throw error;result=data;
  }else if(body.action==="update_room"){
   const id=text(body.id),values:Record<string,unknown>={};
   if(body.active!==undefined)values.active=body.active===true;
   if(body.checkerId!==undefined)values.checker_id=text(body.checkerId)||null;
   if(body.capacity!==undefined)values.capacity=Number(body.capacity);
   if(body.roomNumber!==undefined)values.room_number=text(body.roomNumber);
   if(body.floorId!==undefined)values.floor_id=text(body.floorId);
   const{data,error}=await auth.supabase.from("rooms").update(values).eq("id",id).select().single();if(error)throw error;result=data;
  }else if(body.action==="save_schedule"){
   const name=text(body.name),time=text(body.time),days=Array.isArray(body.days)?body.days:[],grace=Number(body.graceMinutes)||20;
   if(!name||!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)||!days.length||days.some(d=>!Number.isInteger(d)||Number(d)<0||Number(d)>6)||!Number.isInteger(grace)||grace<5||grace>120)return Response.json({error:"Choose a valid time, weekdays and a 5–120 minute window"},{status:400});
   const values={name,check_time:time,days_of_week:days,grace_minutes:grace,active:body.active!==false};
   const query=body.id?auth.supabase.from("check_templates").update(values).eq("id",text(body.id)):auth.supabase.from("check_templates").insert(values);
   const{data,error}=await query.select().single();if(error)throw error;result=data;
  }else if(body.action==="delete_schedule"){
   const id=text(body.id);const{count}=await auth.supabase.from("check_events").select("id",{count:"exact",head:true}).eq("template_id",id);
   if((count??0)>0)return Response.json({error:"Schedules with room check history cannot be deleted; disable it instead"},{status:409});
   const{error}=await auth.supabase.from("check_templates").delete().eq("id",id);if(error)throw error;result={id};
  }else if(body.action==="review_photo"){
   const{data,error}=await auth.supabase.from("verifications").update({status:body.approved?"verified":"absent",reviewed_by:auth.user.id,reviewed_at:new Date().toISOString(),notes:body.notes||null}).eq("id",text(body.id)).eq("method","photo").eq("status","photo_review").select().single();if(error)throw error;result=data;
  }else return Response.json({error:"Unknown administrative action"},{status:400});

  await auth.supabase.from("audit_logs").insert({actor_id:auth.user.id,action:body.action,entity_type:String(body.action).split("_").at(-1)??"record",entity_id:typeof result==="object"&&result&&"id" in result?String(result.id):null,metadata:{...body,action:undefined,email:undefined,fullName:undefined,nationality:undefined,age:undefined}});
  return Response.json({data:result});
 }catch(error){console.error("Admin action failed",error);return Response.json({error:error&&typeof error==="object"&&"message" in error?String(error.message):"Administrative action failed"},{status:500})}
}
