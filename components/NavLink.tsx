"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { motion } from "motion/react";
import { Arrow, Close, Tab } from "./Icons";

type Props = { href: string; to: string; label: string; d: string; guard?: boolean };

export default function NavLink({ href, to, label, d, guard }: Props) {
  const active = usePathname().startsWith(to);
  const dlg = useRef<HTMLDialogElement>(null);
  const cls = `relative flex flex-col items-center justify-center gap-0.5 h-14 w-full rounded-full text-[11px] transition-colors ${active ? "text-[#0b0b0c] font-medium" : "text-white/55 hover:text-white"}`;
  const inner = (
    <>
      {active && <motion.span layoutId="navPill" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
      <span className="relative"><Tab d={d} /></span>
      <span className="relative">{label}</span>
    </>
  );

  // sin sesión: en vez de saltar a /login, aviso emergente igual que al reservar
  if (guard) {
    return (
      <>
        <button type="button" className={cls} onClick={() => dlg.current?.showModal()} aria-haspopup="dialog">
          {inner}
        </button>
        <dialog ref={dlg} aria-labelledby={`login-${to}`} closedby="any" className="m-auto w-[min(92vw,22rem)] overflow-visible rounded-3xl bg-paper text-ink border border-g2 p-6 text-center backdrop:bg-black/40">
          <button type="button" aria-label="Cerrar" onClick={() => dlg.current?.close()} className="absolute -top-14 right-0 size-11 grid place-items-center rounded-full bg-black text-white border border-white/20 cursor-pointer"><Close /></button>
          <h2 id={`login-${to}`} className="display text-2xl">¿Quieres iniciar sesión?</h2>
          <p className="text-sm text-g4 mt-2">Solo tu email, sin contraseña. Verás {to === "/citas" ? "y cancelarás tus citas" : "tu perfil"} desde la app.</p>
          <div className="mt-5 flex flex-col gap-2 items-center">
            <Link href={href} className="btn btn-primary w-full justify-center">Iniciar sesión <Arrow /></Link>
            <Link href={href} className="link !text-ink">Crear cuenta</Link>          </div>
        </dialog>
      </>
    );
  }

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
      {inner}
    </Link>
  );
}
