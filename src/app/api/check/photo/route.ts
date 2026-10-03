import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/supabase/admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request, ["checker", "dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const form = await request.formData();
    const photo = form.get("photo");
    const eventId = String(form.get("eventId") ?? "");
    const roomId = String(form.get("roomId") ?? "");
    const studentId = String(form.get("studentId") ?? "");
    const notes = String(form.get("notes") ?? "").slice(0, 500);
    if (!(photo instanceof File) || !allowedTypes.has(photo.type) || photo.size > 5_000_000) return Response.json({ error: "Upload a JPG, PNG or WebP photo under 5 MB" }, { status: 400 });
    const { data: room } = await auth.supabase.from("rooms").select("checker_id, active").eq("id", roomId).single();
    if (!room?.active || (auth.profile.role === "checker" && room.checker_id !== auth.user.id)) return Response.json({ error: "This room is not assigned to this checker" }, { status: 403 });
    const path = `${eventId}/${roomId}/${studentId}-${randomUUID()}.${photo.type.split("/")[1]}`;
    const { error: uploadError } = await auth.supabase.storage.from("room-check-photos").upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await auth.supabase.from("verifications").upsert({ event_id: eventId, student_id: studentId, checker_id: auth.user.id, room_id: roomId, method: "photo", status: "photo_review", photo_path: path, notes }, { onConflict: "event_id,student_id" }).select("id").single();
    if (error) { await auth.supabase.storage.from("room-check-photos").remove([path]); throw error; }
    return Response.json({ verification: data, status: "photo_review" });
  } catch (error) {
    console.error("Photo verification failed", error);
    return Response.json({ error: "Photo evidence could not be saved" }, { status: 500 });
  }
}
