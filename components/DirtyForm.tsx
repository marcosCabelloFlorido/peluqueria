"use client";
import { useEffect, useRef, useState } from "react";

const snap = (f: HTMLFormElement) =>
  JSON.stringify([...new FormData(f).entries()].map(([k, v]) => [k, typeof v === "string" ? v : v.name]));

/** Formulario cuyo botón de guardar solo aparece cuando hay cambios respecto a lo que se cargó. */
export default function DirtyForm({ action, label, className, buttonClass, children }: {
  action: (f: FormData) => void | Promise<void>; label: string; className?: string; buttonClass?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const base = useRef("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (ref.current) base.current = snap(ref.current); }, []);
  const check = () => { if (ref.current) setDirty(snap(ref.current) !== base.current); };

  return (
    <form ref={ref} action={action} className={className} onInput={check} onChange={check}
      onSubmit={() => { if (ref.current) base.current = snap(ref.current); setDirty(false); }}>
      {children}
      {dirty && <button className={buttonClass ?? "btn btn-secondary !min-h-11 text-sm"}>{label}</button>}
    </form>
  );
}
