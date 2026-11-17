import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { authUrl } from "@/lib/google";

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/perfil`);
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(`${origin}/perfil?gcal=unconfigured`);

  const n = searchParams.get("next") ?? "";
  const next = n === "/reservar" || /^\/api\/google\/add\/[0-9a-f-]{36}$/.test(n) ? n : "/perfil";
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("g_state", `${state}|${next}`, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), maxAge: 600, path: "/api/google" });
  return res;
}
