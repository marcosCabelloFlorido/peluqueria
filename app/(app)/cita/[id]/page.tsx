import Link from "next/link";
import { authorizeAppt, canChange, cancelLimitMin } from "@/lib/apptAccess";
import { euro, fmt } from "@/lib/time";
import ManageAppt from "@/components/ManageAppt";
import { Arrow } from "@/components/Icons";

const LABEL: Record<string, string> = { confirmed: "Confirmada", cancelled: "Cancelada", completed: "Completada", no_show: "No presentado" };

// Gestión de una cita desde el enlace del email: funciona sin iniciar sesión.
export default async function Cita({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const a = await authorizeAppt(id, t);
  if (!a) {
    return (
      <div className="text-center py-10">
        <h1 className="display text-3xl">Enlace no válido</h1>
        <p className="text-g4 mt-2">No encontramos esta cita. Usa el enlace de tu último email.</p>
        <Link href="/reservar" className="btn btn-primary mt-8">Reservar cita <Arrow /></Link>
      </div>
    );
  }
  const limit = await cancelLimitMin();
  const editable = canChange(a, limit);
  return (
    <>
      <h1 className="display text-4xl mb-6">Tu cita</h1>
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="display text-3xl first-letter:uppercase leading-none">{fmt(a.starts_at, "EEEE d 'de' MMMM")}</p>
            <p className="mt-1 text-lg">{fmt(a.starts_at, "HH:mm")}</p>
          </div>
          <span className={`mono text-xs px-2 py-1 rounded-md border ${a.status === "confirmed" ? "bg-ink text-paper border-ink" : "border-g3 text-g4"}`}>{LABEL[a.status] ?? a.status}</span>
        </div>
        <p className="mt-3 text-g4 text-sm">{a.services}</p>
        <p className="font-medium">{euro(a.total_cents)}</p>
      </div>
      {editable
        ? <ManageAppt id={a.id} token={t} label={`${fmt(a.starts_at, "EEEE d 'de' MMMM")} · ${fmt(a.starts_at, "HH:mm")}`} />
        : a.status === "confirmed" && <p className="text-sm text-g4 mt-4">Faltan menos de {Math.round(limit / 60)} h: para cambiarla escríbenos por WhatsApp.</p>}
    </>
  );
}
