import Link from "next/link";
import { Back } from "@/components/Icons";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { supabaseServer } from "@/lib/supabase/server";
import { localToDate, todayMadrid, fmt, euro } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";
import { adminAddHours, adminBlock, adminDeleteHours, adminSetStatus, adminUnblock, adminUpdateService } from "@/app/actions";

const DAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function Admin({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/reservar");

  const view = (await searchParams).v === "week" ? "week" : "day";
  const today = todayMadrid();
  const from = localToDate(today, "00:00");
  const to = addDays(from, view === "week" ? 7 : 1);
  const [{ data: appts }, { data: blocks }, { data: services }, { data: hours }] = await Promise.all([
    sb.from("appointments").select("id,starts_at,total_cents,status,note,profiles(full_name,phone),appointment_services(services(name))")
      .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at"),
    sb.from("blocked_slots").select("id,during,reason").order("during"),
    sb.from("services").select("*").order("sort"),
    sb.from("business_hours").select("*").order("weekday").order("opens"),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-16">
      <div className="flex items-center justify-between mb-6">
        <Link href="/perfil" className="link"><Back />Perfil</Link>
        <span className="display text-xl font-semibold">Panel</span>
      </div>

      <div className="grid grid-cols-2 border-b border-g2 mb-5" role="tablist">
        <Link role="tab" aria-selected={view === "day"} href="/admin" className={`h-12 grid place-items-center text-sm ${view === "day" ? "border-b-2 border-ink font-medium" : "text-g4"}`}>Hoy</Link>
        <Link role="tab" aria-selected={view === "week"} href="/admin?v=week" className={`h-12 grid place-items-center text-sm ${view === "week" ? "border-b-2 border-ink font-medium" : "text-g4"}`}>Semana</Link>
      </div>

      <ul className="flex flex-col gap-3">
        {(appts ?? []).length === 0 && <li className="text-g4 text-center py-6">Sin citas.</li>}
        {(appts ?? []).map((a) => {
          const prof = a.profiles as unknown as { full_name: string; phone: string | null } | null;
          const svc = (a.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + ");
          return (
            <li key={a.id} className="card p-4">
              <div className="flex justify-between"><span className="font-medium first-letter:uppercase">{fmt(a.starts_at, "EEE d MMM · HH:mm")}</span><span className="text-xs text-g4">{a.status}</span></div>
              <p>{prof?.full_name} {prof?.phone && <a className="link" href={`tel:${prof.phone}`}>{prof.phone}</a>}</p>
              <p className="text-sm text-g4">{svc} · {euro(a.total_cents)}</p>
              {a.note && <p className="text-sm mt-1">“{a.note}”</p>}
              {a.status === "confirmed" && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {(["completed", "no_show", "cancelled"] as const).map((st) => (
                    <form key={st} action={async () => { "use server"; await adminSetStatus(a.id, st); }}>
                      <button className="btn btn-secondary !min-h-11 !px-4 text-sm">{st === "completed" ? "Completada" : st === "no_show" ? "No vino" : "Cancelar"}</button>
                    </form>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="display text-2xl mt-10 mb-3">Bloquear</h2>
      <form action={adminBlock} className="flex flex-col gap-2">
        <input className="field" type="date" name="day" min={today} required aria-label="Día" />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" type="time" name="from" aria-label="Desde (vacío = todo el día)" />
          <input className="field" type="time" name="to" aria-label="Hasta" />
        </div>
        <input className="field" name="reason" placeholder="Motivo (opcional)" />
        <button className="btn btn-primary">Bloquear</button>
      </form>
      <ul className="mt-3 flex flex-col gap-2">
        {(blocks ?? []).map((b) => {
          const m = String(b.during).match(/[\["(]+"?([^",]+)"?,"?([^")\]]+)"?[)\]]/);
          const label = m ? `${formatInTimeZone(new Date(m[1]), "Europe/Madrid", "d MMM HH:mm")} – ${formatInTimeZone(new Date(m[2]), "Europe/Madrid", "d MMM HH:mm")}` : String(b.during);
          return (
            <li key={b.id} className="card p-3 flex justify-between items-center text-sm">
              <span>{label} {b.reason && <span className="text-g4">· {b.reason}</span>}</span>
              <form action={async () => { "use server"; await adminUnblock(b.id); }}><button className="link">Quitar</button></form>
            </li>
          );
        })}
      </ul>

      <h2 className="display text-2xl mt-10 mb-3">Servicios</h2>
      <ul className="flex flex-col gap-2">
        {(services ?? []).map((s) => (
          <li key={s.id}>
            <form action={adminUpdateService} className="card p-3 grid grid-cols-[1fr_5rem_5rem] gap-2 items-center">
              <input type="hidden" name="id" value={s.id} />
              <span className="text-sm col-span-3">{s.name}</span>
              <label className="text-xs text-g4">€<input className="field !min-h-11" name="price" type="number" step="0.5" min="0" defaultValue={s.price_cents / 100} /></label>
              <label className="text-xs text-g4">min<input className="field !min-h-11" name="duration" type="number" min="5" step="5" defaultValue={s.duration_min} /></label>
              <label className="text-xs flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={s.active} /> activo</label>
              <button className="btn btn-secondary !min-h-11 col-span-3 text-sm">Guardar</button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="display text-2xl mt-10 mb-3">Horario semanal</h2>
      <ul className="flex flex-col gap-1">
        {(hours ?? []).map((h) => (
          <li key={h.id} className="flex justify-between items-center text-sm min-h-11">
            <span>{DAYS[h.weekday]} {h.opens.slice(0, 5)}–{h.closes.slice(0, 5)}</span>
            <form action={async () => { "use server"; await adminDeleteHours(h.id); }}><button className="link">Quitar</button></form>
          </li>
        ))}
      </ul>
      <form action={adminAddHours} className="grid grid-cols-3 gap-2 mt-2">
        <select className="field" name="weekday" aria-label="Día">{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
        <input className="field" type="time" name="opens" required aria-label="Abre" />
        <input className="field" type="time" name="closes" required aria-label="Cierra" />
        <button className="btn btn-secondary col-span-3">Añadir franja</button>
      </form>
    </main>
  );
}
