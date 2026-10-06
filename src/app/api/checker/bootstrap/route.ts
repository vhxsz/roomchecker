import { requireUser } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request, ["checker", "dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    let roomsQuery = auth.supabase.from("rooms").select("id,room_number,capacity,floor_id,checker_id,active,floors(hall,floor_number,label)").eq("active", true);
    if (auth.profile.role === "checker") roomsQuery = roomsQuery.eq("checker_id", auth.user.id);
    const { data: rooms, error } = await roomsQuery.order("room_number"); if (error) throw error;
    const roomIds = rooms.map(room => room.id);
    const results = await Promise.all([
      roomIds.length ? auth.supabase.from("room_assignments").select("id,room_id,student_id,profiles(id,full_name,student_code)").in("room_id", roomIds).eq("active", true) : Promise.resolve({ data: [] }),
      auth.supabase.from("check_events").select("id,template_id,scheduled_for,opened_at,closed_at,check_templates(name,check_time)").is("closed_at", null).order("scheduled_for", { ascending: false }).limit(1).maybeSingle(),
      auth.supabase.from("verifications").select("id,event_id,student_id,room_id,method,status,verified_at").in("room_id", roomIds.length ? roomIds : ["00000000-0000-0000-0000-000000000000"]).order("verified_at", { ascending: false }).limit(2000),
    ]);
    const failed=results.find(result=>"error" in result&&result.error);
    if(failed&&"error" in failed)throw failed.error;
    const [{data:assignments},{data:event},{data:verifications}]=results;
    return Response.json({ rooms, assignments: assignments ?? [], event, verifications: verifications ?? [] });
  } catch (error) {
    console.error("Checker bootstrap failed", error);
    return Response.json({ error: "Assigned rooms are temporarily unavailable" }, { status: 500 });
  }
}
