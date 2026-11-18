"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Arrow } from "./Icons";

const NAME = "DouceCreative".split("");
const TAGLINE = ["Tu", "cambio", "empieza", "aquí."];
const ease = [0.22, 1, 0.36, 1] as const;

// caída con rebote suave; rotación fija por índice (sin Math.random → sin desajuste de hidratación)
const tilt = (i: number) => ((i * 37) % 31) - 15;

export default function Welcome() {
  const reduce = useReducedMotion();
  const [fast, setFast] = useState<boolean | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem("dc_seen");
      localStorage.setItem("dc_seen", "1");
    } catch {}
    setFast(seen);
  }, []);

  const go = fast !== null;
  const k = fast ? 0.35 : 1; // escala de tiempos para visitas repetidas
  const fall = (i: number, base: number, step: number) => ({
    initial: reduce ? { opacity: 0 } : { y: "-120vh", rotate: tilt(i), opacity: 0 },
    animate: go ? { y: 0, rotate: 0, opacity: 1 } : undefined,
    transition: reduce
      ? { duration: 0.4, delay: base * k }
      : {
          delay: (base + i * step) * k,
          y: { type: "spring" as const, stiffness: 170, damping: 13, mass: 1 },
          rotate: { type: "spring" as const, stiffness: 120, damping: 9 },
          opacity: { duration: 0.15, delay: (base + i * step) * k },
        },
  });

  return (
    <div className="relative min-h-dvh overflow-hidden bg-paper">
      <main className="mx-auto max-w-md min-h-dvh flex flex-col justify-between px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div />

        <div>
          <h1 className="display flex text-[clamp(2.4rem,12.5vw,3.6rem)] leading-none font-semibold" aria-label="DouceCreative">
            {NAME.map((c, i) => (
              <motion.span key={i} aria-hidden className="inline-block will-change-transform" {...fall(i, 0.1, 0.07)}>
                {c}
              </motion.span>
            ))}
          </h1>

          <p className="display mt-5 flex flex-wrap gap-x-[0.35em] text-3xl leading-tight text-g4" aria-label="Tu cambio empieza aquí.">
            {TAGLINE.map((w, i) => (
              <motion.span key={w} aria-hidden className="inline-block will-change-transform" {...fall(i, 1.35, 0.2)}>
                {w}
              </motion.span>
            ))}
          </p>
        </div>

        <motion.div
          className="w-full grid grid-cols-2 gap-2"
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={go ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, ease, delay: 2.4 * k }}
        >
          <Link href="/reservar" className="btn btn-primary">
            Pedir cita <Arrow />
          </Link>
          <Link href="/login?next=/citas" className="btn btn-secondary">
            Ver citas
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
