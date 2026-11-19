import Link from "next/link";
import { addMonths, format, getDay, getDaysInMonth, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Back, Next } from "@/components/Icons";
import { billingHref, type Period, type View } from "@/lib/billing";

type Props = {
  month: string; // yyyy-MM mostrado
  selected: Period;
  today: string;
  /** céntimos cobrados por día (yyyy-MM-dd) del mes mostrado */
  revenue: Record<string, number>;
  view: View;
  anchor: string;
};

/** Calendario mensual (lunes primero). Cada día muestra lo cobrado; tocar un día abre la vista Día. Sin JS de cliente. */
export default function Calendar({ month, selected, today, revenue, view, anchor }: Props) {
  const first = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const lead = (getDay(first) + 6) % 7;
  const days = Array.from({ length: getDaysInMonth(first) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  const max = Math.max(0, ...Object.values(revenue));
  const prev = format(addMonths(first, -1), "yyyy-MM");
  const next = format(addMonths(first, 1), "yyyy-MM");
  const canNext = next <= today.slice(0, 7);
  const level = (c: number) => (c <= 0 ? "" : c < max * 0.34 ? "bg-tint" : c < max * 0.67 ? "bg-tint2" : "bg-g2");

  return (
    <div className="card p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <Link href={billingHref(view, anchor, prev)} aria-label="Mes anterior del calendario" className="size-11 grid place-items-center"><Back /></Link>
        <p className="first-letter:uppercase font-medium">{format(first, "LLLL yyyy", { locale: es })}</p>
        {canNext
          ? <Link href={billingHref(view, anchor, next)} aria-label="Mes siguiente del calendario" className="size-11 grid place-items-center"><Next /></Link>
          : <span className="size-11" />}
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-g3 mb-1" aria-hidden>{["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const cents = revenue[d] ?? 0;
          const sel = selected.view === "dia" && d === selected.start;
          const label = `${Number(d.slice(8))}${cents ? `, ${Math.round(cents / 100)} euros` : ""}`;
          const body = (
            <>
              <span className="text-sm leading-none">{Number(d.slice(8))}</span>
              <span className={`text-[10px] leading-none mt-1 h-2.5 ${sel ? "text-paper/70" : "text-g4"}`}>{cents ? Math.round(cents / 100) : ""}</span>
            </>
          );
          const cls = `h-12 rounded-xl flex flex-col items-center justify-center ${sel ? "bg-ink text-paper" : level(cents)} ${d === today && !sel ? "ring-1 ring-ink" : ""}`;
          return d > today
            ? <span key={d} className={`${cls} text-g3`} aria-hidden>{body}</span>
            : <Link key={d} href={billingHref("dia", d)} aria-label={label} aria-current={sel ? "date" : undefined} className={`${cls} hover:bg-tint2 transition-colors`}>{body}</Link>;
        })}
      </div>
      <p className="text-xs text-g3 mt-3 text-center">Importe cobrado por día, en euros. Más oscuro, más ingresos.</p>
    </div>
  );
}
