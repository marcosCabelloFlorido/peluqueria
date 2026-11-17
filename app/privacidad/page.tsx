import Link from "next/link";
import { Back } from "@/components/Icons";

export const metadata = { title: "Política de privacidad · DouceCreative" };

export default function Privacidad() {
  return (
    <main className="mx-auto max-w-md px-6 py-10 [&_h2]:display [&_h2]:text-xl [&_h2]:mt-6 [&_p]:mt-2 [&_p]:text-g4">
      <Link href="/" className="link"><Back />Inicio</Link>
      <h1 className="display text-4xl mt-6">Política de privacidad</h1>
      <p>Borrador provisional: sustituir por el texto legal definitivo con los datos del titular.</p>
      <h2>Datos que tratamos</h2>
      <p>Nombre, email, teléfono (opcional) y citas, para gestionar tus reservas y enviarte confirmaciones y recordatorios.</p>
      <h2>Tus derechos</h2>
      <p>Puedes acceder, rectificar y eliminar tus datos desde Perfil → Eliminar mi cuenta, o escribiéndonos.</p>
    </main>
  );
}
