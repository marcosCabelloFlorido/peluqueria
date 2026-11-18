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
      className={`relative flex flex-col items-center justify-center gap-0.5 h-14 rounded-full text-[11px] transition-colors ${active ? "text-ink font-medium" : "text-white/55 hover:text-white"}`}
    >
      {active && <motion.span layoutId="navPill" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
      <span className="relative"><Tab d={d} /></span>
      <span className="relative">{label}</span>
    </Link>
  );
}
