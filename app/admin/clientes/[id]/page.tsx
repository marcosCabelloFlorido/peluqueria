import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import AdminSub from "@/components/AdminSub";
import ClientNotes from "@/components/ClientNotes";
import ClientPhotos, { type Photo } from "@/components/ClientPhotos";
import DirtyForm from "@/components/DirtyForm";
import ErrorBox from "@/components/ErrorBox";
import { WhatsApp } from "@/components/Icons";
import { requireAdmin } from "@/lib/adminGuard";
import { clientSummary, isInactive, telLink, waLink, type CrmAppt } from "@/lib/crm";
import { euro, fmt } from "@/lib/time";
import { adminSendWinback, adminUpdateClient } from "../actions";

type Appt = CrmAppt & { id: string };
const STATUS: Record<string, string> = { completed: "Vino", no_show: "No vino", cancelled: "Cancelada", confirmed: "Confirmada" };
const ERR: Record<string, string> = {
  invalido: "Revisa el nombre y el email.",
  duplicado: "Ya existe otro cliente con ese email.",
  baja: "Este cliente no quiere recibir avisos, no se ha enviado.",
  envio: "El email no se pudo enviar. No se ha marcado como avisado; inténtalo más tarde.",
  fallo: "No se pudo completar. Inténtalo de nuevo.",
};
const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: es, addSuffix: true });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Cliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; aviso?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const sb = await requireAdmin(`/admin/clientes/${id}`);
  if (!UUID.test(id)) notFound();

  const [{ data: c }, { data: apptRows }, { data: photoRows }, { data: cfg }] = await Promise.all([
    sb.from("clients").select("*").eq("id", id).maybeSingle(),
    sb.from("appointments").select("id,starts_at,status,total_cents,appointment_services(price_cents,services(name))").eq("client_id", id).order("starts_at", { ascending: false }).limit(500),
    sb.from("client_photos").select("id,path,caption,taken_at").eq("client_id", id).order("taken_at", { ascending: false }),
    sb.from("settings").select("winback_days").single(),
  ]);
  if (!c) notFound();

  const now = Date.now();
  const days = cfg?.winback_days ?? 30;
  const appts = (apptRows ?? []) as unknown as Appt[];
  const s = clientSummary(appts, now);
  const inactive = isInactive({ visits: s.visits, last_visit: s.lastVisit, next_appt: s.nextAppt }, days, now);

  const paths = (photoRows ?? []).map((p) => p.path);
  const { data: signed } = paths.length ? await sb.storage.from("client-photos").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((signed ?? []).map((u) => [u.path, u.signedUrl]));
  const photos: Photo[] = (photoRows ?? []).flatMap((p) => {
    const url = urls.get(p.path);
    return url ? [{ id: p.id, url, caption: p.caption, date: fmt(p.taken_at, "d MMM yyyy") }] : [];
  });

  const name = c.full_name || c.email;
  const stat = (label: string, value: string, hint?: string) => (
    <div className="card p-4"><p className="text-sm text-g3">{label}</p><p className="display text-xl mt-0.5">{value}</p>{hint && <p className="text-xs text-g3 mt-0.5">{hint}</p>}</div>
  );

  return (
    <AdminSub title={name}>
      <p className="-mt-4 mb-5"><Link href="/admin/clientes" className="link">Todos los clientes</Link></p>
      {sp.error && <ErrorBox>{ERR[sp.error] ?? ERR.fallo}</ErrorBox>}
      {sp.aviso === "enviado" && <p role="status" className="card px-4 py-3 text-sm mb-4">Recordatorio enviado.</p>}

      {inactive && (
        <section className="rounded-2xl border border-ink p-4 mb-5" aria-label="Cliente inactivo">
          <p className="display text-xl">Te echamos de menos</p>
          <p className="text-sm text-g4 mt-1">Lleva más de {days} días sin venir (último corte {ago(s.lastVisit!)}).</p>
          <p className="text-sm text-g4 mt-1">
            {c.last_winback_sent_at ? `Aviso enviado el ${fmt(c.last_winback_sent_at, "d 'de' MMMM yyyy")}.` : "Aún no se le ha enviado ningún aviso."}
            {c.marketing_opt_out && " Se dio de baja de los avisos."}
          </p>
          <form action={adminSendWinback} className="mt-3">
            <input type="hidden" name="id" value={c.id} />
            <button className="btn btn-primary !min-h-11 text-sm" disabled={c.marketing_opt_out}>Enviar recordatorio ahora</button>
          </form>
        </section>
      )}

      <h2 className="display text-2xl mb-3">Resumen</h2>
      <div className="grid grid-cols-2 gap-3">
        {stat("Último corte", s.lastVisit ? fmt(s.lastVisit, "d MMM yyyy") : "—", s.lastVisit ? ago(s.lastVisit) : "Sin cortes aún")}
        {stat("Visitas", String(s.visits))}
        <div className="col-span-2">{stat("Próxima cita", s.nextAppt ? fmt(s.nextAppt, "EEEE d 'de' MMMM, HH:mm") : "Sin cita")}</div>
      </div>

      <h2 className="display text-2xl mt-8 mb-3">Contacto</h2>
      {c.phone && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <a className="btn btn-secondary !min-h-11 text-sm" href={telLink(c.phone)}>Llamar</a>
          <a className="btn btn-secondary !min-h-11 text-sm" href={waLink(c.phone)} target="_blank" rel="noopener"><WhatsApp />WhatsApp</a>
        </div>
      )}
      <DirtyForm action={adminUpdateClient} label="Guardar cambios" className="card p-4 flex flex-col gap-3" buttonClass="btn btn-primary !min-h-11 text-sm">
        <input type="hidden" name="id" value={c.id} />
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Nombre</span><input className="field" name="full_name" defaultValue={c.full_name} maxLength={100} autoComplete="off" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Email</span><input className="field" type="email" name="email" defaultValue={c.email} required maxLength={200} autoComplete="off" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Teléfono</span><input className="field" type="tel" name="phone" defaultValue={c.phone ?? ""} maxLength={30} autoComplete="off" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Cumpleaños</span><input className="field" type="date" name="birthday" defaultValue={c.birthday ?? ""} /></label>
        <label className="flex items-center justify-between gap-3 min-h-11">
          <span className="text-sm">No enviarle avisos promocionales</span>
          <input type="checkbox" name="marketing_opt_out" className="switch" defaultChecked={c.marketing_opt_out} />
        </label>
      </DirtyForm>
      {c.user_id && <p className="text-xs text-g3 mt-2 px-1">Tiene cuenta en la app.</p>}

      <h2 className="display text-2xl mt-8 mb-3">Detalles técnicos</h2>
      <ClientNotes id={c.id} initial={c.notes} />

      <h2 className="display text-2xl mt-8 mb-3">Fotos</h2>
      <ClientPhotos clientId={c.id} photos={photos} />

      <h2 className="display text-2xl mt-8 mb-3">Historial</h2>
      {appts.length === 0 ? <p className="text-g4 card py-8 text-center">Sin citas.</p> : (
        <ul className="card divide-y divide-g2">
          {appts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block font-medium truncate">{fmt(a.starts_at, "d MMM yyyy · HH:mm")}</span>
                <span className="block text-sm text-g4 truncate">{a.appointment_services.map((x) => x.services.name).join(" + ")}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block font-medium tabular-nums">{euro(a.total_cents)}</span>
                <span className={`block text-xs ${a.status === "completed" ? "text-ink" : "text-g3"}`}>{STATUS[a.status] ?? a.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminSub>
  );
}
