import Link from "next/link";
import { Alert, Check, GoogleCalendar } from "@/components/Icons";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut, updateProfile, deleteAccount, disconnectGoogle } from "@/app/actions";

export default async function Perfil({ searchParams }: { searchParams: Promise<{ gcal?: string }> }) {
  const gcal = (await searchParams).gcal;
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
      <form action={updateProfile} className="flex flex-col gap-3">
        <label className="text-sm text-g4" htmlFor="n">Nombre</label>
        <input id="n" className="field" name="full_name" defaultValue={p?.full_name ?? ""} required />
        <label className="text-sm text-g4" htmlFor="e">Email</label>
        <input id="e" className="field bg-g1" value={user.email ?? ""} disabled readOnly />
        <label className="text-sm text-g4" htmlFor="t">Teléfono</label>
        <input id="t" className="field" name="phone" type="tel" defaultValue={p?.phone ?? ""} />
        <label className="flex items-center gap-3 min-h-11 mt-2">
          <input type="checkbox" name="email_reminders" defaultChecked={p?.email_reminders ?? true} className="size-5 accent-white" />
          Recordatorio de cita por email
        </label>
        <button className="btn btn-primary mt-2">Guardar cambios</button>
      </form>

      <section className="card p-4 mt-6">
        <p className="font-medium inline-flex items-center gap-2"><GoogleCalendar />Google Calendar</p>
        <p className="text-sm text-g4 mt-1">
          {p?.google_calendar_connected ? "Conectado. Tus citas se añaden y se borran solas." : "Conéctalo para añadir tus citas automáticamente."}
        </p>
        {gcal === "ok" && <p role="status" className="text-sm mt-2 inline-flex gap-1 items-center"><Check />Conectado</p>}
        {(gcal === "denied" || gcal === "error") && <p role="alert" className="text-sm mt-2 border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />No se pudo conectar. Inténtalo de nuevo.</p>}
        {gcal === "unconfigured" && <p role="alert" className="text-sm mt-2 border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />Google no está configurado en este entorno.</p>}
        {p?.google_calendar_connected ? (
          <form action={disconnectGoogle} className="mt-3"><button className="btn btn-secondary w-full">Desconectar</button></form>
        ) : (
          <a href="/api/google/connect" className="btn btn-secondary w-full mt-3"><GoogleCalendar />Conectar Google Calendar</a>
        )}
      </section>

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
