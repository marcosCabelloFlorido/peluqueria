import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import { verifyUnsubToken } from "@/lib/apptAccess";

export const metadata = { title: "Baja de avisos · DouceCreative", robots: { index: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Enlace firmado del email de reactivación: marca al cliente como "no enviar promociones".
export default async function Baja({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const { c, t } = await searchParams;
  let ok = false;
  if (c && UUID.test(c) && (await verifyUnsubToken(c, t))) {
    const { error } = await supabaseService().from("clients").update({ marketing_opt_out: true }).eq("id", c);
    ok = !error;
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="display text-4xl">{ok ? "Listo, te hemos dado de baja" : "Enlace no válido"}</h1>
      <p className="text-g4 mt-3">
        {ok
          ? "No volverás a recibir avisos promocionales. Seguirás recibiendo la confirmación y el recordatorio de tus citas."
          : "El enlace ha caducado o está incompleto. Usa el botón del último email que recibiste."}
      </p>
      <Link href="/" className="link mt-6">Ir al inicio</Link>
    </main>
  );
}
