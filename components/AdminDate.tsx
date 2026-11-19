"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addMonths, format, getDay, getDaysInMonth, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Back, Next } from "./Icons";

type Props = { value: string; view: "day" | "week"; today: string; counts: Record<string, number> };

export default function AdminDate({ value, view, today, counts }: Props) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const first = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const lead = (getDay(first) + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: getDaysInMonth(first) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)] as (string | null)[];
  const go = (d: string) => { setOpen(false); r.push(`/admin?d=${d}${view === "week" ? "&v=week" : ""}`); };
  const shift = (n: number) => setMonth(format(addMonths(first, n), "yyyy-MM"));

  return (
    <div ref={box} className="relative">
      <button type="button" aria-label="Elegir fecha" aria-expanded={open} aria-haspopup="dialog"
        onClick={() => { setMonth(value.slice(0, 7)); setOpen((o) => !o); }}
        className="size-11 rounded-2xl border border-g2 grid place-items-center hover:border-ink transition-colors cursor-pointer">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="15" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Calendario" className="absolute right-0 top-[calc(100%+8px)] z-30 w-[19rem] max-w-[calc(100vw-2.5rem)] card p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <button type="button" aria-label="Mes anterior" onClick={() => shift(-1)} className="size-10 grid place-items-center cursor-pointer"><Back /></button>
            <p className="first-letter:uppercase font-medium" aria-live="polite">{format(first, "LLLL yyyy", { locale: es })}</p>
            <button type="button" aria-label="Mes siguiente" onClick={() => shift(1)} className="size-10 grid place-items-center cursor-pointer"><Next /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-g3 mb-1">{["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const sel = d === value, n = counts[d] ?? 0;
              return (
                <button key={d} type="button" onClick={() => go(d)} aria-pressed={sel}
                  aria-label={`${format(parse(d, "yyyy-MM-dd", new Date()), "d 'de' MMMM", { locale: es })}${n ? `, ${n} ${n === 1 ? "cita" : "citas"}` : ""}`}
                  className={`relative h-10 grid place-items-center text-sm rounded-full cursor-pointer ${sel ? "bg-ink text-paper" : "hover:bg-tint"}`}>
                  {Number(d.slice(8))}
                  {d === today && <span className={`absolute bottom-1 size-1 rounded-full ${sel ? "bg-paper" : "bg-ink"}`} />}
                  {n > 0 && d !== today && <span className={`absolute bottom-1 size-1 rounded-full ${sel ? "bg-paper" : "bg-g3"}`} />}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => go(today)} className="link mt-1 text-sm mx-auto flex justify-center w-full cursor-pointer">Ir a hoy</button>
        </div>
      )}
    </div>
  );
}
