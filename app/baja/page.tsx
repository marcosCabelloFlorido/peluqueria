import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import { isUnsubLinkValid, TEST_CLIENT_ID } from "@/lib/apptAccess";
import { unsubscribe } from "./actions";

export const metadata = { title: "Baja de avisos · DouceCreative", robots: { index: false } };
export const dynamic = "force-dynamic";

const Shell = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <main className="mx-auto max-w-md px-6 py-16">
    <h1 className="display text-4xl">{title}</h1>
    {children}
    <Link href="/" className="link mt-6">Ir al inicio</Link>
  </main>
);

// Enlace firmado del email de reactivación. GET solo muestra confirmación: la baja se hace por POST.
export default async function Baja({ searchParams }: { searchParams: Promise<{ c?: string; t?: string; r?: string }> }) {
  const { c, t, r } = await searchParams;
  if (!c || !(await isUnsubLinkValid(c, t))) {
    return (
      <Shell title="Enlace no válido">
        <p className="text-g4 mt-3">El enlace ha caducado o está incompleto. Usa el enlace del último email que recibiste.</p>
      </Shell>
    );
  }
  if (c === TEST_CLIENT_ID) {
    return <Shell title="Este es un email de prueba"><p className="text-g4 mt-3">No hay ningún cliente real asociado a este enlace.</p></Shell>;
  }

  const { data } = await supabaseService().from("clients").select("marketing_opt_out").eq("id", c).maybeSingle();
  if (!data) {
    return (
      <Shell title="Enlace no válido">
        <p className="text-g4 mt-3">El enlace ha caducado o está incompleto. Usa el enlace del último email que recibiste.</p>
      </Shell>
    );
  }
  if (data.marketing_opt_out) {
    return (
      <Shell title={r === "ok" ? "Listo, te hemos dado de baja" : "Ya estás dado de baja"}>
        <p className="text-g4 mt-3">
          No volverás a recibir avisos promocionales. Seguirás recibiendo la confirmación y el recordatorio de tus citas.
        </p>
      </Shell>
    );
  }
  return (
    <Shell title="¿Dejar de recibir avisos?">
      <p className="text-g4 mt-3">
        Solo dejaremos de enviarte los emails promocionales de &laquo;te echamos de menos&raquo;. Seguirás recibiendo la confirmación y el recordatorio de tus citas.
      </p>
      <form action={unsubscribe} className="mt-6">
        <input type="hidden" name="c" value={c} />
        <input type="hidden" name="t" value={t} />
        <button type="submit" className="btn btn-primary">Sí, darme de baja</button>
      </form>
    </Shell>
  );
}
