import AdminSub from "@/components/AdminSub";
import { Close } from "@/components/Icons";
import { formatInTimeZone } from "date-fns-tz";
import { requireAdmin } from "@/lib/adminGuard";
import { todayMadrid } from "@/lib/time";
import { adminBlock, adminUnblock } from "@/app/actions";

export default async function Bloqueos() {
  const sb = await requireAdmin("/admin/bloqueos");
  const today = todayMadrid();
  const { data } = await sb.from("blocked_slots").select("id,during,reason").order("during");
  const blocks = data ?? [];
  return (
    <AdminSub title="Bloquear horas o días">
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
      {blocks.length > 0 && (
        <>
          <h2 className="display text-2xl mt-8 mb-3">Bloqueos activos</h2>
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => {
              const m = String(b.during).match(/[\["(]+"?([^",]+)"?,"?([^")\]]+)"?[)\]]/);
              const label = m ? `${formatInTimeZone(new Date(m[1]), "Europe/Madrid", "d MMM HH:mm")} – ${formatInTimeZone(new Date(m[2]), "Europe/Madrid", "d MMM HH:mm")}` : String(b.during);
              return (
                <li key={b.id} className="flex justify-between items-center gap-3 text-sm card px-4 py-3">
                  <span><span className="mono">{label}</span>{b.reason && <span className="block text-g3">{b.reason}</span>}</span>
                  <form action={async () => { "use server"; await adminUnblock(b.id); }}><button className="chip hover:bg-tint2" aria-label="Quitar bloqueo"><Close /></button></form>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminSub>
  );
}
