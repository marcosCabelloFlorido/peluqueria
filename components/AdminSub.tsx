import Link from "next/link";
import { Back } from "./Icons";

/** Marco común de las subpáginas del panel: volver + título grande. */
export default function AdminSub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-16">
      <header className="mb-6"><Link href="/admin" className="link"><Back />Panel</Link></header>
      <h1 className="display text-4xl mb-6">{title}</h1>
      {children}
    </main>
  );
}
