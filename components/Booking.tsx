"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { addMonths, addDays, format, getDay, getDaysInMonth, parse } from "date-fns";
import { es } from "date-fns/locale";
import { book, fetchMonth, fetchSlots } from "@/app/actions";
import { euro, todayMadrid } from "@/lib/time";
import { googleCalendarAddUrl, whatsappUrl } from "@/lib/calendar";
import { Alert, Arrow, Back, Check, GoogleCalendar, Next, WhatsApp } from "./Icons";

type Service = { id: string; slug: string; name: string; price_cents: number; duration_min: number; exclusive_group: string | null };
type Saved = { ids: string[]; day: string | null; time: string | null; step: 1 | 2 | 3; note: string };
const KEY = "dc_booking";
const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

export default function Booking({ services, windowDays, loggedIn, calendarConnected }: { services: Service[]; windowDays: number; loggedIn: boolean; calendarConnected: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dir, setDir] = useState(1);
  const [ids, setIds] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; starts_at: string; ends_at: string; services: string; day: string; time: string; calendar: "added" | "failed" | "off" } | null>(null);
  const [pending, start] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [addCal, setAddCal] = useState(true);

  const chosen = services.filter((s) => ids.includes(s.id));
  const total = chosen.reduce((a, s) => a + s.price_cents, 0);
  const duration = chosen.reduce((a, s) => a + s.duration_min, 0);

  // Restaurar selección (p.ej. tras iniciar sesión)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const s: Saved = JSON.parse(raw);
        const valid = s.ids.filter((id) => services.some((x) => x.id === id));
        setIds(valid); setDay(s.day); setTime(s.time); setNote(s.note ?? "");
        setStep(valid.length ? s.step : 1);
      }
    } catch {}
    setHydrated(true);
  }, [services]);
  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ ids, day, time, step, note } satisfies Saved)); } catch {}
  }, [hydrated, ids, day, time, step, note]);

  const go = (s: 1 | 2 | 3) => { setDir(s > step ? 1 : -1); setStep(s); setError(""); };

  function toggle(s: Service) {
    setDay(null); setTime(null);
    setIds((cur) => {
      if (cur.includes(s.id)) return cur.filter((x) => x !== s.id);
      const rest = s.exclusive_group ? cur.filter((x) => services.find((y) => y.id === x)?.exclusive_group !== s.exclusive_group) : cur;
      return [...rest, s.id];
    });
  }

  function confirm() {
    if (!loggedIn) { router.push("/login?next=/reservar"); return; }
    if (!day || !time) return;
    setError("");
    start(async () => {
      const r = await book({ serviceIds: ids, day, time, note, addToCalendar: calendarConnected && addCal });
      if ("error" in r && r.error) {
        setError(r.error);
        if (r.refresh) { setTime(null); go(2); }
        return;
      }
      try { sessionStorage.removeItem(KEY); } catch {}
      setDone({ id: r.id!, starts_at: r.starts_at!, ends_at: r.ends_at!, services: chosen.map((s) => s.name).join(" + "), day, time, calendar: r.calendar ?? "off" });
    });
  }

  if (done) return <Success d={done} />;
  if (!hydrated) return <div className="skeleton h-72 mt-14" aria-busy="true" />;

  const slide = { x: reduce ? 0 : dir * 40, opacity: 0 };
  return (
    <div>
      <Progress step={step} onBack={step > 1 ? () => go((step - 1) as 1 | 2) : undefined} />
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.section key={step} initial={slide} animate={{ x: 0, opacity: 1 }} exit={{ x: reduce ? 0 : -dir * 40, opacity: 0 }} transition={{ duration: 0.3, ease }}>
          {step === 1 && (
            <>
              <h1 className="display text-4xl mb-1">¿Qué te hacemos?</h1>
              <p className="text-g4 mb-6">Elige uno o varios servicios.</p>
              <ul className="flex flex-col gap-3">
                {services.map((s) => {
                  const on = ids.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button aria-pressed={on} onClick={() => toggle(s)}
                        className={`w-full text-left card p-4 min-h-20 flex items-center justify-between transition-colors duration-200 active:scale-[.98] ${on ? "bg-ink text-paper border-ink" : ""}`}>
                        <span>
                          <span className="block font-medium">{s.name}</span>
                          <span className={`text-sm ${on ? "text-g2" : "text-g4"}`}>{s.duration_min} min</span>
                        </span>
                        <span className="display text-2xl">{euro(s.price_cents)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Bar>
                <div className="flex justify-between text-sm mb-2 text-g4"><span>{duration ? `${duration} min` : "Sin servicios"}</span><span className="text-ink font-medium">{euro(total)}</span></div>
                <button className="btn btn-primary" disabled={!ids.length} onClick={() => go(2)}>Elegir fecha <Arrow /></button>
              </Bar>
            </>
          )}
          {step === 2 && (
            <DayTime duration={duration} windowDays={windowDays} day={day} time={time}
              setDay={(d) => { setDay(d); setTime(null); }} setTime={setTime}
              footer={<button className="btn btn-primary" disabled={!day || !time} onClick={() => go(3)}>Continuar <Arrow /></button>} />
          )}
          {step === 3 && day && time && (
            <>
              <h1 className="display text-4xl mb-6">Confirma tu cita</h1>
              <div className="card p-5 flex flex-col gap-4">
                <ul className="flex flex-col gap-1">
                  {chosen.map((s) => <li key={s.id} className="flex justify-between"><span>{s.name}</span><span className="text-g4">{euro(s.price_cents)}</span></li>)}
                </ul>
                <p className="display text-2xl first-letter:uppercase">{format(parse(day, "yyyy-MM-dd", new Date()), "EEEE d 'de' MMMM", { locale: es })}</p>
                <p>{time} · {duration} min</p>
                <p className="flex justify-between font-medium"><span>Total</span><span>{euro(total)}</span></p>
              </div>
              <label className="block mt-5 text-sm text-g4" htmlFor="note">Nota para el peluquero (opcional)</label>
              <textarea id="note" className="field mt-1 py-3 min-h-24" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              {loggedIn && calendarConnected && (
                <label className="flex items-center gap-3 min-h-11 mt-3">
                  <input type="checkbox" className="size-5 accent-white" checked={addCal} onChange={(e) => setAddCal(e.target.checked)} />
                  Añadir a mi Google Calendar
                </label>
              )}
              {error && <p role="alert" className="mt-3 text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />{error}</p>}
              <Bar>
                <button className="btn btn-primary" disabled={pending} onClick={confirm}>{loggedIn ? (pending ? "Reservando…" : "Confirmar cita") : "Entrar para confirmar"} <Arrow /></button>
              </Bar>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

const Bar = ({ children }: { children: React.ReactNode }) => (
  <div className="sticky-bar"><div className="mx-auto max-w-md">{children}</div></div>
);

function Progress({ step, onBack }: { step: number; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6 h-11">
      {onBack ? <button onClick={onBack} aria-label="Paso anterior" className="size-11 -ml-3 grid place-items-center"><Back /></button> : <span className="w-0" />}
      <div className="flex-1 flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={`Paso ${step} de 3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className="h-0.5 flex-1 bg-g2 relative overflow-hidden">
            <motion.span className="absolute inset-0 bg-ink origin-left" initial={false} animate={{ scaleX: n <= step ? 1 : 0 }} transition={{ duration: 0.4, ease }} />
          </span>
        ))}
      </div>
      <span className="text-xs text-g4">{step}/3</span>
    </div>
  );
}

function DayTime(p: { duration: number; windowDays: number; day: string | null; time: string | null; setDay: (d: string) => void; setTime: (t: string) => void; footer: React.ReactNode }) {
  const reduce = useReducedMotion();
  const today = todayMadrid();
  const last = format(addDays(new Date(), p.windowDays), "yyyy-MM-dd");
  const [month, setMonth] = useState(() => (p.day ?? today).slice(0, 7));
  const [open, setOpen] = useState<string[] | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setOpen(null);
    fetchMonth(month, p.duration).then((d) => { if (!off) setOpen(d); });
    return () => { off = true; };
  }, [month, p.duration]);

  const loadSlots = useCallback((d: string) => {
    setSlots(null);
    fetchSlots(d, p.duration).then(setSlots);
  }, [p.duration]);
  useEffect(() => { if (p.day) loadSlots(p.day); else setSlots(null); }, [p.day, loadSlots]);

  useEffect(() => {
    setNext(null);
    if (slots && slots.length === 0 && open) setNext(open.find((d) => p.day && d > p.day) ?? null);
  }, [slots, open, p.day]);

  const first = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const lead = (getDay(first) + 6) % 7;
  const cells = useMemo(() => [...Array(lead).fill(null), ...Array.from({ length: getDaysInMonth(first) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)], [lead, first, month]);
  const shift = (n: number) => setMonth(format(addMonths(first, n), "yyyy-MM"));
  const canPrev = month > today.slice(0, 7);
  const canNext = month < last.slice(0, 7);

  return (
    <>
      <h1 className="display text-4xl mb-6">Elige día y hora</h1>
      <div className="flex items-center justify-between mb-3">
        <button className="size-11 grid place-items-center disabled:opacity-20" disabled={!canPrev} onClick={() => shift(-1)} aria-label="Mes anterior"><Back /></button>
        <p className="first-letter:uppercase font-medium" aria-live="polite">{format(first, "LLLL yyyy", { locale: es })}</p>
        <button className="size-11 grid place-items-center disabled:opacity-20" disabled={!canNext} onClick={() => shift(1)} aria-label="Mes siguiente"><Next /></button>
      </div>
      <motion.div drag={reduce ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} style={{ touchAction: "pan-y" }}
        onDragEnd={(_, i) => { if (i.offset.x < -60 && canNext) shift(1); else if (i.offset.x > 60 && canPrev) shift(-1); }}>
        <div className="grid grid-cols-7 text-center text-xs text-g3 mb-1">{["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1" role="grid">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const ok = !!open?.includes(d);
            const sel = p.day === d;
            return (
              <button key={d} disabled={!ok} aria-pressed={sel} aria-label={format(parse(d, "yyyy-MM-dd", new Date()), "d 'de' MMMM", { locale: es })}
                onClick={() => p.setDay(d)}
                className={`relative h-11 grid place-items-center text-sm rounded-full ${ok ? "" : "text-g3/60"} ${open === null ? "skeleton !rounded-full m-0.5" : ""}`}>
                {sel && <motion.span layoutId="dayPill" className="absolute inset-0 m-auto size-10 rounded-full bg-ink" transition={spring} />}
                <span className={`relative ${sel ? "text-paper" : ""}`}>{Number(d.slice(8))}</span>
                {d === today && <span className={`absolute bottom-1 size-1 rounded-full ${sel ? "bg-paper" : "bg-ink"}`} />}
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-6 min-h-40">
        {p.day && slots === null && <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-11" />)}</div>}
        {slots && slots.length > 0 && (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Horas disponibles">
            {slots.map((t, i) => (
              <motion.button key={p.day + t} initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.045, duration: 0.3, ease }}
                aria-pressed={p.time === t} onClick={() => p.setTime(t)}
                className={`h-11 rounded-xl border text-sm ${p.time === t ? "bg-ink text-paper border-ink" : "border-g2"}`}>{t}</motion.button>
            ))}
          </div>
        )}
        {slots && slots.length === 0 && (
          <div className="text-center text-g4 py-6">
            <p className="display text-xl text-ink">Sin huecos este día</p>
            {next && <button className="link mt-2" onClick={() => { p.setDay(next); setMonth(next.slice(0, 7)); }}>Siguiente día con huecos: {format(parse(next, "yyyy-MM-dd", new Date()), "EEEE d", { locale: es })}</button>}
          </div>
        )}
        {!p.day && <p className="text-g4 text-sm text-center py-6">Toca un día para ver las horas.</p>}
      </div>
      <Bar>{p.footer}</Bar>
    </>
  );
}

function Success({ d }: { d: { id: string; starts_at: string; ends_at: string; services: string; day: string; time: string; calendar: "added" | "failed" | "off" } }) {
  const label = format(parse(d.day, "yyyy-MM-dd", new Date()), "EEEE d 'de' MMMM", { locale: es });
  return (
    <div className="text-center pt-10">
      <svg width="88" height="88" viewBox="0 0 88 88" className="mx-auto" aria-hidden="true">
        <motion.circle cx="44" cy="44" r="40" fill="none" stroke="currentColor" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease }} />
        <motion.path d="M27 45l12 12 22-26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.4, ease }} />
      </svg>
      <h1 className="display text-4xl mt-6">¡Cita confirmada!</h1>
      <p className="text-g4 mt-2 first-letter:uppercase">{label} · {d.time}</p>
      <p className="text-g4 text-sm">{d.services}</p>
      {d.calendar === "added" && <p className="mt-3 text-sm inline-flex gap-1 items-center"><Check />Añadida a tu Google Calendar</p>}
      <div className="mt-8 flex flex-col gap-2 items-center">
        <Link href="/citas" className="btn btn-primary">Ver mis citas <Arrow /></Link>
        {d.calendar !== "added" && <a className="btn btn-secondary w-full" href={googleCalendarAddUrl(d.id)}><GoogleCalendar />Añadir a Google Calendar</a>}
        <a className="link" target="_blank" rel="noopener" href={whatsappUrl(`Hola, tengo cita el ${label} a las ${d.time}.`)}><WhatsApp />&nbsp;Escribir por WhatsApp</a>
      </div>
    </div>
  );
}
