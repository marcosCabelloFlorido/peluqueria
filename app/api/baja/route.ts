import { NextResponse } from "next/server";
import { optOutClient } from "@/lib/apptAccess";

export const dynamic = "force-dynamic";

// Baja con un clic (RFC 8058): el cliente de correo hace POST a la URL de List-Unsubscribe.
export async function POST(req: Request) {
  const u = new URL(req.url);
  const r = await optOutClient(u.searchParams.get("c"), u.searchParams.get("t"));
  return r === "invalid" ? NextResponse.json({ ok: false }, { status: 400 }) : NextResponse.json({ ok: true });
}

// GET no cambia datos: los escáneres de enlaces lo precargan. Redirige a la confirmación.
export async function GET(req: Request) {
  const u = new URL(req.url);
  return NextResponse.redirect(new URL(`/baja${u.search}`, u.origin), 303);
}
