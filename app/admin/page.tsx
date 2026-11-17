import Link from "next/link";
import { Back, Chevron, Close } from "@/components/Icons";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { supabaseServer } from "@/lib/supabase/server";
import { localToDate, todayMadrid, fmt, euro } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";
import { adminAddHours, adminBlock, adminDeleteHours, adminSetStatus, adminUnblock, adminUpdateService } from "@/app/actions";

const DAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const STATUS: Record<string, string> = { confirmed: "Confirmada", completed: "Completada", no_show: "No vino", cancelled: "Cancelada" };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <details className="card group mt-3">
      <summary className="flex items-center justify-between gap-3 p-4 min-h-14">
        <span>
          <span className="block font-medium">{title}</span>
          {hint && <span className="block text-sm text-g3">{hint}</span>}
        </span>
        <span className="text-g3 transition-transform group-open:rotate-180"><Chevron /></span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

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
  const list = appts ?? [];
  const pending = list.filter((a) => a.status === "confirmed").length;

  return (
    <main className="mx-auto max-w-md px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-16">
      <div className="flex items-center justify-between mb-6">
        <Link href="/perfil" className="link"><Back />Perfil</Link>
        <span className="display text-xl font-semibold">Panel</span>
      </div>

      <div className="seg" role="tablist">
        <Link role="tab" aria-selected={view === "day"} href="/admin">Hoy</Link>
        <Link role="tab" aria-selected={view === "week"} href="/admin?v=week">Semana</Link>
      </div>
      <p className="mono text-xs text-g3 mt-3 mb-4">{list.length === 0 ? "Sin citas" : `${pending} por atender · ${list.length} en total`}</p>

      <ul className="flex flex-col gap-3">
        {list.length === 0 && (
          <li className="card py-10 text-center">
            <p className="display text-2xl">Todo tranquilo</p>
            <p className="text-sm text-g3 mt-1">No hay citas {view === "week" ? "esta semana" : "hoy"}.</p>
          </li>
        )}
        {list.map((a) => {
          const prof = a.profiles as unknown as { full_name: string; phone: string | null } | null;
          const svc = (a.appointment_services as unknown as { services: { name: string } }[]).map((s) => s.services.name).join(" + ");
          const open = a.status === "confirmed";
          return (
            <li key={a.id} className={`card p-4 ${open ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono text-2xl leading-none">{fmt(a.starts_at, "HH:mm")}</p>
                  {view === "week" && <p className="mono text-xs text-g3 mt-1 first-letter:uppercase">{fmt(a.starts_at, "EEE d MMM")}</p>}
                </div>
                <span className={`mono text-xs px-2 py-1 rounded-md border ${open ? "bg-ink text-paper border-ink" : "border-g2 text-g4"}`}>{STATUS[a.status] ?? a.status}</span>
              </div>
              <p className="mt-3 font-medium">{prof?.full_name}</p>
              <p className="text-sm text-g4">{svc} · {euro(a.total_cents)}</p>
              {prof?.phone && <a className="link text-sm !min-h-9" href={`tel:${prof.phone}`}>{prof.phone}</a>}
              {a.note && <p className="text-sm mt-2 text-g4">“{a.note}”</p>}
              {open && (
                <div className="flex items-center gap-2 mt-3">
                  <form action={async () => { "use server"; await adminSetStatus(a.id, "completed"); }} className="flex-1">
                    <button className="btn btn-primary !min-h-11 text-sm">Completada</button>
                  </form>
                  <form action={async () => { "use server"; await adminSetStatus(a.id, "no_show"); }}>
                    <button className="btn btn-secondary !min-h-11 !px-4 text-sm">No vino</button>
                  </form>
                  <form action={async () => { "use server"; await adminSetStatus(a.id, "cancelled"); }}>
                    <button className="btn btn-secondary !min-h-11 !px-4 text-sm">Cancelar</button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="mono text-xs text-g3 mt-10 mb-1 uppercase tracking-wider">Ajustes</h2>

      <Section title="Servicios y precios" hint={`${(services ?? []).filter((s) => s.active).length} activos`}>
        <ul className="flex flex-col gap-3">
          {(services ?? []).map((s) => (
            <li key={s.id}>
              <form action={adminUpdateService} className="rounded-xl bg-white/[.03] p-3 flex flex-col gap-3">
                <input type="hidden" name="id" value={s.id} />
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{s.name}</span>
                  <label className="flex items-center gap-2 text-sm text-g4">
                    <span>Activo</span>
                    <input type="checkbox" className="switch" name="active" defaultChecked={s.active} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs text-g3 mb-1">Precio</span>
                    <span className="unit"><input className="field" name="price" type="number" step="0.5" min="0" defaultValue={s.price_cents / 100} /><span>€</span></span>
                  </label>
                  <label className="block">
                    <span className="block text-xs text-g3 mb-1">Duración</span>
                    <span className="unit"><input className="field" name="duration" type="number" min="5" step="5" defaultValue={s.duration_min} /><span>min</span></span>
                  </label>
                </div>
                <button className="btn btn-secondary !min-h-11 text-sm">Guardar</button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Horario semanal" hint="Franjas en las que se puede reservar">
        <ul className="flex flex-col gap-1">
          {DAYS.slice(1).map((name, i) => {
            const slots = (hours ?? []).filter((h) => h.weekday === i + 1);
            return (
              <li key={name} className="flex items-start justify-between gap-3 min-h-11 py-1.5">
                <span className={`text-sm pt-1.5 ${slots.length ? "" : "text-g3"}`}>{name}</span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {slots.length === 0 && <span className="text-sm text-g3 pt-1.5">Cerrado</span>}
                  {slots.map((h) => (
                    <form key={h.id} action={async () => { "use server"; await adminDeleteHours(h.id); }}>
                      <button className="chip mono hover:bg-white/10" aria-label={`Quitar ${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`}>
                        {h.opens.slice(0, 5)}–{h.closes.slice(0, 5)}<Close />
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <form action={adminAddHours} className="grid grid-cols-[1fr_1fr] gap-2 mt-4">
          <select className="field col-span-2" name="weekday" aria-label="Día">{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
          <input className="field" type="time" name="opens" required aria-label="Abre" />
          <input className="field" type="time" name="closes" required aria-label="Cierra" />
          <button className="btn btn-secondary col-span-2 !min-h-11 text-sm">Añadir franja</button>
        </form>
      </Section>

      <Section title="Bloquear horas o días" hint={(blocks ?? []).length ? `${(blocks ?? []).length} bloqueos` : "Vacaciones, descansos…"}>
        <form action={adminBlock} className="flex flex-col gap-2">
          <input className="field" type="date" name="day" min={today} required aria-label="Día" />
          <div className="grid grid-cols-2 gap-2">
            <input className="field" type="time" name="from" aria-label="Desde (vacío = todo el día)" />
            <input className="field" type="time" name="to" aria-label="Hasta" />
          </div>
          <p className="text-xs text-g3">Deja las horas vacías para bloquear el día entero.</p>
          <input className="field" name="reason" placeholder="Motivo (opcional)" />
          <button className="btn btn-secondary !min-h-11 text-sm">Bloquear</button>
        </form>
        {(blocks ?? []).length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {(blocks ?? []).map((b) => {
              const m = String(b.during).match(/[\["(]+"?([^",]+)"?,"?([^")\]]+)"?[)\]]/);
              const label = m ? `${formatInTimeZone(new Date(m[1]), "Europe/Madrid", "d MMM HH:mm")} – ${formatInTimeZone(new Date(m[2]), "Europe/Madrid", "d MMM HH:mm")}` : String(b.during);
              return (
                <li key={b.id} className="flex justify-between items-center gap-3 text-sm rounded-xl bg-white/[.03] px-3 py-2">
                  <span><span className="mono">{label}</span>{b.reason && <span className="block text-g3">{b.reason}</span>}</span>
                  <form action={async () => { "use server"; await adminUnblock(b.id); }}><button className="chip hover:bg-white/10" aria-label="Quitar bloqueo"><Close /></button></form>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </main>
  );
}
