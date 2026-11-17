import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await supabaseService().from("settings").select("id").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
