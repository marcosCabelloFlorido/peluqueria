import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reservar";
  if (code) await (await supabaseServer()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/reservar"}`);
}
