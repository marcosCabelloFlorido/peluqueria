import Link from "next/link";
import { Back } from "@/components/Icons";

export const metadata = { title: "Aviso legal · DouceCreative" };

export default function AvisoLegal() {
  return (
    <main className="mx-auto max-w-md px-6 py-10 [&_p]:mt-2 [&_p]:text-g4">
      <Link href="/" className="link"><Back />Inicio</Link>
      <h1 className="display text-4xl mt-6">Aviso legal</h1>
      <p>Borrador provisional. Titular: DouceCreative. Pendiente: razón social, NIF, dirección y contacto.</p>
    </main>
  );
}
