"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { Arrow } from "./Icons";
import ThemeToggle from "./ThemeToggle";

const NAME = "DouceCreative".split("");
const TAGLINE = ["Tu", "cambio", "empieza", "aquí"];

// animación en globals.css (.drop / .rise / .rule); aquí solo retrasos y distancia de caída
const s = (delay: number, y?: string): CSSProperties =>
  ({ "--d": `${delay.toFixed(2)}s`, ...(y ? { "--y": y } : {}) }) as CSSProperties;

export default function Welcome() {
  const cta = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    cta.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="welcome relative grid min-h-dvh place-items-center overflow-hidden bg-[#050506] px-4 py-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="absolute right-5 top-[calc(1rem+env(safe-area-inset-top))] z-20">
        <ThemeToggle />
      </div>

      <div className="mirror-frame">
        <span aria-hidden className="mirror-frame-glow" />

        <div className="relative flex w-full flex-col items-center text-center">
          <h1
            className="display flex flex-wrap justify-center text-[clamp(1.85rem,8.6vw,2.5rem)] leading-none font-semibold tracking-[-0.05em] text-white"
            aria-label="DouceCreative"
          >
            {NAME.map((c, i) => (
              <span key={i} aria-hidden className="drop" style={s(0.2 + i * 0.06, "-26vh")}>
                {c}
              </span>
            ))}
          </h1>

          <div className="rule mt-5 h-px w-24 bg-white/30" style={s(1.3)} aria-hidden />

          <p
            className="mt-5 flex flex-wrap justify-center gap-x-[0.7em] text-[0.68rem] font-medium uppercase tracking-[0.26em] text-white/75"
            aria-label="Tu cambio empieza aquí."
          >
            {TAGLINE.map((w, i) => (
              <span key={w} aria-hidden className="drop" style={s(1.5 + i * 0.1, "-22vh")}>
                {w}
              </span>
            ))}
          </p>
        </div>

        <div className="relative mt-[clamp(1.75rem,5vh,2.5rem)] grid w-full gap-2">
          <Link ref={cta} href="/reservar" className="btn led-solid bg-white text-[#0b0b0c]">
            Pedir cita <Arrow />
          </Link>
          <Link href="/login?next=/citas" className="btn led-line text-white">
            Ver citas
          </Link>
        </div>
      </div>
    </div>
  );
}
