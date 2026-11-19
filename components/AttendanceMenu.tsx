"use client";
import { useState } from "react";

/** Contactar + Asistencia. Las opciones se despliegan dentro de la tarjeta (nada flota ni se recorta). */
export default function AttendanceMenu({ contactHref, children }: { contactHref?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {contactHref
        ? <a className="btn btn-secondary !min-h-11 text-sm" href={contactHref} target="_blank" rel="noopener">Contactar</a>
        : <span />}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="btn btn-primary !min-h-11 text-sm">Asistencia</button>
      {open && <div className="col-span-2 flex flex-col rounded-2xl bg-tint p-1">{children}</div>}
    </div>
  );
}
