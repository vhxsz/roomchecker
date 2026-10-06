import { verifyStudentQrToken } from "@/lib/qr-token";
import { requireUser } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request, ["checker", "dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const body = await request.json() as { token?: string; eventId?: string; roomId?: string };
    const payload = body.token ? verifyStudentQrToken(body.token) : null;
    if (!payload) return Response.json({ error: "QR code is invalid or expired" }, { status: 400 });
    if (!body.eventId || !body.roomId || payload.roomId !== body.roomId) return Response.json({ error: "Student is not assigned to this room" }, { status: 409 });
    const { data: room } = await auth.supabase.from("rooms").select("checker_id, active").eq("id", body.roomId).single();
    if (!room?.active || (auth.profile.role === "checker" && room.checker_id !== auth.user.id)) return Response.json({ error: "This room is not assigned to this checker" }, { status: 403 });
    const { data: event } = await auth.supabase.from("check_events").select("id, closed_at").eq("id", body.eventId).single();
    if (!event || event.closed_at) return Response.json({ error: "Room check session is not open" }, { status: 409 });
    const { data: assignment } = await auth.supabase.from("room_assignments").select("id").eq("student_id", payload.sub).eq("room_id", body.roomId).eq("active", true).maybeSingle();
    if (!assignment) return Response.json({ error: "Student is no longer assigned to this room" }, { status: 409 });
    const { data, error } = await auth.supabase.rpc("record_room_check", {p_actor:auth.user.id,p_student:payload.sub,p_room:body.roomId,p_event:body.eventId,p_method:"qr"});
    if (error)return Response.json({error:error.message},{status:409});
    return Response.json({ verification: data, studentId: payload.sub });
  } catch (error) {
    console.error("QR verification failed", error);
    return Response.json({ error: "Verification could not be saved" }, { status: 500 });
  }
}
