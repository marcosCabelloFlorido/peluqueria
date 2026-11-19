"use client";
import { useState, useTransition } from "react";
import { adminSaveNotes } from "@/app/admin/clientes/actions";

/** Notas libres del cliente (forma de la cabeza, remolinos, técnica…). Guarda a demanda y avisa. */
export default function ClientNotes({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState<"" | "ok" | string>("");
  const [pending, start] = useTransition();
  const dirty = value !== saved;

  const save = () => start(async () => {
    const r = await adminSaveNotes(id, value);
    if ("error" in r) return setMsg(r.error);
    setSaved(value);
    setMsg("ok");
  });

  return (
    <div>
      <label htmlFor="notes" className="sr-only">Detalles técnicos del cliente</label>
      <textarea id="notes" className="field !py-3 min-h-44 leading-relaxed" value={value} maxLength={5000}
        placeholder="Forma de la cabeza, estructura del pelo, remolinos, preferencias… Ej.: remolino en coronilla, degradado bajo con 1.5, tijera arriba 4 cm"
        onChange={(e) => { setValue(e.target.value); setMsg(""); }} />
      <div className="flex items-center gap-3 mt-2 min-h-11">
        <button type="button" className="btn btn-secondary !min-h-11 text-sm" disabled={!dirty || pending} onClick={save}>{pending ? "Guardando…" : "Guardar detalles"}</button>
        <p role="status" className="text-sm text-g4">
          {msg === "ok" && !dirty ? "Guardado" : msg && msg !== "ok" ? msg : dirty ? "Cambios sin guardar" : ""}
        </p>
      </div>
    </div>
  );
}
