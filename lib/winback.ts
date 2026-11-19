import { unsubUrl } from "./apptAccess";
import { send, winbackEmail } from "./email";

/** Envía el email de reactivación. No toca la BD: quien llama decide cuándo marcar `last_winback_sent_at`. */
export async function sendWinbackEmail(c: { id: string; email: string; full_name: string }, offer: string, to = c.email): Promise<boolean> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return send(to, "Te echamos de menos · DouceCreative", winbackEmail(c.full_name, offer, `${site}/reservar`, await unsubUrl(c.id)));
}
