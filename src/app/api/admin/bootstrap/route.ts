import { requireUser } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request, ["dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const [profiles, floors, rooms, assignments, templates, events, verifications] = await Promise.all([
      auth.supabase.from("profiles").select("id,role,full_name,email,age,grade,nationality,student_code,created_at").order("full_name"),
      auth.supabase.from("floors").select("id,hall,floor_number,label").order("hall").order("floor_number"),
      auth.supabase.from("rooms").select("id,floor_id,room_number,capacity,checker_id,active").order("room_number"),
      auth.supabase.from("room_assignments").select("id,room_id,student_id,active,assigned_at").eq("active", true),
      auth.supabase.from("check_templates").select("id,name,check_time,days_of_week,grace_minutes,active").order("check_time"),
      auth.supabase.from("check_events").select("id,template_id,scheduled_for,opened_at,closed_at,created_by").order("scheduled_for", { ascending: false }).limit(30),
      auth.supabase.from("verifications").select("id,event_id,student_id,checker_id,room_id,method,status,photo_path,notes,verified_at,reviewed_by,reviewed_at").order("verified_at", { ascending: false }).limit(2000),
    ]);
    const failed = [profiles, floors, rooms, assignments, templates, events, verifications].find(result => result.error);
    if (failed?.error) throw failed.error;
    // Pending reviews must not disappear when newer attendance fills the history cap.
    const records=new Map((verifications.data??[]).map(v=>[v.id,v]));
    for(let page=0;page<200;page++){
      const {data,error}=await auth.supabase.from("verifications").select("id,event_id,student_id,checker_id,room_id,method,status,photo_path,notes,verified_at,reviewed_by,reviewed_at").eq("status","photo_review").order("id").range(page*500,page*500+499);
      if(error)throw error;
      data.forEach(v=>records.set(v.id,v));if(data.length<500)break;
      if(page===199)throw new Error("Review queue too large");
    }
    return Response.json({ viewerId: auth.user.id, profiles: profiles.data, floors: floors.data, rooms: rooms.data, assignments: assignments.data, templates: templates.data, events: events.data, verifications: [...records.values()] });
  } catch (error) {
    console.error("Admin bootstrap failed", error);
    return Response.json({ error: "Administrative data is temporarily unavailable" }, { status: 500 });
  }
}
