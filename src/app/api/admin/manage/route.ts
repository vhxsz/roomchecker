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

  if(body.action==="create_student"||body.action==="create_checker"||body.action==="invite_user"){
   const email=text(body.email).toLowerCase(),fullName=text(body.fullName);
   const requested=body.action==="create_checker"?"checker":body.action==="create_student"?"student":text(body.role);
   const role=roles.has(requested as Role)?requested as Role:"student";
   if(!email||!fullName)return Response.json({error:"Name and email are required"},{status:400});
   const redirectBase=process.env.NEXT_PUBLIC_SITE_URL;
   if(!redirectBase)throw new Error("NEXT_PUBLIC_SITE_URL is not configured");
   const{data,error}=await auth.supabase.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName},redirectTo:`${redirectBase}/auth/callback`});
   if(error)throw error;
   const{error:profileError}=await auth.supabase.from("profiles").upsert({id:data.user.id,email,full_name:fullName,role,age:Number(body.age)||null,grade:body.grade||null,nationality:body.nationality||null},{onConflict:"id"});
   if(profileError)throw profileError;
   result={id:data.user.id};
  }else if(body.action==="update_profile"){
   const id=text(body.id),fullName=text(body.fullName),age=body.age?Number(body.age):null;
   if(!id||!fullName)return Response.json({error:"User and name are required"},{status:400});
   if(age!==null&&(age<10||age>30))return Response.json({error:"Age must be between 10 and 30"},{status:400});
   const{data,error}=await auth.supabase.from("profiles").update({full_name:fullName,age,grade:text(body.grade)||null,nationality:text(body.nationality)||null}).eq("id",id).select().single();
   if(error)throw error;result=data;
  }else if(body.action==="set_role"){
   const id=text(body.id),role=text(body.role) as Role;
   if(id===auth.user.id)return Response.json({error:"You cannot change your own role"},{status:409});
   if(!roles.has(role))return Response.json({error:"Invalid role"},{status:400});
   const{data:profile}=await auth.supabase.from("profiles").select("role").eq("id",id).maybeSingle();
   if(!profile)return Response.json({error:"User not found"},{status:404});
   if(profile.role==="dean"&&role!=="dean"){
    const{count}=await auth.supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","dean");
    if((count??0)<=1)return Response.json({error:"The last Dean account cannot be demoted"},{status:409});
   }
   if(profile.role==="checker"&&role!=="checker")await auth.supabase.from("rooms").update({checker_id:null}).eq("checker_id",id);
   if(role!=="student")await auth.supabase.from("room_assignments").update({active:false}).eq("student_id",id).eq("active",true);
   const{data,error}=await auth.supabase.from("profiles").update({role}).eq("id",id).select().single();
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
  }else if(body.action==="set_checker_rooms"){
   const checkerId=text(body.checkerId),roomIds=Array.isArray(body.roomIds)?body.roomIds.map(text).filter(Boolean):[];
   const{data:checker}=await auth.supabase.from("profiles").select("role").eq("id",checkerId).maybeSingle();
   if(checker?.role!=="checker")return Response.json({error:"Only Checker accounts can be assigned to rooms"},{status:409});
   const{error:clearError}=await auth.supabase.from("rooms").update({checker_id:null}).eq("checker_id",checkerId);if(clearError)throw clearError;
   if(roomIds.length){const{error:assignError}=await auth.supabase.from("rooms").update({checker_id:checkerId}).in("id",roomIds).eq("active",true);if(assignError)throw assignError}
   result={id:checkerId,rooms:roomIds};
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
   const id=text(body.id),values:Record<string,unknown>={active:body.active!==false,checker_id:text(body.checkerId)||null};
   if(body.capacity!==undefined)values.capacity=Number(body.capacity);
   if(body.roomNumber!==undefined)values.room_number=text(body.roomNumber);
   if(body.floorId!==undefined)values.floor_id=text(body.floorId);
   const{data,error}=await auth.supabase.from("rooms").update(values).eq("id",id).select().single();if(error)throw error;result=data;
  }else if(body.action==="assign_student"){
   const roomId=text(body.roomId),studentId=text(body.studentId);
   const[{data:room},{count},{data:student}]=await Promise.all([auth.supabase.from("rooms").select("capacity,active").eq("id",roomId).single(),auth.supabase.from("room_assignments").select("id",{count:"exact",head:true}).eq("room_id",roomId).eq("active",true),auth.supabase.from("profiles").select("role").eq("id",studentId).maybeSingle()]);
   if(student?.role!=="student")return Response.json({error:"Only students can be assigned to rooms"},{status:409});
   if(!room?.active||(count??0)>=room.capacity)return Response.json({error:"This room has no available beds"},{status:409});
   await auth.supabase.from("room_assignments").update({active:false}).eq("student_id",studentId).eq("active",true);
   const{data,error}=await auth.supabase.from("room_assignments").insert({room_id:roomId,student_id:studentId,active:true}).select().single();if(error)throw error;result=data;
  }else if(body.action==="remove_assignment"){
   const{error}=await auth.supabase.from("room_assignments").update({active:false}).eq("student_id",text(body.studentId)).eq("active",true);if(error)throw error;result={studentId:body.studentId};
  }else if(body.action==="save_schedule"){
   const name=text(body.name),time=text(body.time),days=Array.isArray(body.days)?body.days:[],grace=Number(body.graceMinutes)||20;
   if(!name||!/^\d{2}:\d{2}/.test(time)||!days.length)return Response.json({error:"Name, time and at least one day are required"},{status:400});
   const values={name,check_time:time,days_of_week:days,grace_minutes:grace,active:body.active!==false};
   const query=body.id?auth.supabase.from("check_templates").update(values).eq("id",text(body.id)):auth.supabase.from("check_templates").insert(values);
   const{data,error}=await query.select().single();if(error)throw error;result=data;
  }else if(body.action==="delete_schedule"){
   const id=text(body.id);const{count}=await auth.supabase.from("check_events").select("id",{count:"exact",head:true}).eq("template_id",id);
   if((count??0)>0)return Response.json({error:"Schedules with room check history cannot be deleted; disable it instead"},{status:409});
   const{error}=await auth.supabase.from("check_templates").delete().eq("id",id);if(error)throw error;result={id};
  }else if(body.action==="open_event"){
   const templateId=text(body.templateId);const{data:template}=await auth.supabase.from("check_templates").select("active").eq("id",templateId).maybeSingle();
   if(!template?.active)return Response.json({error:"This schedule is disabled"},{status:409});
   const{data,error}=await auth.supabase.from("check_events").insert({template_id:templateId,scheduled_for:body.scheduledFor||new Date().toISOString(),opened_at:new Date().toISOString(),created_by:auth.user.id}).select().single();if(error)throw error;result=data;
  }else if(body.action==="close_event"){
   const eventId=text(body.id);const{data:closed,error:closeError}=await auth.supabase.from("check_events").update({closed_at:new Date().toISOString()}).eq("id",eventId).is("closed_at",null).select().maybeSingle();if(closeError)throw closeError;if(!closed)return Response.json({error:"This session is already closed"},{status:409});
   const[{data:assignments},{data:existing}]=await Promise.all([auth.supabase.from("room_assignments").select("student_id,room_id").eq("active",true),auth.supabase.from("verifications").select("student_id").eq("event_id",eventId)]);
   const recorded=new Set((existing??[]).map(item=>item.student_id)),absences=(assignments??[]).filter(item=>!recorded.has(item.student_id)).map(item=>({event_id:eventId,student_id:item.student_id,checker_id:auth.user.id,room_id:item.room_id,method:"qr",status:"absent"}));
   if(absences.length){const{error}=await auth.supabase.from("verifications").insert(absences);if(error)throw error}result=closed;
  }else if(body.action==="review_photo"){
   const{data,error}=await auth.supabase.from("verifications").update({status:body.approved?"verified":"absent",reviewed_by:auth.user.id,reviewed_at:new Date().toISOString(),notes:body.notes||null}).eq("id",text(body.id)).eq("method","photo").eq("status","photo_review").select().single();if(error)throw error;result=data;
  }else return Response.json({error:"Unknown administrative action"},{status:400});

  await auth.supabase.from("audit_logs").insert({actor_id:auth.user.id,action:body.action,entity_type:String(body.action).split("_").at(-1)??"record",entity_id:typeof result==="object"&&result&&"id" in result?String(result.id):null,metadata:{}});
  return Response.json({data:result});
 }catch(error){console.error("Admin action failed",error);return Response.json({error:error instanceof Error?error.message:"Administrative action failed"},{status:500})}
}
