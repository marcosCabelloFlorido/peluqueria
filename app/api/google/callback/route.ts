import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { encrypt, exchangeCode } from "@/lib/google";

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const [state, next = "/perfil"] = (req.cookies.get("g_state")?.value ?? "").split("|");
  const back = (q: string) => {
    const res = NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}gcal=${q}`);
    res.cookies.delete({ name: "g_state", path: "/api/google" });
    return res;
  };

  if (searchParams.get("error") || !state || state !== searchParams.get("state")) return back("denied");
  const code = searchParams.get("code");
  const {
    data: { user },
  } = await (await supabaseServer()).auth.getUser();
  if (!code || !user) return back("denied");

  try {
    const t = await exchangeCode(code);
    if (!t.refresh_token || !t.scope.includes("calendar.events")) return back("denied");
    const svc = supabaseService();
    await svc.from("google_tokens").upsert({ user_id: user.id, refresh_token_enc: await encrypt(t.refresh_token), updated_at: new Date().toISOString() });
    await svc.from("profiles").update({ google_calendar_connected: true }).eq("id", user.id);
    return back("ok");
  } catch (e) {
    console.error("[google] callback", e);
    return back("error");
  }
}
