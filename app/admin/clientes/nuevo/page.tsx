import AdminSub from "@/components/AdminSub";
import ErrorBox from "@/components/ErrorBox";
import { requireAdmin } from "@/lib/adminGuard";
import { adminCreateClient } from "../actions";

const ERR: Record<string, string> = {
  invalido: "Revisa el nombre y el email.",
  duplicado: "Ya existe un cliente con ese email.",
  fallo: "No se pudo crear. Inténtalo de nuevo.",
};

export default async function NuevoCliente({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("/admin/clientes/nuevo");
  const { error } = await searchParams;
  return (
    <AdminSub title="Nuevo cliente">
      {error && <ErrorBox>{ERR[error] ?? ERR.fallo}</ErrorBox>}
      <form action={adminCreateClient} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Nombre</span><input className="field" name="full_name" required minLength={2} maxLength={100} autoComplete="off" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Email</span><input className="field" type="email" name="email" required maxLength={200} autoComplete="off" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Teléfono (opcional)</span><input className="field" type="tel" name="phone" maxLength={30} autoComplete="off" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-sm text-g4">Cumpleaños (opcional)</span><input className="field" type="date" name="birthday" /></label>
        <button className="btn btn-primary mt-2">Crear cliente</button>
      </form>
    </AdminSub>
  );
}
