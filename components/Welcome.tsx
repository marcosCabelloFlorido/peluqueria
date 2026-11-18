import type { CSSProperties } from "react";
import Link from "next/link";
import { Arrow } from "./Icons";

const NAME = "DouceCreative".split("");
const TAGLINE = ["Tu", "cambio", "empieza", "aquí"];

// animación en globals.css (.drop / .rise / .rule); aquí solo retrasos y distancia de caída
const s = (delay: number, y?: string): CSSProperties =>
  ({ "--d": `${delay.toFixed(2)}s`, ...(y ? { "--y": y } : {}) }) as CSSProperties;

export default function Welcome() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-paper">
      <main className="mx-auto max-w-md min-h-dvh flex flex-col justify-between px-7 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div />

        <div>
          <h1 className="display flex text-[clamp(2.5rem,13vw,3.75rem)] leading-none font-semibold tracking-[-0.045em]" aria-label="DouceCreative">
            {NAME.map((c, i) => (
              <span key={i} aria-hidden className="drop" style={s(0.15 + i * 0.07, "-75vh")}>
                {c}
              </span>
            ))}
          </h1>

          <div className="rule mt-6 h-px w-full bg-ink" style={s(1.5)} aria-hidden />

          <p className="mt-5 flex flex-wrap gap-x-[0.7em] text-[0.75rem] font-medium uppercase tracking-[0.28em] text-g4" aria-label="Tu cambio empieza aquí.">
            {TAGLINE.map((w, i) => (
              <span key={w} aria-hidden className="drop" style={s(1.8 + i * 0.12, "-30vh")}>
                {w}
              </span>
            ))}
          </p>
        </div>

        <div className="rise w-full grid grid-cols-2 gap-2" style={s(2.5)}>
          <Link href="/reservar" className="btn btn-primary">
            Pedir cita <Arrow />
          </Link>
          <Link href="/login?next=/citas" className="btn btn-secondary">
            Ver citas
          </Link>
        </div>
      </main>
    </div>
  );
}
