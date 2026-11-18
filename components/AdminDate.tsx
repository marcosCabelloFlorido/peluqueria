"use client";
import { useRouter } from "next/navigation";

export default function AdminDate({ value, view }: { value: string; view: "day" | "week" }) {
  const r = useRouter();
  return (
    <label className="chip !min-h-10 !px-4 cursor-pointer gap-2">
      <span>Elegir fecha</span>
      <input
        type="date"
        value={value}
        aria-label="Elegir fecha"
        className="bg-transparent text-sm w-[8.5rem] cursor-pointer"
        onChange={(e) => e.target.value && r.push(`/admin?d=${e.target.value}${view === "week" ? "&v=week" : ""}`)}
      />
    </label>
  );
}
