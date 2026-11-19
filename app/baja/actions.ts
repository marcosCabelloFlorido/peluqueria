"use server";
import { redirect } from "next/navigation";
import { optOutClient } from "@/lib/apptAccess";

export async function unsubscribe(formData: FormData) {
  const c = String(formData.get("c") ?? "");
  const t = String(formData.get("t") ?? "");
  const r = await optOutClient(c, t);
  redirect(r === "invalid" ? "/baja" : `/baja?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}&r=${r}`);
}
