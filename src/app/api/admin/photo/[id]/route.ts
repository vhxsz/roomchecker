import { requireUser } from "@/lib/supabase/admin";

export async function GET(request: Request, context: RouteContext<"/api/admin/photo/[id]">) {
  try {
    const auth = await requireUser(request, ["dean"]);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const { id } = await context.params;
    const { data: verification } = await auth.supabase.from("verifications").select("photo_path").eq("id", id).eq("method", "photo").single();
    if (!verification?.photo_path) return Response.json({ error: "Photo evidence not found" }, { status: 404 });
    const { data, error } = await auth.supabase.storage.from("room-check-photos").createSignedUrl(verification.photo_path, 60);
    if (error) throw error;
    return Response.json({ url: data.signedUrl });
  } catch (error) {
    console.error("Photo access failed", error);
    return Response.json({ error: "Photo evidence is unavailable" }, { status: 500 });
  }
}
