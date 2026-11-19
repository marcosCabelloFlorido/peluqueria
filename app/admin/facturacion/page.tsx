import Link from "next/link";
import { addMonths, format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import AdminSub from "@/components/AdminSub";
import { Back, Next } from "@/components/Icons";
import { requireAdmin } from "@/lib/adminGuard";
import { euro, localToDate, todayMadrid, TZ } from "@/lib/time";

type Row = {
  id: string; starts_at: string; total_cents: number; contact_name: string | null;
  profiles: { full_name: string } | null; appointment_services: { services: { name: string } }[];
};

export default async function Facturacion({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sb = await requireAdmin("/admin/facturacion");
  const today = todayMadrid();
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
  const first = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const prev = format(addMonths(first, -1), "yyyy-MM");
  const next = format(addMonths(first, 1), "yyyy-MM");
  const from = localToDate(`${month}-01`, "00:00").toISOString();
  const to = localToDate(`${next}-01`, "00:00").toISOString();

  const [{ data: paid }, { data: due }] = await Promise.all([
    sb.from("appointments").select("id,starts_at,total_cents,contact_name,profiles(full_name),appointment_services(services(name))")
      .eq("status", "completed").gte("starts_at", from).lt("starts_at", to).order("starts_at", { ascending: false }),
    // Terminadas sin confirmar asistencia: aún no cuentan como ingreso.
    sb.from("appointments").select("total_cents").eq("status", "confirmed").gte("starts_at", from).lt("starts_at", new Date().toISOString() < to ? new Date().toISOString() : to),
  ]);
  const rows = (paid ?? []) as unknown as Row[];
  const total = rows.reduce((s, r) => s + r.total_cents, 0);
  const pending = (due ?? []).reduce((s, r) => s + r.total_cents, 0);
  const pendingN = (due ?? []).length;

  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const d = formatInTimeZone(r.starts_at, TZ, "yyyy-MM-dd");
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  const canNext = next <= today.slice(0, 7);

  return (
    <AdminSub title="Facturación">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/facturacion?m=${prev}`} aria-label="Mes anterior" className="size-11 grid place-items-center"><Back /></Link>
        <p className="first-letter:uppercase font-medium">{format(first, "LLLL yyyy", { locale: es })}</p>
        {canNext
          ? <Link href={`/admin/facturacion?m=${next}`} aria-label="Mes siguiente" className="size-11 grid place-items-center"><Next /></Link>
          : <span className="size-11" />}
      </div>

      <div className="rounded-3xl bg-ink text-paper p-6">
        <p className="text-sm opacity-60">Ingresos del mes</p>
        <p className="display text-5xl mt-1 tabular-nums">{euro(total)}</p>
        <p className="text-sm opacity-60 mt-3">
          {rows.length} {rows.length === 1 ? "cita cobrada" : "citas cobradas"}
          {rows.length > 0 && ` · media ${euro(Math.round(total / rows.length))}`}
        </p>
      </div>
      {pendingN > 0 && (
        <p className="mt-3 text-sm text-g4 card px-4 py-3">
          {pendingN} {pendingN === 1 ? "cita pendiente" : "citas pendientes"} de confirmar asistencia ({euro(pending)}). Aún no cuentan como ingreso.
        </p>
      )}

      <h2 className="display text-2xl mt-8 mb-3">Registro de pagos</h2>
      {rows.length === 0 ? (
        <p className="text-g4 card py-10 text-center">Sin ingresos este mes.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...byDay.entries()].map(([d, list]) => (
            <section key={d}>
              <div className="flex justify-between text-xs text-g3 uppercase tracking-wider mb-2 px-1">
                <span>{format(parse(d, "yyyy-MM-dd", new Date()), "EEEE d", { locale: es })}</span>
                <span className="tabular-nums">{euro(list.reduce((s, r) => s + r.total_cents, 0))}</span>
              </div>
              <ul className="card divide-y divide-g2">
                {list.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{r.contact_name || r.profiles?.full_name || "Cliente"}</span>
                      <span className="block text-sm text-g4 truncate">{formatInTimeZone(r.starts_at, TZ, "HH:mm")} · {r.appointment_services.map((s) => s.services.name).join(" + ")}</span>
                    </span>
                    <span className="font-medium tabular-nums shrink-0">{euro(r.total_cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminSub>
  );
}
