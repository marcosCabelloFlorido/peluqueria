import AdminSub from "@/components/AdminSub";
import ErrorBox from "@/components/ErrorBox";
import { requireAdmin } from "@/lib/adminGuard";
import { adminSaveWinback } from "@/app/admin/clientes/actions";

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sb = await requireAdmin("/admin/ajustes");
  const sp = await searchParams;
  const { data: s } = await sb.from("settings").select("winback_enabled,winback_days,winback_offer").single();
  return (
    <AdminSub title="Avisos a clientes">
      <p className="text-g4 -mt-3 mb-4">Un email automático (una vez al día, a las 11:00) a los clientes que llevan tiempo sin venir. Se envía como mucho una vez por ausencia.</p>
      {sp.error && <ErrorBox>Revisa los datos: los días deben estar entre 7 y 730.</ErrorBox>}
      {sp.ok && <p className="text-sm mb-4 card px-4 py-3" role="status">Guardado.</p>}
      <form action={adminSaveWinback} className="card p-4 flex flex-col gap-5">
        <label className="flex items-center justify-between gap-3 min-h-11">
          <span className="font-medium">Enviar el aviso</span>
          <input type="checkbox" name="winback_enabled" className="switch" defaultChecked={s?.winback_enabled ?? true} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-g4">Días sin venir antes de avisar</span>
          <span className="unit"><input className="field" type="number" inputMode="numeric" min={7} max={730} name="winback_days" required defaultValue={s?.winback_days ?? 30} /><span>días</span></span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-g4">Oferta (aparece destacada en el email)</span>
          <textarea className="field !py-3 min-h-24" name="winback_offer" maxLength={200} defaultValue={s?.winback_offer ?? ""} placeholder="10% de descuento en tu próximo corte" />
        </label>
        <button className="btn btn-primary !min-h-12">Guardar</button>
      </form>
    </AdminSub>
  );
}
