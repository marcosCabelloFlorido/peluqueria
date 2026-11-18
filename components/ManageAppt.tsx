"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { cancel } from "@/app/actions";
import { Alert, Arrow } from "./Icons";

/** Botones "Cambiar hora" y "Cancelar" para una cita. `token` = enlace firmado del email (sin sesión). */
export default function ManageAppt({ id, token, label }: { id: string; token?: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && dlg.current && !dlg.current.open) dlg.current.showModal(); }, [open]);
  const move = `/reservar?cambiar=${id}${token ? `&t=${encodeURIComponent(token)}` : ""}`;

  return (
    <>
      <div className="mt-6 flex flex-col gap-2">
        <Link href={move} className="btn btn-primary">Cambiar hora <Arrow /></Link>
        <button className="btn btn-secondary w-full" onClick={() => { setErr(""); setOpen(true); }}>Cancelar cita</button>
      </div>
      <dialog ref={dlg} className="sheet" aria-labelledby="cancel-title" closedby="any" onClose={() => setOpen(false)}>
        <h2 id="cancel-title" className="display text-2xl">¿Cancelar la cita?</h2>
        <p className="text-g4 mt-1 first-letter:uppercase">{label}</p>
        {err && <p role="alert" className="mt-3 text-sm border border-ink rounded-xl px-3 py-2 flex gap-2 items-start"><Alert />{err}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
            const r = await cancel(id, token);
            if ("error" in r && r.error) setErr(r.error); else dlg.current?.close();
          })}>{pending ? "Cancelando…" : "Sí, cancelar cita"}</button>
          <button autoFocus className="btn btn-secondary w-full" onClick={() => dlg.current?.close()}>Mantener cita</button>
        </div>
      </dialog>
    </>
  );
}
