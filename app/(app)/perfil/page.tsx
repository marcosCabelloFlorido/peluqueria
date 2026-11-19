import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DirtyForm from "@/components/DirtyForm";
import { signOut, updateProfile, deleteAccount } from "@/app/actions";

export default async function Perfil() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/perfil");
  const { data: p } = await sb.from("profiles").select("*").eq("id", user.id).single();

  async function out() {
    "use server";
    await signOut();
    redirect("/");
  }
  async function del() {
    "use server";
    await deleteAccount();
    redirect("/");
  }

  return (
    <>
      <h1 className="display text-4xl mb-6">Perfil</h1>
      <DirtyForm action={updateProfile} label="Guardar cambios" buttonClass="btn btn-primary mt-2" className="flex flex-col gap-3">
        <label className="text-sm text-g4" htmlFor="n">Nombre</label>
        <input id="n" className="field" name="full_name" defaultValue={p?.full_name ?? ""} required />
        <label className="text-sm text-g4" htmlFor="e">Email</label>
        <input id="e" className="field bg-g1" value={user.email ?? ""} disabled readOnly />
        <label className="text-sm text-g4" htmlFor="t">Teléfono</label>
        <input id="t" className="field" name="phone" type="tel" defaultValue={p?.phone ?? ""} />
        <label className="flex items-center gap-3 min-h-11 mt-2">
          <input type="checkbox" name="email_reminders" defaultChecked={p?.email_reminders ?? true} className="size-5 accent-black" />
          Recordatorio de cita por email
        </label>
      </DirtyForm>

      {p?.role === "admin" && (
        <Link href="/admin" className="btn btn-secondary w-full mt-6">Panel del peluquero</Link>
      )}

      <div className="mt-8 flex flex-col items-start gap-1">
        <form action={out}><button className="link">Cerrar sesión</button></form>
        <details>
          <summary className="link cursor-pointer">Eliminar mi cuenta y mis datos</summary>
          <form action={del} className="card p-4 mt-2">
            <p className="text-sm mb-3">Se borrarán tu cuenta y tus citas. No se puede deshacer.</p>
            <button className="btn btn-secondary w-full">Sí, eliminar definitivamente</button>
          </form>
        </details>
        <Link href="/privacidad" className="link">Política de privacidad</Link>
        <Link href="/aviso-legal" className="link">Aviso legal</Link>
      </div>
    </>
  );
}
