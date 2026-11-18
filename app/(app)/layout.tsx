import NavLink from "@/components/NavLink";
import { supabaseServer } from "@/lib/supabase/server";
import { whatsappUrl } from "@/lib/calendar";
import { WhatsApp } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";

const tabs = [
  { href: "/reservar", label: "Reservar", d: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  { href: "/citas", label: "Mis citas", d: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" },
  { href: "/perfil", label: "Perfil", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return (
    <div className="mx-auto max-w-md min-h-dvh pb-[calc(160px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-2">
        <span className="display text-xl font-semibold">DouceCreative</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a href={whatsappUrl("Hola, te escribo desde la app de DouceCreative.")} target="_blank" rel="noopener" aria-label="Escribir por WhatsApp"
             className="grid place-items-center size-11 rounded-full bg-tint hover:bg-tint2 transition-colors"><WhatsApp /></a>
        </div>
      </header>
      <main className="px-5">{children}</main>
      <nav aria-label="Principal" className="dock">
        <ul>
          {tabs.map((t) => (
            <li key={t.href}>
              <NavLink href={user || t.href === "/reservar" ? t.href : `/login?next=${t.href}`} to={t.href} label={t.label} d={t.d} guard={!user && t.href !== "/reservar"} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
