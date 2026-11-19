import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { supabaseServer } from "@/lib/supabase/server";
import { localToDate, todayMadrid, fmt, euro, TZ } from "@/lib/time";
import { adminSetStatus } from "@/app/actions";
import { Back, Next } from "@/components/Icons";
import AdminDate from "@/components/AdminDate";
import AttendanceMenu from "@/components/AttendanceMenu";

const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const shift = (day: string, n: number) => formatInTimeZone(addDays(new Date(`${day}T12:00:00Z`), n), TZ, "yyyy-MM-dd");
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayLabel = (d: string, today: string) =>
  d === today ? "Hoy" : d === shift(today, 1) ? "Mañana" : d === shift(today, -1) ? "Ayer" : fmt(localToDate(d, "12:00"), "EEEE");
const waLink = (phone: string) => {
  const n = phone.replace(/\D/g, "");
  return `https://wa.me/${n.length === 9 ? "34" + n : n}`;
};
const who = (a: Appt) => ({ name: a.contact_name || a.profiles?.full_name || "Cliente", phone: a.contact_phone || a.profiles?.phone || null });
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

type Appt = {
  id: string; user_id: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null; starts_at: string; ends_at: string; total_cents: number; status: string; note: string | null;
  profiles: { full_name: string; phone: string | null } | null;
  appointment_services: { services: { name: string } }[];
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ d?: string; v?: string }> }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/admin/agenda");
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/reservar");

  const sp = await searchParams;
  const today = todayMadrid();
  const day = isDay(sp.d) ? sp.d! : today;
  const view = sp.v === "week" ? "week" : "day";
  const dow = Number(formatInTimeZone(localToDate(day, "12:00"), TZ, "i"));
  const weekStart = shift(day, 1 - dow);
  const stripStart = shift(day, -3);

  const rangeFrom = localToDate(shift(day, -10), "00:00");
  const rangeTo = localToDate(shift(day, 21), "00:00");
  const [{ data: raw }, { data: hours }] = await Promise.all([
    sb.from("appointments")
      .select("id,user_id,contact_name,contact_phone,contact_email,starts_at,ends_at,total_cents,status,note,profiles(full_name,phone),appointment_services(services(name))")
      .gte("starts_at", rangeFrom.toISOString()).lt("starts_at", rangeTo.toISOString()).order("starts_at"),
    sb.from("business_hours").select("weekday,opens,closes").order("opens"),
  ]);
  const all = (raw ?? []) as unknown as Appt[];
  const dayOf = (a: Appt) => formatInTimeZone(a.starts_at, TZ, "yyyy-MM-dd");
  const live = (a: Appt) => a.status === "confirmed" || a.status === "completed";
  const countBy = new Map<string, number>();
  for (const a of all) if (live(a)) countBy.set(dayOf(a), (countBy.get(dayOf(a)) ?? 0) + 1);

  const list = all.filter((a) => dayOf(a) === day);
  const active = list.filter(live);
  const revenue = active.reduce((s, a) => s + a.total_cents, 0);
  const windows = (hours ?? []).filter((h) => h.weekday === dow).map((h) => ({ o: mins(h.opens), c: mins(h.closes) }));
  const openMin = windows.reduce((s, w) => s + (w.c - w.o), 0);
  const bookedMin = active.reduce((s, a) => s + (+new Date(a.ends_at) - +new Date(a.starts_at)) / 60000, 0);
  const freeMin = Math.max(0, openMin - bookedMin);
  const occupancy = openMin ? Math.min(100, Math.round((bookedMin / openMin) * 100)) : 0;
  const nowMs = Date.now();
  const next = day === today ? list.find((a) => a.status === "confirmed" && +new Date(a.ends_at) > nowMs) : list.find((a) => a.status === "confirmed");


  const q = (d: string, v = view) => `/admin/agenda?d=${d}${v === "week" ? "&v=week" : ""}`;
  const step = view === "week" ? 7 : 1;
  const strip = Array.from({ length: 14 }, (_, i) => shift(stripStart, i));
  const title = view === "week" ? "Semana" : dayLabel(day, today);
  const sub = view === "week"
    ? `${fmt(localToDate(weekStart, "12:00"), "d MMM")} – ${fmt(localToDate(shift(weekStart, 6), "12:00"), "d MMM")}`
    : fmt(localToDate(day, "12:00"), "d 'de' MMMM yyyy");

  const card = (a: Appt, prev?: Appt) => {
    const svc = a.appointment_services.map((s) => s.services.name).join(" + ");
    const open = a.status === "confirmed";
    const pending = open && +new Date(a.ends_at) <= nowMs;
    const over = !open || pending;
    const isNow = day === today && open && +new Date(a.starts_at) <= nowMs && +new Date(a.ends_at) > nowMs;
    const gap = prev ? Math.round((+new Date(a.starts_at) - +new Date(prev.ends_at)) / 60000) : 0;
    const gapOk = prev && gap >= 15 && windows.some((w) => {
      const pe = mins(fmt(prev.ends_at, "HH:mm")), st = mins(fmt(a.starts_at, "HH:mm"));
      return pe >= w.o && st <= w.c;
    });
    return (
      <li key={a.id}>
        {gapOk && (
          <div className="rail py-2">
            <span className="rail-time mono !top-2.5 opacity-0">.</span>
            <p className="text-sm text-g3 border border-dashed border-g2 rounded-xl px-3 py-2">Libre · {hm(gap)}</p>
          </div>
        )}
        <div className={`rail py-2 ${isNow ? "now" : ""}`}>
          <span className="rail-time mono">{fmt(a.starts_at, "HH:mm")}</span>
          <span className="rail-dot" />
          <div className={`card relative overflow-hidden ${isNow ? "border-ink" : ""}`}>
            <div className={`p-4 ${over ? "blur-[6px] opacity-60 select-none pointer-events-none min-h-36" : ""}`} aria-hidden={over || undefined} inert={over || undefined}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{who(a).name}</p>
                  <p className="text-sm text-g4">{svc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium">{euro(a.total_cents)}</p>
                  <p className="text-xs text-g3 mono">{fmt(a.starts_at, "HH:mm")}–{fmt(a.ends_at, "HH:mm")}</p>
                </div>
              </div>
              {isNow && <p className="text-sm mt-2 font-medium">En curso</p>}
              {a.note && <p className="text-sm mt-3 text-g4">“{a.note}”</p>}
              {open && !over && (
                <AttendanceMenu contactHref={who(a).phone ? waLink(who(a).phone!) : undefined}>
                  <form action={async () => { "use server"; await adminSetStatus(a.id, "completed"); }}><button className="w-full text-left px-3 min-h-11 rounded-xl hover:bg-tint text-sm font-medium">Sí, ha venido</button></form>
                  <form action={async () => { "use server"; await adminSetStatus(a.id, "no_show"); }}><button className="w-full text-left px-3 min-h-11 rounded-xl hover:bg-tint text-sm">No vino</button></form>
                  <form action={async () => { "use server"; await adminSetStatus(a.id, "cancelled"); }}><button className="w-full text-left px-3 min-h-11 rounded-xl hover:bg-tint text-sm text-g4">Cancelar cita</button></form>
                </AttendanceMenu>
              )}
            </div>
            {over && (
              <div className="absolute inset-0 grid place-items-center p-4 text-center">
                {pending ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <p className="font-medium">Pendiente de confirmar asistencia</p>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <form action={async () => { "use server"; await adminSetStatus(a.id, "completed"); }}><button className="btn btn-primary !min-h-11 text-sm w-full">Sí ha venido</button></form>
                      <form action={async () => { "use server"; await adminSetStatus(a.id, "no_show"); }}><button className="btn btn-secondary !min-h-11 text-sm w-full">No vino</button></form>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    {a.status === "completed" && (
                      <svg width="48" height="48" viewBox="0 0 88 88" aria-hidden="true" className="mb-1">
                        <circle cx="44" cy="44" r="40" fill="none" stroke="currentColor" strokeWidth="3" pathLength="1" className="draw" />
                        <path d="M27 45l12 12 22-26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="draw draw-late" />
                      </svg>
                    )}
                    <p className="display text-2xl">{a.status === "completed" ? "Ya se ha pelado" : a.status === "no_show" ? "No vino" : "Cancelada"}</p>
                    {(a.status === "completed" || a.status === "no_show") && <form action={async () => { "use server"; await adminSetStatus(a.id, "confirmed"); }}><button className="link text-sm !min-h-9">Reabrir</button></form>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  const timeline = list;
  const minsUntil = next ? Math.max(0, Math.round((+new Date(next.starts_at) - nowMs) / 60000)) : 0;

  return (
    <main className="dash px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-20">
      <header className="flex items-center justify-between mb-6 sm:mb-8">
        <Link href="/admin" className="link"><Back />Panel</Link>
        <span className="display text-xl">DouceCreative</span>
        <div className="flex items-center gap-2">
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-4xl sm:text-5xl first-letter:uppercase">{title}</h1>
          <p className="text-g4 mt-1 first-letter:uppercase">{sub}</p>
        </div>
        <AdminDate value={day} view={view} today={today} counts={Object.fromEntries(countBy)} />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Link href={q(shift(day, -step))} aria-label="Anterior" className="chip !size-10 !p-0 justify-center shrink-0"><Back /></Link>
        <nav aria-label="Días" className="dstrip">
          {strip.map((d) => {
            const n = countBy.get(d) ?? 0;
            return (
              <Link key={d} href={q(d, "day")} className={`dchip ${d === today ? "is-today" : ""}`} aria-current={d === day && view === "day" ? "date" : undefined}>
                <small>{fmt(localToDate(d, "12:00"), "EEEEE").toUpperCase()}</small>
                <b>{Number(d.slice(8))}</b>
                <i aria-label={n ? `${n} ${n === 1 ? "cita" : "citas"}` : undefined}>{Array.from({ length: Math.min(n, 4) }, (_, k) => <span key={k} />)}</i>
              </Link>
            );
          })}
        </nav>
        <Link href={q(shift(day, step))} aria-label="Siguiente" className="chip !size-10 !p-0 justify-center shrink-0"><Next /></Link>
      </div>

      <div className="seg mt-5 sm:max-w-xs" role="tablist">
        <Link role="tab" aria-selected={view === "day"} href={q(day, "day")}>Día</Link>
        <Link role="tab" aria-selected={view === "week"} href={q(day, "week")}>Semana</Link>
      </div>

      {view === "day" ? (
        <div className="mt-6 sm:mt-8 grid gap-6 lg:gap-10 lg:grid-cols-[1fr_22rem] items-start">
          <section aria-label="Agenda">
            {timeline.length === 0 ? (
              <div className="card py-16 text-center">
                <p className="display text-3xl">Día libre</p>
                <p className="text-g4 mt-1">No hay citas {day === today ? "hoy" : "este día"}.</p>
              </div>
            ) : (
              <ul>{timeline.map((a, i) => card(a, timeline[i - 1]))}</ul>
            )}
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 order-first lg:order-last">
            {next && (
              <div className="rounded-3xl bg-ink text-paper p-5 sm:p-6">
                <p className="text-sm opacity-60">{day === today && minsUntil > 0 ? `Siguiente · en ${hm(minsUntil)}` : day === today ? "Siguiente · ahora" : "Primera cita"}</p>
                <p className="display text-4xl sm:text-5xl mt-1 mono !font-medium">{fmt(next.starts_at, "HH:mm")}</p>
                <p className="mt-3 text-lg">{who(next).name}</p>
                <p className="opacity-60 text-sm">{next.appointment_services.map((s) => s.services.name).join(" + ")}</p>
              </div>
            )}
            <div className="card p-4 sm:p-5 grid grid-cols-2 gap-y-4 sm:gap-y-5 gap-x-4">
              <div><p className="text-sm text-g3">Citas</p><p className="display text-2xl sm:text-3xl">{active.length}</p></div>
              <div><p className="text-sm text-g3">Ingresos</p><p className="display text-2xl sm:text-3xl">{euro(revenue)}</p></div>
              <div><p className="text-sm text-g3">Ocupación</p><p className="display text-2xl sm:text-3xl">{occupancy}%</p></div>
              <div><p className="text-sm text-g3">Libre</p><p className="display text-2xl sm:text-3xl">{openMin ? hm(freeMin) : "Cerrado"}</p></div>
              <div className="col-span-2 h-1.5 rounded-full bg-tint2 overflow-hidden" role="img" aria-label={`Ocupación ${occupancy}%`}>
                <div className="h-full bg-ink rounded-full" style={{ width: `${occupancy}%` }} />
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <section className="mt-6 sm:mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Semana">
          {Array.from({ length: 7 }, (_, i) => shift(weekStart, i)).map((d) => {
            const items = all.filter((a) => dayOf(a) === d && live(a));
            const rev = items.reduce((s, a) => s + a.total_cents, 0);
            return (
              <Link key={d} href={q(d, "day")} className={`card p-4 transition-colors hover:border-ink ${d === today ? "border-ink" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <p className="display text-xl first-letter:uppercase">{fmt(localToDate(d, "12:00"), "EEE d")}</p>
                  <p className="text-sm text-g3">{items.length ? euro(rev) : ""}</p>
                </div>
                {items.length === 0 ? <p className="text-sm text-g3 mt-3">Sin citas</p> : (
                  <ul className="mt-3 flex flex-col gap-1 text-sm">
                    {items.slice(0, 6).map((a) => (
                      <li key={a.id} className="flex gap-2"><span className="mono text-g3">{fmt(a.starts_at, "HH:mm")}</span><span className="truncate">{who(a).name}</span></li>
                    ))}
                    {items.length > 6 && <li className="text-g3">+{items.length - 6} más</li>}
                  </ul>
                )}
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
