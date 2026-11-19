// El panel del peluquero siempre en claro (fondo blanco), sea cual sea el tema elegido.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-light min-h-dvh bg-paper text-ink">{children}</div>;
}
