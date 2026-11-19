import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

/** Solo admins: sin sesión → login; con sesión normal → reservar. Devuelve el cliente ya autenticado. */
export async function requireAdmin(next: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${next}`);
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/reservar");
  return sb;
}
