import AdminSub from "@/components/AdminSub";
import { Close } from "@/components/Icons";
import { requireAdmin } from "@/lib/adminGuard";
import { adminAddHours, adminDeleteHours } from "@/app/actions";

const DAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function Horario() {
  const sb = await requireAdmin("/admin/horario");
  const { data: hours } = await sb.from("business_hours").select("*").order("weekday").order("opens");
  return (
    <AdminSub title="Horario semanal">
      <p className="text-g4 -mt-3 mb-4">Franjas en las que se puede reservar. Toca una para quitarla.</p>
      <ul className="card px-4 py-1 divide-y divide-g2">
        {DAYS.slice(1).map((name, i) => {
          const slots = (hours ?? []).filter((h) => h.weekday === i + 1);
          return (
            <li key={name} className="flex items-start justify-between gap-3 min-h-12 py-2.5">
              <span className={`text-sm pt-1.5 ${slots.length ? "" : "text-g3"}`}>{name}</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {slots.length === 0 && <span className="text-sm text-g3 pt-1.5">Cerrado</span>}
                {slots.map((h) => (
                  <form key={h.id} action={async () => { "use server"; await adminDeleteHours(h.id); }}>
                    <button className="chip mono hover:bg-tint2" aria-label={`Quitar ${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`}>
                      {h.opens.slice(0, 5)}–{h.closes.slice(0, 5)}<Close />
                    </button>
                  </form>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <h2 className="display text-2xl mt-8 mb-3">Añadir franja</h2>
      <form action={adminAddHours} className="grid grid-cols-[1fr_1fr] gap-2">
        <select className="field col-span-2" name="weekday" aria-label="Día">{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
        <input className="field" type="time" name="opens" required aria-label="Abre" />
        <input className="field" type="time" name="closes" required aria-label="Cierra" />
        <button className="btn btn-secondary col-span-2 !min-h-11 text-sm">Añadir franja</button>
      </form>
    </AdminSub>
  );
}
