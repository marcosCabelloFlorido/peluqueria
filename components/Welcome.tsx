"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Arrow } from "./Icons";

const NAME = "DouceCreative".split("");
const ease = [0.22, 1, 0.36, 1] as const;

export default function Welcome() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"splash" | "home">("splash");
  const [fast, setFast] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem("dc_seen");
      localStorage.setItem("dc_seen", "1");
    } catch {}
    setFast(seen);
    const t = setTimeout(() => setPhase("home"), seen ? 500 : 2200);
    return () => clearTimeout(t);
  }, []);

  const show = phase === "home" ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 24 };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-paper">
      <AnimatePresence>
        {phase === "splash" && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-10 grid place-items-center bg-ink text-paper"
            exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.7, ease } }}
          >
            <h1 className="display text-4xl font-semibold flex" aria-label="DouceCreative">
              {NAME.map((c, i) => (
                <span key={i} className="overflow-hidden inline-block" aria-hidden>
                  <motion.span
                    className="inline-block"
                    initial={{ y: reduce ? 0 : "110%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: (fast ? 0 : 0.2) + i * (fast ? 0.01 : 0.07), duration: fast ? 0.2 : 0.6, ease }}
                  >
                    {c}
                  </motion.span>
                </span>
              ))}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-md min-h-dvh flex flex-col justify-between px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="display text-2xl font-semibold">DouceCreative</p>
        <motion.div initial={false} animate={show} transition={{ duration: 0.6, ease, delay: 0.25 }}>
          <h2 className="display text-6xl leading-[0.95]">
            Tu estilo,
            <br />a tu hora.
          </h2>
          <p className="mt-5 text-g4">Reserva tu cita en menos de un minuto.</p>
        </motion.div>
        <motion.div className="flex flex-col items-center gap-2" initial={false} animate={show} transition={{ duration: 0.6, ease, delay: 0.4 }}>
          <Link href="/reservar" className="btn btn-primary">
            Reservar cita <Arrow />
          </Link>
          <Link href="/login" className="link">
            Ya tengo cuenta
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
