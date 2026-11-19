import Link from "next/link";
import AdminSub from "@/components/AdminSub";
import { Back, Next } from "@/components/Icons";
import { requireAdmin } from "@/lib/adminGuard";
import {
  VIEWS, addDays, bestBucket, billingHref, bounds, canGoNext, clampDays, countNew, dayOf, delta, elapsedRange,
  inRange, isCurrent, lastYearPeriod, parseDay, periodOf, previousPeriod, revenueByDay, revenueSeries, serviceBreakdown,
  shiftPeriod, stats, type BillAppt, type Delta, type Period, type Stats, type View,
} from "@/lib/billing";
import { euro, fmt, localToDate, todayMadrid } from "@/lib/time";
import Calendar from "./Calendar";
import { fetchAll } from "./data";

type Row = BillAppt & {
  contact_name: string | null; profiles: { full_name: string } | null;
  appointment_services: { price_cents: number; services: { name: string } }[];
};
type SP = { v?: string; d?: string; m?: string; y?: string; cm?: string };

const LEAN = "id,starts_at,ends_at,total_cents,status,client_id,contact_email,user_id";
const FULL = `${LEAN},contact_name,profiles(full_name),appointment_services(price_cents,services(name))`;
const LIST_CAP = 300;

const VIEW_LABEL: Record<View, string> = { dia: "Día", semana: "Semana", mes: "Mes", anio: "Año" };
const PREV_LABEL: Record<View, string> = { dia: "Día anterior", semana: "Semana anterior", mes: "Mes anterior", anio: "Año anterior" };
const YEAR_LABEL: Record<View, string> = { dia: "Mismo día del año pasado", semana: "Misma semana del año pasado", mes: "Mismo mes del año pasado", anio: "Año anterior" };
const HERO_LABEL: Record<View, string> = { dia: "Ingresos del día", semana: "Ingresos de la semana", mes: "Ingresos del mes", anio: "Ingresos del año" };
const dayName = (d: string, f: string) => fmt(localToDate(d, "12:00"), f);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function periodName(p: Period, today: string) {
  switch (p.view) {
    case "dia": return p.start === today ? "Hoy" : cap(dayName(p.start, "EEEE d 'de' MMMM yyyy"));
    case "semana": return `${dayName(p.start, "d MMM")} – ${dayName(addDays(p.end, -1), "d MMM yyyy")}`;
    case "mes": return cap(dayName(p.start, "LLLL yyyy"));
    case "anio": return p.start.slice(0, 4);
  }
}
const shortName = (p: Period) => {
  switch (p.view) {
    case "dia": return dayName(p.start, "d MMM yyyy");
    case "semana": return `${dayName(p.start, "d MMM")} – ${dayName(addDays(p.end, -1), "d MMM yyyy")}`;
    case "mes": return cap(dayName(p.start, "LLLL yyyy"));
    case "anio": return p.start.slice(0, 4);
  }
};

const ArrowUp = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
const ArrowDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
const Flat = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>;

function DeltaView({ d, kind }: { d: Delta | null; kind: "euro" | "n" }) {
  if (!d) return <span className="text-g3">—</span>;
  const up = d.abs > 0, down = d.abs < 0;
  const abs = kind === "euro" ? euro(Math.abs(d.abs)) : String(Math.abs(d.abs));
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${up ? "text-ink font-medium" : "text-g4"}`}>
      {up ? <ArrowUp /> : down ? <ArrowDown /> : <Flat />}
      <span className="sr-only">{up ? "sube" : down ? "baja" : "igual"}</span>
      {up ? "+" : down ? "−" : ""}{abs}
      <span className="text-g3 font-normal"> · {d.pct == null ? "—" : `${d.pct > 0 ? "+" : d.pct < 0 ? "−" : ""}${Math.abs(Math.round(d.pct))} %`}</span>
    </span>
  );
}

function Compare({ title, sub, cur, base }: { title: string; sub: string; cur: Stats; base: Stats }) {
  const rows: { label: string; value: string; d: Delta | null; kind: "euro" | "n" }[] = [
    { label: "Ingresos", value: euro(base.revenue), d: delta(cur.revenue, base.revenue), kind: "euro" },
    { label: "Citas cobradas", value: String(base.paid), d: delta(cur.paid, base.paid), kind: "n" },
    { label: "Ticket medio", value: base.avgTicket == null ? "—" : euro(base.avgTicket), d: delta(cur.avgTicket, base.avgTicket), kind: "euro" },
    { label: "Clientes", value: String(base.clients), d: delta(cur.clients, base.clients), kind: "n" },
  ];
  return (
    <section className="card p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-g3 mb-2">{sub}</p>
      <dl className="divide-y divide-g2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] gap-x-3 py-2.5 items-baseline">
            <dt className="text-sm text-g4">{r.label}</dt>
            <dd className="text-sm text-right tabular-nums"><DeltaView d={r.d} kind={r.kind} /></dd>
            <dd className="col-span-2 text-xs text-g3 tabular-nums -mt-0.5">antes: {r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-g3">{label}</p>
      <p className="display text-2xl mt-0.5 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-g3 mt-0.5">{hint}</p>}
    </div>
  );
}

export default async function Facturacion({ searchParams }: { searchParams: Promise<SP> }) {
  const sb = await requireAdmin("/admin/facturacion");
  const sp = await searchParams;
  const today = todayMadrid();
  const nowMs = Date.now();

  const view: View = VIEWS.includes(sp.v as View) ? (sp.v as View) : "mes";
  let anchor = today;
  if (view === "dia" || view === "semana") anchor = parseDay(sp.d) ?? today;
  else if (view === "mes") anchor = parseDay(`${sp.m}-01`) ?? today;
  else anchor = parseDay(`${sp.y}-01-01`) ?? today;
  if (anchor > today) anchor = today;

  const p = periodOf(view, anchor);
  const prevP = previousPeriod(p);
  const yearP = lastYearPeriod(p);
  const el = elapsedRange(p, today);
  const current = isCurrent(p, today);

  const range = (q: Period) => { const b = bounds(q); return { from: b.from.toISOString(), to: b.to.toISOString() }; };
  const cm = /^\d{4}-\d{2}$/.test(sp.cm ?? "") && parseDay(`${sp.cm}-01`) && sp.cm! <= today.slice(0, 7)
    ? sp.cm!
    : view === "anio" && current ? today.slice(0, 7) : anchor.slice(0, 7);
  const cmP = periodOf("mes", `${cm}-01`);

  const [cur, prev, ly, firstVisits, calRows] = await Promise.all([
    fetchAll<Row>((a, b) => { const r = range(p); return sb.from("appointments").select(FULL).gte("starts_at", r.from).lt("starts_at", r.to).order("starts_at", { ascending: false }).range(a, b); }),
    fetchAll<BillAppt>((a, b) => { const r = range(prevP); return sb.from("appointments").select(LEAN).gte("starts_at", r.from).lt("starts_at", r.to).order("starts_at").range(a, b); }),
    view === "anio" ? Promise.resolve<BillAppt[]>([]) : fetchAll<BillAppt>((a, b) => { const r = range(yearP); return sb.from("appointments").select(LEAN).gte("starts_at", r.from).lt("starts_at", r.to).order("starts_at").range(a, b); }),
    fetchAll<{ first_visit: string }>((a, b) => sb.from("client_stats").select("first_visit").not("first_visit", "is", null).order("id").range(a, b)),
    fetchAll<{ starts_at: string; total_cents: number }>((a, b) => { const r = range(cmP); return sb.from("appointments").select("starts_at,total_cents").eq("status", "completed").gte("starts_at", r.from).lt("starts_at", r.to).order("starts_at").range(a, b); }),
  ]);

  const firsts = firstVisits.map((f) => f.first_visit);
  // Comparaciones justas: mismos días transcurridos en cada periodo (todo el periodo si ya terminó).
  const curR = el.range, prevR = clampDays(prevP, el.days), yearR = clampDays(yearP, el.days);
  const sCur = stats(cur.filter((a) => inRange(a, curR)), nowMs);
  const sPrev = stats(prev.filter((a) => inRange(a, prevR)), nowMs);
  const sYear = stats(ly.filter((a) => inRange(a, yearR)), nowMs);
  const sAll = stats(cur, nowMs); // KPIs del periodo completo (incluye citas futuras pendientes)
  const sPrevFull = stats(prev, nowMs);
  const newClients = countNew(firsts, p);

  const series = revenueSeries(cur, p);
  const best = bestBucket(series);
  const maxBar = Math.max(1, ...series.map((b) => b.cents));
  const services = serviceBreakdown(cur);
  const maxSvc = Math.max(1, ...services.map((s) => s.cents));
  const paidRows = cur.filter((a) => a.status === "completed");

  const byDay = new Map<string, Row[]>();
  for (const r of paidRows.slice(0, LIST_CAP)) { const d = dayOf(r.starts_at); byDay.set(d, [...(byDay.get(d) ?? []), r]); }

  const partialNote = el.partial ? `mismos ${el.days} ${el.days === 1 ? "día" : "días"} (hasta hoy)` : null;
  const prevSub = `${shortName(prevP)}${partialNote ? ` · ${partialNote}` : ""}`;
  const yearSub = `${shortName(yearP)}${partialNote ? ` · ${partialNote}` : ""}`;

  const here = (v: View) => billingHref(v, current ? today : p.start);
  const prevHref = billingHref(view, shiftPeriod(p, -1).start);
  const nextHref = billingHref(view, shiftPeriod(p, 1).start);
  const bestLabel = best
    ? view === "dia" ? `${best.label}:00 h`
      : view === "anio" ? cap(fmt(localToDate(`${best.key}-01`, "12:00"), "LLLL"))
      : cap(dayName(best.key, "EEEE d MMM"))
    : "—";
  const chartTitle = view === "dia" ? "Ingresos por hora" : view === "anio" ? "Ingresos por mes" : "Ingresos por día";
  const labelEvery = view === "mes" ? 5 : view === "dia" ? 2 : 1;

  return (
    <AdminSub title="Facturación">
      <nav className="seg mb-4" role="tablist" aria-label="Vista">
        {VIEWS.map((v) => <Link key={v} role="tab" aria-selected={v === view} href={here(v)}>{VIEW_LABEL[v]}</Link>)}
      </nav>

      <div className="flex items-center justify-between mb-2">
        <Link href={prevHref} aria-label={`${PREV_LABEL[view]}`} className="size-11 grid place-items-center"><Back /></Link>
        <p className="font-medium text-center" aria-live="polite">{periodName(p, today)}</p>
        {canGoNext(p, today)
          ? <Link href={nextHref} aria-label="Periodo siguiente" className="size-11 grid place-items-center"><Next /></Link>
          : <span className="size-11" />}
      </div>

      <details className="mb-4" open={!!sp.cm || undefined}>
        <summary className="btn btn-secondary !min-h-11 text-sm w-full list-none cursor-pointer [&::-webkit-details-marker]:hidden">Calendario · elegir un día</summary>
        <Calendar month={cm} selected={p} today={today} revenue={Object.fromEntries(revenueByDay(calRows))} view={view} anchor={anchor} />
      </details>

      <div className="rounded-3xl bg-ink text-paper p-6">
        <p className="text-sm opacity-60">{HERO_LABEL[view]}</p>
        <p className="display text-5xl mt-1 tabular-nums">{euro(sAll.revenue)}</p>
        <p className="text-sm opacity-60 mt-3">
          {sAll.paid} {sAll.paid === 1 ? "cita cobrada" : "citas cobradas"}
          {sAll.avgTicket != null && ` · media ${euro(sAll.avgTicket)}`}
        </p>
      </div>
      {sAll.pendingConfirm > 0 && (
        <p className="mt-3 text-sm text-g4 card px-4 py-3">
          {sAll.pendingConfirm} {sAll.pendingConfirm === 1 ? "cita pendiente" : "citas pendientes"} de confirmar asistencia ({euro(sAll.pendingCents)}). Aún no cuentan como ingreso.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Tile label="Citas cobradas" value={String(sAll.paid)} />
        <Tile label="Ticket medio" value={sAll.avgTicket == null ? "—" : euro(sAll.avgTicket)} />
        <Tile label="Clientes únicos" value={String(sAll.clients)} />
        <Tile label="Clientes nuevos" value={String(newClients)} hint="Primera visita en el periodo" />
        <Tile label="No vinieron" value={String(sAll.noShows)} />
        <Tile label="Canceladas" value={String(sAll.cancelled)} />
        <Tile label="Sin confirmar" value={String(sAll.pendingConfirm)} hint="Ya pasaron" />
        <Tile label={view === "dia" ? "Hora más fuerte" : view === "anio" ? "Mejor mes" : "Mejor día"} value={bestLabel} hint={best ? euro(best.cents) : undefined} />
      </div>

      <h2 className="display text-2xl mt-8 mb-3">Comparativa</h2>
      <div className="flex flex-col gap-3">
        <Compare title={`${PREV_LABEL[view]}`} sub={prevSub} cur={sCur} base={sPrev} />
        {view !== "anio" && <Compare title={YEAR_LABEL[view]} sub={yearSub} cur={sCur} base={sYear} />}
      </div>
      {partialNote && (
        <p className="text-xs text-g3 mt-2 px-1">
          Periodo en curso: se compara con los mismos {el.days} {el.days === 1 ? "día" : "días"} de cada periodo. {PREV_LABEL[view]} completo: {euro(sPrevFull.revenue)}.
        </p>
      )}

      <h2 className="display text-2xl mt-8 mb-3">{chartTitle}</h2>
      {best ? (
        <div className="card p-4">
          <div className="flex items-end gap-[3px] h-28" role="img" aria-label={`${chartTitle}. ${series.filter((b) => b.cents > 0).map((b) => `${b.label}: ${euro(b.cents)}`).join(", ")}`}>
            {series.map((b) => (
              <div key={b.key} title={`${b.label}: ${euro(b.cents)}`} className={`flex-1 rounded-t-[3px] ${b.cents ? (b.key === best.key ? "bg-ink" : "bg-g3") : "bg-g2"}`}
                style={{ height: b.cents ? `${Math.max(4, (b.cents / maxBar) * 100)}%` : "2px" }} />
            ))}
          </div>
          <div className="flex gap-[3px] mt-1.5" aria-hidden>
            {series.map((b, i) => <span key={b.key} className="flex-1 text-center text-[10px] text-g3 leading-none overflow-visible">{i % labelEvery === 0 ? b.label : ""}</span>)}
          </div>
        </div>
      ) : <p className="text-g4 card py-8 text-center">Sin ingresos en este periodo.</p>}

      <h2 className="display text-2xl mt-8 mb-3">Ingresos por servicio</h2>
      {services.length === 0 ? <p className="text-g4 card py-8 text-center">Sin datos.</p> : (
        <ul className="card divide-y divide-g2">
          {services.map((s) => (
            <li key={s.name} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium truncate">{s.name} <span className="text-g3 font-normal text-sm">× {s.count}</span></span>
                <span className="tabular-nums shrink-0">{euro(s.cents)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-tint2 mt-2 overflow-hidden"><div className="h-full bg-ink rounded-full" style={{ width: `${(s.cents / maxSvc) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="display text-2xl mt-8 mb-3">Registro de pagos</h2>
      {paidRows.length === 0 ? (
        <p className="text-g4 card py-10 text-center">Sin ingresos en este periodo.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...byDay.entries()].map(([d, list]) => (
            <section key={d}>
              <div className="flex justify-between text-xs text-g3 uppercase tracking-wider mb-2 px-1">
                <span>{dayName(d, "EEEE d MMM")}</span>
                <span className="tabular-nums">{euro(list.reduce((s, r) => s + r.total_cents, 0))}</span>
              </div>
              <ul className="card divide-y divide-g2">
                {list.map((r) => {
                  const name = r.contact_name || r.profiles?.full_name || "Cliente";
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        {r.client_id
                          ? <Link href={`/admin/clientes/${r.client_id}`} className="block font-medium truncate hover:underline underline-offset-4">{name}</Link>
                          : <span className="block font-medium truncate">{name}</span>}
                        <span className="block text-sm text-g4 truncate">{fmt(r.starts_at, "HH:mm")} · {r.appointment_services.map((s) => s.services.name).join(" + ")}</span>
                      </span>
                      <span className="font-medium tabular-nums shrink-0">{euro(r.total_cents)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {paidRows.length > LIST_CAP && <p className="text-xs text-g3 text-center">Mostrando los {LIST_CAP} pagos más recientes de {paidRows.length}.</p>}
        </div>
      )}
    </AdminSub>
  );
}
