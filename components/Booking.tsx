"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { addMonths, addDays, format, getDay, getDaysInMonth, parse } from "date-fns";
import { es } from "date-fns/locale";
import { book, fetchMonth, fetchSlots, reschedule } from "@/app/actions";
import { euro, todayMadrid } from "@/lib/time";
import { whatsappUrl } from "@/lib/calendar";
import type { DayInfo } from "@/lib/availability";
import { Alert, Arrow, Back, Next, WhatsApp } from "./Icons";

type Service = { id: string; slug: string; name: string; price_cents: number; duration_min: number; exclusive_group: string | null };
type Saved = { ids: string[]; day: string | null; time: string | null; step: 1 | 2 | 3; note: string };
type Contact = { name: string; phone: string; email: string };
const KEY = "dc_booking";
const CONTACT_KEY = "dc_contact";
const LAST_KEY = "dc_last";
type Move = { id: string; token?: string; ids: string[]; services: string; duration: number; current: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

export default function Booking({ services, windowDays, profile, last, move }: { services: Service[]; windowDays: number; profile?: Partial<Contact>; last?: string[]; move?: Move }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<1 | 2 | 3>(move ? 2 : 1);
  const [dir, setDir] = useState(1);
  const [ids, setIds] = useState<string[]>(move?.ids ?? []);
  const [lastIds, setLastIds] = useState<string[]>([]);
  const [touched, setTouched] = useState<Partial<Record<keyof Contact, boolean>>>({});
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [contact, setContact] = useState<Contact>({ name: profile?.name ?? "", phone: profile?.phone ?? "", email: profile?.email ?? "" });
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  const chosen = services.filter((s) => ids.includes(s.id));
  const total = chosen.reduce((a, s) => a + s.price_cents, 0);
  const duration = move?.duration ?? chosen.reduce((a, s) => a + s.duration_min, 0);

  // Restaurar selección (p.ej. tras iniciar sesión)
  useEffect(() => {
    if (move) { setHydrated(true); return; }
    try {
      // Atajo "Repetir": última cita de la cuenta o, sin cuenta, la última reservada en este dispositivo.
      const prev: string[] = last?.length ? last : JSON.parse(localStorage.getItem(LAST_KEY) ?? "[]");
      setLastIds(prev.filter((id) => services.some((x) => x.id === id)));
    } catch {}
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const s: Saved = JSON.parse(raw);
        const valid = s.ids.filter((id) => services.some((x) => x.id === id));
        setIds(valid); setDay(s.day); setTime(s.time); setNote(s.note ?? "");
        setStep(valid.length ? s.step : 1);
      }
    } catch {}
    try {
      // Datos de contacto recordados en este dispositivo (la cuenta, si hay, manda).
      const c: Partial<Contact> = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "{}");
      setContact((cur) => ({ name: cur.name || c.name || "", phone: cur.phone || c.phone || "", email: cur.email || c.email || "" }));
    } catch {}
    setHydrated(true);
  }, [services, last, move]);
  useEffect(() => {
    if (!hydrated || move) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ ids, day, time, step, note } satisfies Saved)); } catch {}
  }, [hydrated, move, ids, day, time, step, note]);

  const invalid: Record<keyof Contact, string> = {
    name: contact.name.trim().length >= 2 ? "" : "Escribe tu nombre.",
    phone: /^[+\d][\d\s().-]{6,19}$/.test(contact.phone.trim()) ? "" : "Teléfono no válido. Ej.: 612 345 678",
    email: EMAIL_RE.test(contact.email.trim()) ? "" : "Email no válido. Ej.: nombre@gmail.com",
  };
  const contactOk = !invalid.name && !invalid.phone && !invalid.email;
  const fieldErr = (k: keyof Contact) => (touched[k] ? invalid[k] : "");
  const fieldProps = (k: keyof Contact) => ({
    "aria-invalid": !!fieldErr(k), "aria-describedby": fieldErr(k) ? `err-${k}` : undefined,
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
    className: `field ${fieldErr(k) ? "!border-ink border-2" : ""}`,
  });
  const setC = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((c) => ({ ...c, [k]: e.target.value }));

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
    if (!day || !time) return;
    if (!contactOk) {
      // Marca todos los campos y lleva el foco al primero con error.
      setTouched({ name: true, phone: true, email: true });
      const first = (["name", "phone", "email"] as const).find((k) => invalid[k]);
      const el = document.querySelector<HTMLInputElement>(`input[name="${first}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" }); // centrado: no queda bajo la barra fija
      return;
    }
    setError("");
    start(async () => {
      const r = await book({ serviceIds: ids, day, time, note, ...contact });
      if ("error" in r && r.error) {
        setError(r.error);
        if (r.refresh) { setTime(null); go(2); }
        return;
      }
      try { sessionStorage.removeItem(KEY); } catch {}
      try { localStorage.setItem(CONTACT_KEY, JSON.stringify(contact)); localStorage.setItem(LAST_KEY, JSON.stringify(ids)); } catch {}
      setDone({ id: r.id!, starts_at: r.starts_at!, ends_at: r.ends_at!, services: chosen.map((s) => s.name).join(" + "), day, time, loggedIn: !!r.loggedIn });
    });
  }

  function moveTo() {
    if (!move || !day || !time) return;
    setError("");
    start(async () => {
      const r = await reschedule({ id: move.id, token: move.token, day, time });
      if ("error" in r && r.error) { setError(r.error); if ("refresh" in r && r.refresh) setTime(null); return; }
      setDone({ id: move.id, starts_at: r.starts_at ?? "", ends_at: r.ends_at ?? "", services: move.services, day, time, loggedIn: !move.token, moved: true, token: move.token });
    });
  }

  if (done) return <Success d={done} email={contact.email} onAgain={() => { setDone(null); setIds([]); setDay(null); setTime(null); setNote(""); setStep(1); }} />;
  if (!hydrated) return <div className="skeleton h-72 mt-14" aria-busy="true" />;

  const slide = { x: reduce ? 0 : dir * 40, opacity: 0 };
  return (
    <div>
      {!move && <Progress step={step} onBack={step > 1 ? () => go((step - 1) as 1 | 2) : undefined} />}
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.section key={step} initial={slide} animate={{ x: 0, opacity: 1 }} exit={{ x: reduce ? 0 : -dir * 40, opacity: 0 }} transition={{ duration: 0.3, ease }}>
          {step === 1 && (
            <>
              <h1 className="display text-4xl mb-1">¿Qué te hacemos?</h1>
              <p className="text-g4 mb-6">Elige uno o varios servicios.</p>
              {lastIds.length > 0 && !ids.length && (
                <button onClick={() => { setIds(lastIds); setDay(null); setTime(null); go(2); }}
                  className="w-full text-left card p-4 mb-5 flex items-center justify-between gap-3 border-ink active:scale-[.98] transition-transform">
                  <span>
                    <span className="block text-xs text-g4 uppercase tracking-wider">Lo de siempre</span>
                    <span className="block font-medium">{services.filter((s) => lastIds.includes(s.id)).map((s) => s.name).join(" + ")}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 font-medium">{euro(services.filter((s) => lastIds.includes(s.id)).reduce((a, s) => a + s.price_cents, 0))} <Arrow /></span>
                </button>
              )}
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
            <DayTime duration={duration} windowDays={windowDays} day={day} time={time} move={move}
              setDay={(d) => { setDay(d); setTime(null); }} setTime={setTime}
              title={move ? "Cambia tu cita" : undefined}
              intro={move && <p className="text-g4 -mt-4 mb-6 first-letter:uppercase">Ahora: {move.current}<br /><span className="text-sm">{move.services}</span></p>}
              error={move ? error : ""}
              footer={move
                ? <button className="btn btn-primary" disabled={!day || !time || pending} onClick={moveTo}>{pending ? "Cambiando…" : "Cambiar a esta hora"} <Arrow /></button>
                : <button className="btn btn-primary" disabled={!day || !time} onClick={() => go(3)}>Continuar <Arrow /></button>} />
          )}
          {step === 3 && day && time && (
            <>
              <h1 className="display text-4xl mb-6">Confirma tu cita</h1>
              <div className="card overflow-hidden">
                <div className="p-5 flex items-center gap-4">
                  <div className="size-16 shrink-0 rounded-2xl bg-ink text-paper grid place-items-center leading-none text-center">
                    <span>
                      <span className="display block text-3xl">{Number(day.slice(8))}</span>
                      <span className="block text-[11px] uppercase tracking-wider mt-1 opacity-70">{format(parse(day, "yyyy-MM-dd", new Date()), "MMM", { locale: es })}</span>
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="display text-2xl first-letter:uppercase">{format(parse(day, "yyyy-MM-dd", new Date()), "EEEE", { locale: es })}</p>
                    <p className="text-g4 mt-0.5">{time} · {duration} min</p>
                  </div>
                </div>
                <div className="border-t border-g2 px-5 py-4">
                  <p className="text-xs text-g4 uppercase tracking-wider mb-2">Servicios</p>
                  <ul className="flex flex-col gap-1.5">
                    {chosen.map((s) => <li key={s.id} className="flex justify-between gap-3"><span>{s.name}</span><span className="text-g4 tabular-nums">{euro(s.price_cents)}</span></li>)}
                  </ul>
                </div>
                <div className="border-t border-g2 bg-tint px-5 py-4 flex justify-between items-baseline">
                  <span className="text-g4">Total</span>
                  <span className="display text-2xl tabular-nums">{euro(total)}</span>
                </div>
              </div>
              <h2 className="display text-2xl mt-8 mb-1">Tus datos</h2>
              <p className="text-sm text-g4 mb-1">Te enviaremos la confirmación y el recordatorio a este email.</p>
              {!profile && (
                <p className="text-sm text-g4 mb-3">
                  ¿Ya tienes cuenta?{" "}
                  <Link href="/login?next=/reservar" className="underline underline-offset-4 text-ink">Entra</Link> y rellenamos tus datos.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="c-name" className="text-sm text-g4">Nombre</label>
                <input {...fieldProps("name")} id="c-name" name="name" placeholder="Tu nombre" autoComplete="name" maxLength={100} value={contact.name} onChange={setC("name")} required />
                {fieldErr("name") && <FieldError id="err-name">{fieldErr("name")}</FieldError>}
                <label htmlFor="c-phone" className="text-sm text-g4 mt-2">Teléfono</label>
                <input {...fieldProps("phone")} id="c-phone" name="phone" type="tel" inputMode="tel" placeholder="612 345 678" autoComplete="tel" maxLength={20} value={contact.phone} onChange={setC("phone")} required />
                {fieldErr("phone") && <FieldError id="err-phone">{fieldErr("phone")}</FieldError>}
                <label htmlFor="c-email" className="text-sm text-g4 mt-2">Email</label>
                <input {...fieldProps("email")} id="c-email" name="email" type="email" inputMode="email" placeholder="nombre@gmail.com" autoComplete="email" maxLength={200} value={contact.email} onChange={setC("email")} required />
                {fieldErr("email") && <FieldError id="err-email">{fieldErr("email")}</FieldError>}
              </div>
              <label className="block mt-5 text-sm text-g4" htmlFor="note">Nota para el peluquero (opcional)</label>
              <textarea id="note" className="field mt-1 py-3 min-h-24" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              {error && <p role="alert" className="mt-3 text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />{error}</p>}
              <Bar>
                <button className="btn btn-primary" disabled={pending} aria-disabled={!contactOk} onClick={confirm}>{pending ? "Reservando…" : "Confirmar cita"} <Arrow /></button>
              </Bar>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

const FieldError = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <p id={id} className="text-sm flex gap-1.5 items-center"><Alert />{children}</p>
);

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

function DayTime(p: { duration: number; windowDays: number; day: string | null; time: string | null; setDay: (d: string) => void; setTime: (t: string) => void; footer: React.ReactNode; move?: Move; title?: string; intro?: React.ReactNode; error?: string }) {
  const reduce = useReducedMotion();
  const today = todayMadrid();
  const last = format(addDays(new Date(), p.windowDays), "yyyy-MM-dd");
  const [month, setMonth] = useState(() => (p.day ?? today).slice(0, 7));
  const [open, setOpen] = useState<Record<string, DayInfo> | null>(null);
  const [hint, setHint] = useState("");
  const auto = useRef(true); // preselecciona el primer día libre solo una vez
  const [slots, setSlots] = useState<string[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const wantScroll = useRef(false);
  const moveId = p.move?.id, moveToken = p.move?.token;

  useEffect(() => {
    let off = false;
    setOpen(null);
    fetchMonth(month, p.duration).then((d) => { if (!off) setOpen(d); });
    return () => { off = true; };
  }, [month, p.duration]);

  const loadSlots = useCallback((d: string) => {
    setSlots(null);
    fetchSlots(d, p.duration, moveId ? { id: moveId, token: moveToken } : undefined).then(setSlots);
  }, [p.duration, moveId, moveToken]);
  // Tras tocar un día: lleva las horas a la vista (si no, quedan bajo la barra fija).
  useEffect(() => {
    if (slots && wantScroll.current) {
      wantScroll.current = false;
      slotsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [slots, reduce]);
  useEffect(() => { if (p.day) loadSlots(p.day); else setSlots(null); }, [p.day, loadSlots]);

  useEffect(() => {
    setNext(null);
    if (slots && slots.length === 0 && open) setNext(Object.keys(open).sort().find((d) => open[d].n > 0 && p.day && d > p.day) ?? null);
  }, [slots, open, p.day]);

  const first = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const lead = (getDay(first) + 6) % 7;
  const cells = useMemo(() => [...Array(lead).fill(null), ...Array.from({ length: getDaysInMonth(first) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)], [lead, first, month]);
  const shift = (n: number) => setMonth(format(addMonths(first, n), "yyyy-MM"));
  const canPrev = month > today.slice(0, 7);
  const canNext = month < last.slice(0, 7);
  const nav = (n: number) => { auto.current = false; setHint(""); shift(n); };

  // Al entrar sin día elegido: marca el primer día con hueco (si el mes no tiene, salta al siguiente).
  const { setDay } = p;
  useEffect(() => {
    if (!open || p.day || !auto.current) return;
    const f = Object.keys(open).sort().find((d) => open[d].n > 0);
    if (f) { auto.current = false; setDay(f); }
    else if (canNext) setMonth(format(addMonths(parse(`${month}-01`, "yyyy-MM-dd", new Date()), 1), "yyyy-MM"));
  }, [open, p.day, canNext, month, setDay]);

  function whyClosed(d: string, info: DayInfo) {
    const date = parse(d, "yyyy-MM-dd", new Date());
    if (info.why === "cerrado") return `No abrimos el ${format(date, "EEEE", { locale: es })}.`;
    return d === today ? "Hoy ya no quedan huecos." : `El ${format(date, "d 'de' MMMM", { locale: es })} está completo.`;
  }

  return (
    <>
      <h1 className="display text-4xl mb-6">{p.title ?? "Elige día y hora"}</h1>
      {p.intro}
      <div className="flex items-center justify-between mb-3">
        <button className="size-11 grid place-items-center disabled:opacity-20" disabled={!canPrev} onClick={() => nav(-1)} aria-label="Mes anterior"><Back /></button>
        <p className="first-letter:uppercase font-medium" aria-live="polite">{format(first, "LLLL yyyy", { locale: es })}</p>
        <button className="size-11 grid place-items-center disabled:opacity-20" disabled={!canNext} onClick={() => nav(1)} aria-label="Mes siguiente"><Next /></button>
      </div>
      <motion.div drag={reduce ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} style={{ touchAction: "pan-y" }}
        onDragEnd={(_, i) => { if (i.offset.x < -60 && canNext) nav(1); else if (i.offset.x > 60 && canPrev) nav(-1); }}>
        <div className="grid grid-cols-7 text-center text-xs text-g3 mb-1">{["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1" role="grid">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const info = open?.[d];
            const ok = !!info && info.n > 0;
            const few = ok && info.n <= 3;
            const dim = !!info && !ok; // dentro de la ventana, pero cerrado o completo
            const sel = p.day === d;
            const label = format(parse(d, "yyyy-MM-dd", new Date()), "d 'de' MMMM", { locale: es });
            return (
              <button key={d} disabled={!info} aria-disabled={dim || undefined} aria-pressed={sel}
                aria-label={dim ? `${label}, ${info.why}` : few ? `${label}, pocos huecos` : label}
                onClick={() => { if (!ok) { setHint(whyClosed(d, info!)); return; } auto.current = false; setHint(""); wantScroll.current = true; p.setDay(d); }}
                className={`relative h-11 grid place-items-center text-sm rounded-full ${ok ? "" : "text-g3/60"} ${dim ? "line-through" : ""} ${open === null ? "skeleton !rounded-full m-0.5" : ""}`}>
                {sel && <motion.span layoutId="dayPill" className="absolute inset-0 m-auto size-10 rounded-full bg-ink" transition={spring} />}
                <span className={`relative ${sel ? "text-paper" : ""}`}>{Number(d.slice(8))}</span>
                {d === today && <span className={`absolute bottom-1 size-1 rounded-full ${sel ? "bg-paper" : "bg-ink"}`} />}
                {few && <span className={`absolute top-1.5 right-2 size-1.5 rounded-full ${sel ? "bg-paper" : "bg-ink"}`} />}
              </button>
            );
          })}
        </div>
      </motion.div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-g4">
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-ink" />Pocos huecos</span>
        <span><s>12</s> Cerrado o completo (tócalo)</span>
      </div>
      {hint && <p role="status" className="mt-2 text-sm border border-g2 rounded-xl px-3 py-2">{hint}</p>}

      <div ref={slotsRef} className="mt-6 min-h-40 scroll-mt-4">
        {p.day && slots === null && <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-11" />)}</div>}
        {slots && slots.length > 0 && (
          <div className="flex flex-col gap-5">
            {([["Mañana", slots.filter((t) => t < "14:00")], ["Tarde", slots.filter((t) => t >= "14:00")]] as const).filter(([, l]) => l.length).map(([name, list]) => (
              <div key={name}>
                <p className="text-xs text-g4 uppercase tracking-wider mb-2">{name}</p>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label={`Horas disponibles por la ${name.toLowerCase()}`}>
                  {list.map((t, i) => (
                    <motion.button key={p.day + t} initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.03, duration: 0.3, ease }}
                      aria-pressed={p.time === t} onClick={() => p.setTime(t)}
                      className={`h-11 rounded-xl border text-sm ${p.time === t ? "bg-ink text-paper border-ink" : "border-g2"}`}>{t}</motion.button>
                  ))}
                </div>
              </div>
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
      {p.error && <p role="alert" className="mt-3 text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />{p.error}</p>}
      <Bar>{p.footer}</Bar>
    </>
  );
}

type Done = { id: string; starts_at: string; ends_at: string; services: string; day: string; time: string; loggedIn: boolean; moved?: boolean; token?: string };

function Success({ d, email, onAgain }: { d: Done; email: string; onAgain: () => void }) {
  const label = format(parse(d.day, "yyyy-MM-dd", new Date()), "EEEE d 'de' MMMM", { locale: es });
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (d.loggedIn || d.moved) return;
    const t = setTimeout(() => { if (dlg.current && !dlg.current.open) dlg.current.showModal(); }, 1100);
    return () => clearTimeout(t);
  }, [d.loggedIn, d.moved]);
  return (
    <div className="text-center pt-10">
      <svg width="88" height="88" viewBox="0 0 88 88" className="mx-auto" aria-hidden="true">
        <motion.circle cx="44" cy="44" r="40" fill="none" stroke="currentColor" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease }} />
        <motion.path d="M27 45l12 12 22-26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.4, ease }} />
      </svg>
      <h1 className="display text-4xl mt-6">{d.moved ? "¡Cita cambiada!" : "¡Cita confirmada!"}</h1>
      <p className="text-g4 mt-2 first-letter:uppercase">{label} · {d.time}</p>
      <p className="text-g4 text-sm">{d.services}</p>
      <p className="mt-3 text-sm text-g4">{d.moved ? "Te hemos enviado la nueva hora por email." : `Te hemos enviado la confirmación a ${email} y te recordaremos antes de la cita.`}</p>
      <div className="mt-8 flex flex-col gap-2 items-center">
        {d.moved && d.token
          ? <Link href={`/cita/${d.id}?t=${encodeURIComponent(d.token)}`} className="btn btn-primary">Ver mi cita <Arrow /></Link>
          : d.loggedIn
          ? <Link href="/citas" className="btn btn-primary">Ver mis citas <Arrow /></Link>
          : <button className="btn btn-primary" onClick={onAgain}>Reservar otra cita <Arrow /></button>}
        <a className="link" target="_blank" rel="noopener" href={whatsappUrl(`Hola, tengo cita el ${label} a las ${d.time}.`)}><WhatsApp />&nbsp;Escribir por WhatsApp</a>
      </div>
      {!d.loggedIn && !d.moved && (
        <dialog ref={dlg} aria-labelledby="login-ttl" className="m-auto w-[min(92vw,22rem)] rounded-3xl bg-paper text-ink border border-g2 p-6 text-center backdrop:bg-black/40">
          <h2 id="login-ttl" className="display text-2xl">¿Quieres iniciar sesión?</h2>
          <p className="text-sm text-g4 mt-2">Solo tu email, sin contraseña. Verás y cancelarás tus citas desde la app, y reservar será más rápido.</p>
          <div className="mt-5 flex flex-col gap-2 items-center">
            <Link href={`/login?next=${encodeURIComponent(`/citas?claim=${d.id}`)}`} className="btn btn-primary w-full justify-center">Iniciar sesión <Arrow /></Link>
            <Link href={`/login?next=${encodeURIComponent(`/citas?claim=${d.id}`)}`} className="link !text-ink">Crear cuenta</Link>
            <button className="link" onClick={() => dlg.current?.close()}>Ahora no</button>
          </div>
        </dialog>
      )}
    </div>
  );
}
