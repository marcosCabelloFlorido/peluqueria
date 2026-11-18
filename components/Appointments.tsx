"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { cancel } from "@/app/actions";
import { euro, fmt } from "@/lib/time";
import { whatsappUrl } from "@/lib/calendar";
import { Alert, Arrow, WhatsApp } from "./Icons";

type A = { id: string; starts_at: string; ends_at: string; total_cents: number; status: "confirmed" | "cancelled" | "completed" | "no_show"; services: string };
const LABEL = { confirmed: "Confirmada", cancelled: "Cancelada", completed: "Completada", no_show: "No presentado" };

export default function Appointments({ list, cancelLimitMin }: { list: A[]; cancelLimitMin: number }) {
  const [tab, setTab] = useState<"next" | "past">("next");
  const [target, setTarget] = useState<A | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (target && d && !d.open) d.showModal();
  }, [target]);
  const now = Date.now();
  const upcoming = list.filter((a) => a.status === "confirmed" && +new Date(a.ends_at) > now).reverse();
  const past = list.filter((a) => !upcoming.includes(a));
  const shown = tab === "next" ? upcoming : past;

  return (
    <>
      <div role="tablist" className="seg mb-5">
        {(["next", "past"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="cursor-pointer">
            {t === "next" ? "Próximas" : "Historial"}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="text-center py-10 text-g4">
          <p className="display text-2xl text-ink mb-4">{tab === "next" ? "No tienes citas próximas" : "Aún no hay historial"}</p>
          {tab === "next" && <Link href="/reservar" className="btn btn-primary">Reservar otra cita <Arrow /></Link>}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {shown.map((a, i) => {
          const canCancel = a.status === "confirmed" && +new Date(a.starts_at) - now > cancelLimitMin * 60000;
          const label = `${fmt(a.starts_at, "EEEE d 'de' MMMM")} a las ${fmt(a.starts_at, "HH:mm")}`;
          return (
            <motion.li key={a.id} className="card p-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="display text-3xl first-letter:uppercase leading-none">{fmt(a.starts_at, "EEE d MMM")}</p>
                  <p className="mt-1 text-lg">{fmt(a.starts_at, "HH:mm")}</p>
                </div>
                <span className={`mono text-xs px-2 py-1 rounded-md border ${a.status === "confirmed" ? "bg-ink text-paper border-ink" : "border-g3 text-g4"}`}>{LABEL[a.status]}</span>
              </div>
              <p className="mt-3 text-g4 text-sm">{a.services}</p>
              <p className="font-medium">{euro(a.total_cents)}</p>
              {a.status === "confirmed" && (
                <div className="mt-4 flex flex-wrap gap-x-4 items-center">
                  {canCancel && <Link href={`/reservar?cambiar=${a.id}`} className="btn btn-primary !w-auto !min-h-11 !px-4 text-sm">Cambiar hora</Link>}
                  {canCancel && <button className="btn btn-secondary !w-auto !min-h-11 !px-4 text-sm" onClick={() => { setErr(""); setTarget(a); }}>Cancelar</button>}
                  <a className="link text-sm" target="_blank" rel="noopener" href={whatsappUrl(`Hola, tengo cita el ${label}.`)}><WhatsApp />&nbsp;WhatsApp</a>
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>

      <dialog ref={dlg} className="sheet" aria-labelledby="cancel-title" closedby="any" onClose={() => setTarget(null)}>
        {target && (
          <>
            <h2 id="cancel-title" className="display text-2xl">¿Cancelar la cita?</h2>
            <p className="text-g4 mt-1 first-letter:uppercase">{fmt(target.starts_at, "EEEE d 'de' MMMM")} · {fmt(target.starts_at, "HH:mm")}</p>
            {err && <p role="alert" className="mt-3 text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />{err}</p>}
            <div className="mt-6 flex flex-col gap-2">
              <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
                const r = await cancel(target.id);
                if ("error" in r && r.error) setErr(r.error); else dlg.current?.close();
              })}>{pending ? "Cancelando…" : "Sí, cancelar cita"}</button>
              <button autoFocus className="btn btn-secondary w-full" onClick={() => dlg.current?.close()}>Mantener cita</button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
