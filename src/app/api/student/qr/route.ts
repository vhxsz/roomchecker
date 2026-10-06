import { createStudentQrToken } from "@/lib/qr-token";
import { requireUser } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request, ["student", "checker", "dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const { data: assignment } = await auth.supabase.from("room_assignments").select("room_id, rooms(room_number,active)").eq("student_id", auth.user.id).eq("active", true).single();
    if (!assignment) return Response.json({ error: "No active room assignment" }, { status: 409 });
    const now = Math.floor(Date.now() / 1000);
    const room = assignment.rooms as unknown as { room_number: string;active:boolean };
    if(!room.active)return Response.json({error:"Your room is inactive. Contact the Dean."},{status:409});
    const payload = { sub: auth.user.id, studentCode: auth.profile.student_code, roomId: assignment.room_id, roomNumber: room.room_number, iat: now, exp: now + 30 };
    return Response.json({ token: createStudentQrToken(payload), expiresAt: payload.exp, roomNumber: payload.roomNumber,roomId:payload.roomId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("QR generation failed", error);
    return Response.json({ error: "QR service unavailable" }, { status: 503 });
  }
}
