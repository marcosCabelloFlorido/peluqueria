"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Tab } from "./Icons";

export default function NavLink({ href, to, label, d }: { href: string; to: string; label: string; d: string }) {
  const active = usePathname().startsWith(to);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl text-[11px] transition-colors ${active ? "text-ink font-medium" : "text-g3 hover:text-g4"}`}
    >
      {active && <motion.span layoutId="navPill" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
      <span className="relative"><Tab d={d} /></span>
      <span className="relative">{label}</span>
    </Link>
  );
}
