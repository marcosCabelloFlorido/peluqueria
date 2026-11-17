"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tab } from "./Icons";

export default function NavLink({ href, to, label, d }: { href: string; to: string; label: string; d: string }) {
  const active = usePathname().startsWith(to);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-1 h-16 text-xs ${active ? "text-ink font-medium" : "text-g4"}`}
    >
      <Tab d={d} />
      {label}
    </Link>
  );
}
