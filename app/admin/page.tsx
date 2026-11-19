import Link from "next/link";
import { requireAdmin } from "@/lib/adminGuard";
import { todayMadrid, localToDate } from "@/lib/time";
import { Back, Next } from "@/components/Icons";

const I = {
  agenda: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  servicios: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
  horario: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  facturacion: "M3 6h18v12H3zM3 10h18M7 15h3",
  bloqueos: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
};

function Row({ href, icon, title, hint }: { href: string; icon: string; title: string; hint?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 pl-4 pr-3 min-h-16 hover:bg-tint transition-colors group">
        <span className="size-9 shrink-0 rounded-[10px] bg-ink text-paper grid place-items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
        </span>
        <span className="flex-1 min-w-0 py-3 border-b border-g2 group-last:border-b-0 flex items-center justify-between gap-3 self-stretch">
          <span className="min-w-0">
            <span className="block font-medium">{title}</span>
            {hint && <span className="block text-sm text-g3 truncate">{hint}</span>}
          </span>
          <span className="text-g3 shrink-0"><Next /></span>
        </span>
      </Link>
    </li>
  );
}

export default async function Panel() {
  const sb = await requireAdmin("/admin");
  const today = todayMadrid();
  const [{ count: hoy }, { count: servicios }, { count: bloqueos }] = await Promise.all([
    sb.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmed")
      .gte("starts_at", localToDate(today, "00:00").toISOString()).lt("starts_at", localToDate(today, "23:59").toISOString()),
    sb.from("services").select("id", { count: "exact", head: true }).eq("active", true),
    sb.from("blocked_slots").select("id", { count: "exact", head: true }),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-16">
      <header className="mb-6">
        <Link href="/perfil" className="link"><Back />Perfil</Link>
      </header>
      <h1 className="display text-4xl mb-6">Panel</h1>

      <ul className="card overflow-hidden">
        <Row href="/admin/agenda" icon={I.agenda} title="Agenda" hint={hoy ? `${hoy} ${hoy === 1 ? "cita" : "citas"} hoy` : "Sin citas hoy"} />
      </ul>

      <p className="text-xs text-g3 uppercase tracking-wider mt-8 mb-2 px-4">Negocio</p>
      <ul className="card overflow-hidden">
        <Row href="/admin/facturacion" icon={I.facturacion} title="Facturación" hint="Ingresos y registro de pagos" />
        <Row href="/admin/servicios" icon={I.servicios} title="Servicios y precios" hint={`${servicios ?? 0} activos`} />
        <Row href="/admin/horario" icon={I.horario} title="Horario semanal" hint="Franjas para reservar" />
        <Row href="/admin/bloqueos" icon={I.bloqueos} title="Bloquear horas o días" hint={bloqueos ? `${bloqueos} bloqueos` : "Vacaciones, descansos…"} />
      </ul>
    </main>
  );
}
