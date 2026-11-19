import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import AdminSub from "@/components/AdminSub";
import { requireAdmin } from "@/lib/adminGuard";
import { cleanSearch, inactiveCutoff, isInactive } from "@/lib/crm";
import { localToDate, todayMadrid } from "@/lib/time";

type Row = {
  id: string; full_name: string; email: string; phone: string | null; visits: number;
  last_visit: string | null; next_appt: string | null; created_at: string;
};
type Filter = "todos" | "inactivos" | "nuevos";
const LIMIT = 300;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const sb = await requireAdmin("/admin/clientes");
  const sp = await searchParams;
  const q = cleanSearch(sp.q ?? "");
  const f: Filter = sp.f === "inactivos" || sp.f === "nuevos" ? sp.f : "todos";
  const nowMs = Date.now();
  const { data: cfg } = await sb.from("settings").select("winback_days").single();
  const days = cfg?.winback_days ?? 30;
  const cutoff = inactiveCutoff(days, nowMs);

  let query = sb.from("client_stats").select("id,full_name,email,phone,visits,last_visit,next_appt,created_at").order("full_name").limit(LIMIT);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  if (f === "inactivos") query = query.gt("visits", 0).lt("last_visit", cutoff).is("next_appt", null);
  if (f === "nuevos") query = query.gte("created_at", localToDate(`${todayMadrid().slice(0, 7)}-01`, "00:00").toISOString());

  const [{ data }, { count: lapsed }] = await Promise.all([
    query,
    sb.from("client_stats").select("id", { count: "exact", head: true }).gt("visits", 0).lt("last_visit", cutoff).is("next_appt", null),
  ]);
  const rows = (data ?? []) as Row[];

  const href = (nf: Filter) => `/admin/clientes?${new URLSearchParams({ ...(q ? { q } : {}), ...(nf !== "todos" ? { f: nf } : {}) })}`;
  const chips: { f: Filter; label: string }[] = [
    { f: "todos", label: "Todos" }, { f: "inactivos", label: `Sin venir +${days} días` }, { f: "nuevos", label: "Nuevos este mes" },
  ];

  return (
    <AdminSub title="Clientes">
      {!!lapsed && f !== "inactivos" && (
        <Link href={href("inactivos")} className="card px-4 py-3 mb-4 flex items-center justify-between gap-3 border-ink">
          <span><b>{lapsed}</b> {lapsed === 1 ? "cliente lleva" : "clientes llevan"} más de {days} días sin venir.</span>
          <span className="link !min-h-0 shrink-0">Ver</span>
        </Link>
      )}

      <form action="/admin/clientes" role="search" className="flex gap-2">
        {f !== "todos" && <input type="hidden" name="f" value={f} />}
        <input className="field" type="search" name="q" defaultValue={q} placeholder="Buscar nombre, email o teléfono" aria-label="Buscar clientes" />
        <button className="btn btn-secondary !min-h-[52px]">Buscar</button>
      </form>

      <nav className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5" aria-label="Filtros">
        {chips.map((c) => (
          <Link key={c.f} href={href(c.f)} aria-current={c.f === f ? "true" : undefined}
            className={`chip !min-h-11 !px-4 shrink-0 ${c.f === f ? "!bg-ink text-paper" : ""}`}>{c.label}</Link>
        ))}
      </nav>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-g3">{rows.length} {rows.length === 1 ? "cliente" : "clientes"}</p>
        <Link href="/admin/clientes/nuevo" className="link !min-h-11">Nuevo cliente</Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-g4 card py-10 text-center">{q || f !== "todos" ? "Nada con ese filtro." : "Aún no hay clientes."}</p>
      ) : (
        <ul className="card divide-y divide-g2">
          {rows.map((c) => {
            const missed = isInactive(c, days, nowMs);
            return (
              <li key={c.id}>
                <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-3 px-4 min-h-16 py-2.5 hover:bg-tint transition-colors">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{c.full_name || c.email}</span>
                    <span className="block text-sm text-g4 truncate">
                      {c.phone || c.email}
                    </span>
                    <span className="block text-sm text-g3">
                      {c.last_visit ? `Último corte ${formatDistanceToNowStrict(new Date(c.last_visit), { locale: es, addSuffix: true })}` : "Sin cortes aún"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm tabular-nums">{c.visits} {c.visits === 1 ? "visita" : "visitas"}</span>
                    {missed && <span className="tag tag-on">Te echamos de menos</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length === LIMIT && <p className="text-xs text-g3 text-center mt-3">Mostrando los primeros {LIMIT}. Usa el buscador para acotar.</p>}
    </AdminSub>
  );
}
