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

  const next = searchParams.get("next") === "/reservar" ? "/reservar" : "/perfil";
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("g_state", `${state}|${next}`, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), maxAge: 600, path: "/api/google" });
  return res;
}
