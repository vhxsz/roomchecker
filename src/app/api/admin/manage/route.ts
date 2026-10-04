import { requireUser } from "@/lib/supabase/admin";

type ActionBody = { action: string; [key: string]: unknown };

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request, ["dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const body = await request.json() as ActionBody;
    let result: unknown;
    if (body.action === "create_student") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.fullName ?? "").trim();
      if (!email || !fullName) return Response.json({ error: "Name and email are required" }, { status: 400 });
      const { data, error } = await auth.supabase.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` });
      if (error) throw error;
      const { error: profileError } = await auth.supabase.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, role: "student", age: Number(body.age) || null, grade: body.grade || null, nationality: body.nationality || null }, { onConflict: "id" });
      if (profileError) throw profileError;
      result = { id: data.user.id };
    } else if (body.action === "create_checker") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.fullName ?? "").trim();
      if (!email || !fullName) return Response.json({ error: "Name and email are required" }, { status: 400 });
      const { data, error } = await auth.supabase.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` });
      if (error) throw error;
      const { error: profileError } = await auth.supabase.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, role: "checker" }, { onConflict: "id" });
      if (profileError) throw profileError;
      result = { id: data.user.id };
    } else if (body.action === "update_profile") {
      const role = ["dean", "checker", "student"].includes(String(body.role)) ? body.role : undefined;
      const allowed = { full_name: body.fullName, age: body.age ? Number(body.age) : null, grade: body.grade || null, nationality: body.nationality || null, ...(role ? { role } : {}) };
      const { data, error } = await auth.supabase.from("profiles").update(allowed).eq("id", String(body.id)).select().single(); if (error) throw error; result = data;
    } else if (body.action === "delete_student") {
      const id = String(body.id); const { error } = await auth.supabase.auth.admin.deleteUser(id); if (error) throw error; result = { id };
    } else if (body.action === "create_floor") {
      const { data, error } = await auth.supabase.from("floors").insert({ hall: body.hall, floor_number: Number(body.floorNumber), label: body.label }).select().single(); if (error) throw error; result = data;
    } else if (body.action === "create_room") {
      const { data, error } = await auth.supabase.from("rooms").insert({ floor_id: body.floorId, room_number: body.roomNumber, capacity: Number(body.capacity) || 2, checker_id: body.checkerId || null }).select().single(); if (error) throw error; result = data;
    } else if (body.action === "update_room") {
      const { data, error } = await auth.supabase.from("rooms").update({ capacity: Number(body.capacity), checker_id: body.checkerId || null, active: body.active !== false }).eq("id", String(body.id)).select().single(); if (error) throw error; result = data;
    } else if (body.action === "assign_student") {
      const roomId = String(body.roomId); const studentId = String(body.studentId);
      const [{ data: room }, { count }] = await Promise.all([auth.supabase.from("rooms").select("capacity").eq("id", roomId).single(), auth.supabase.from("room_assignments").select("id", { count: "exact", head: true }).eq("room_id", roomId).eq("active", true)]);
      if (!room || (count ?? 0) >= room.capacity) return Response.json({ error: "This room has no available beds" }, { status: 409 });
      await auth.supabase.from("room_assignments").update({ active: false }).eq("student_id", studentId).eq("active", true);
      const { data, error } = await auth.supabase.from("room_assignments").insert({ room_id: roomId, student_id: studentId, active: true }).select().single(); if (error) throw error; result = data;
    } else if (body.action === "remove_assignment") {
      const { error } = await auth.supabase.from("room_assignments").update({ active: false }).eq("student_id", String(body.studentId)).eq("active", true); if (error) throw error; result = { studentId: body.studentId };
    } else if (body.action === "save_schedule") {
      const values = { name: body.name, check_time: body.time, days_of_week: body.days, grace_minutes: Number(body.graceMinutes) || 20, active: body.active !== false };
      const query = body.id ? auth.supabase.from("check_templates").update(values).eq("id", String(body.id)) : auth.supabase.from("check_templates").insert(values);
      const { data, error } = await query.select().single(); if (error) throw error; result = data;
    } else if (body.action === "open_event") {
      const { data, error } = await auth.supabase.from("check_events").insert({ template_id: body.templateId, scheduled_for: body.scheduledFor || new Date().toISOString(), opened_at: new Date().toISOString(), created_by: auth.user.id }).select().single(); if (error) throw error; result = data;
    } else if (body.action === "close_event") {
      const eventId = String(body.id);
      const [{ data: assignments }, { data: existing }] = await Promise.all([
        auth.supabase.from("room_assignments").select("student_id,room_id").eq("active", true),
        auth.supabase.from("verifications").select("student_id").eq("event_id", eventId),
      ]);
      const alreadyRecorded = new Set((existing ?? []).map(item => item.student_id));
      const absences = (assignments ?? []).filter(item => !alreadyRecorded.has(item.student_id)).map(item => ({ event_id: eventId, student_id: item.student_id, checker_id: auth.user.id, room_id: item.room_id, method: "qr", status: "absent" }));
      if (absences.length) { const { error: absenceError } = await auth.supabase.from("verifications").insert(absences); if (absenceError) throw absenceError; }
      const { data, error } = await auth.supabase.from("check_events").update({ closed_at: new Date().toISOString() }).eq("id", eventId).is("closed_at", null).select().single(); if (error) throw error; result = data;
    } else if (body.action === "review_photo") {
      const status = body.approved ? "verified" : "absent";
      const { data, error } = await auth.supabase.from("verifications").update({ status, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(), notes: body.notes || null }).eq("id", String(body.id)).eq("method", "photo").select().single(); if (error) throw error; result = data;
    } else return Response.json({ error: "Unknown administrative action" }, { status: 400 });
    await auth.supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: body.action, entity_type: String(body.action).split("_").at(-1) ?? "record", entity_id: typeof result === "object" && result && "id" in result ? String(result.id) : null, metadata: {} });
    return Response.json({ data: result });
  } catch (error) {
    console.error("Admin action failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Administrative action failed" }, { status: 500 });
  }
}
