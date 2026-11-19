import AdminSub from "@/components/AdminSub";
import NewClientForm from "@/components/NewClientForm";
import { requireAdmin } from "@/lib/adminGuard";

export default async function NuevoCliente() {
  await requireAdmin("/admin/clientes/nuevo");
  return (
    <AdminSub title="Nuevo cliente">
      <NewClientForm />
    </AdminSub>
  );
}
