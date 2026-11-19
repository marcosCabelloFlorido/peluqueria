import { Alert } from "./Icons";

/** Aviso de error del panel: borde negro e icono, nunca rojo. */
export default function ErrorBox({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="flex items-start gap-2 rounded-2xl border border-ink px-4 py-3 text-sm mb-4"><Alert />{children}</p>;
}
