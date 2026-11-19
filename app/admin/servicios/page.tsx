import AdminSub from "@/components/AdminSub";
import { requireAdmin } from "@/lib/adminGuard";
import DirtyForm from "@/components/DirtyForm";
import { adminUpdateService } from "@/app/actions";

export default async function Servicios() {
  const sb = await requireAdmin("/admin/servicios");
  const { data: services } = await sb.from("services").select("*").order("sort");
  return (
    <AdminSub title="Servicios y precios">
      <ul className="flex flex-col gap-3">
        {(services ?? []).map((s) => (
          <li key={s.id}>
            <DirtyForm action={adminUpdateService} label="Guardar cambios" className="card p-4 flex flex-col gap-3">
              <input type="hidden" name="id" value={s.id} />
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{s.name}</span>
                <label className="flex items-center gap-2 text-sm text-g4">
                  <span>Activo</span>
                  <input type="checkbox" className="switch" name="active" defaultChecked={s.active} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs text-g3 mb-1">Precio</span>
                  <span className="unit"><input className="field" name="price" type="number" step="0.5" min="0" defaultValue={s.price_cents / 100} /><span>€</span></span>
                </label>
                <label className="block">
                  <span className="block text-xs text-g3 mb-1">Duración</span>
                  <span className="unit"><input className="field" name="duration" type="number" min="5" step="5" defaultValue={s.duration_min} /><span>min</span></span>
                </label>
              </div>
            </DirtyForm>
          </li>
        ))}
      </ul>
    </AdminSub>
  );
}
