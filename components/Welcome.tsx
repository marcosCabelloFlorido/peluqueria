import type { CSSProperties } from "react";
import Link from "next/link";
import { Arrow } from "./Icons";

const NAME = "DouceCreative".split("");
const TAGLINE = ["Tu", "cambio", "empieza", "aquí."];

// rotación fija por índice y retraso escalonado; la animación vive en globals.css (.drop / .rise)
const tilt = (i: number) => ((i * 37) % 31) - 15;
const d = (delay: number, i = 0): CSSProperties =>
  ({ "--d": `${delay.toFixed(2)}s`, "--r": `${tilt(i)}deg` }) as CSSProperties;

export default function Welcome() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-paper">
      <main className="mx-auto max-w-md min-h-dvh flex flex-col justify-between px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div />

        <div>
          <h1 className="display flex text-[clamp(2.4rem,12.5vw,3.6rem)] leading-none font-semibold" aria-label="DouceCreative">
            {NAME.map((c, i) => (
              <span key={i} aria-hidden className="drop" style={d(0.1 + i * 0.06, i)}>
                {c}
              </span>
            ))}
          </h1>

          <p className="display mt-5 flex flex-wrap gap-x-[0.35em] text-3xl leading-tight text-g4" aria-label="Tu cambio empieza aquí.">
            {TAGLINE.map((w, i) => (
              <span key={w} aria-hidden className="drop" style={d(1.1 + i * 0.18, i + 3)}>
                {w}
              </span>
            ))}
          </p>
        </div>

        <div className="rise w-full grid grid-cols-2 gap-2" style={d(2.2)}>
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
