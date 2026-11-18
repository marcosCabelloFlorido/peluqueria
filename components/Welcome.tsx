"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Arrow } from "./Icons";

const NAME = "DouceCreative".split("");
const ease = [0.22, 1, 0.36, 1] as const;
const SNIP = [0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0];

type Phase = "intro" | "cut" | "open" | "home";

function Title({ fast, hidden }: { fast: boolean; hidden?: boolean }) {
  return (
    <h1 className="display text-4xl font-semibold flex" aria-label={hidden ? undefined : "DouceCreative"} aria-hidden={hidden || undefined}>
      {NAME.map((c, i) => (
        <span key={i} className="overflow-hidden inline-block" aria-hidden>
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: (fast ? 0 : 0.2) + i * (fast ? 0.01 : 0.07), duration: fast ? 0.2 : 0.6, ease }}
          >
            {c}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function Scissors({ cutting }: { cutting: boolean }) {
  const blade = { transformOrigin: "24px 20px", transformBox: "view-box" as const };
  return (
    <svg width="96" height="48" viewBox="0 0 96 40" fill="none" aria-hidden className="block overflow-visible">
      <motion.g style={blade} animate={{ rotate: cutting ? SNIP : 0 }} transition={{ duration: 1.1, ease: "linear" }}>
        <circle cx="6" cy="20" r="5" stroke="var(--ink)" strokeWidth="2.5" />
        <path d="M11 20H24" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 16 92 20 20 24Z" fill="var(--ink)" />
      </motion.g>
      <motion.g style={blade} animate={{ rotate: cutting ? SNIP.map((v) => -v) : 0 }} transition={{ duration: 1.1, ease: "linear" }}>
        <circle cx="6" cy="20" r="5" stroke="var(--ink)" strokeWidth="2.5" />
        <path d="M11 20H24" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 16 92 20 20 24Z" fill="var(--ink)" />
      </motion.g>
      <circle cx="24" cy="20" r="2.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}

export default function Welcome() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("intro");
  const [fast, setFast] = useState(false);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (reduce) {
      setPhase("home");
      return;
    }
    let seen = false;
    try {
      seen = !!localStorage.getItem("dc_seen");
      localStorage.setItem("dc_seen", "1");
    } catch {}
    setFast(seen);
    setW(window.innerWidth);
    const cutAt = seen ? 450 : 1800;
    const cutDur = seen ? 650 : 1100;
    const openAt = cutAt + cutDur + 120;
    const t = [
      setTimeout(() => setPhase("cut"), cutAt),
      setTimeout(() => setPhase("open"), openAt),
      setTimeout(() => setPhase("home"), openAt + 1000),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduce]);

  const revealed = phase === "open" || phase === "home";
  const show = revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 24 };
  const cutDur = fast ? 0.65 : 1.1;
  const travel = w + 110;
  const split = { duration: 0.95, ease: [0.76, 0, 0.24, 1] as const };

  const half = (pos: "top" | "bottom") => (
    <motion.div
      className={`absolute inset-x-0 h-1/2 overflow-hidden bg-paper text-ink ${pos === "top" ? "top-0" : "bottom-0"}`}
      initial={false}
      animate={{ y: phase === "open" ? (pos === "top" ? "-101%" : "101%") : "0%" }}
      transition={split}
    >
      <div className="absolute inset-x-0 h-dvh grid place-items-center" style={pos === "top" ? { top: 0 } : { bottom: 0 }}>
        <Title fast={fast} hidden={pos === "bottom"} />
      </div>
    </motion.div>
  );

  return (
    <div className="relative min-h-dvh overflow-hidden bg-paper">
      {phase !== "home" && (
        <div className="fixed inset-0 z-10 pointer-events-none" aria-hidden={false}>
          {half("top")}
          {half("bottom")}

          {phase === "cut" && w > 0 && (
            <>
              <motion.div
                className="absolute left-0 top-1/2 h-0 w-full origin-left border-t-2 border-dashed border-ink"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: travel / w }}
                transition={{ duration: cutDur, ease: "easeInOut" }}
              />
              <div className="absolute left-0 top-1/2 -mt-6" style={{ marginLeft: -96 }}>
                <motion.div
                  initial={{ x: 0 }}
                  animate={{ x: travel }}
                  transition={{ duration: cutDur, ease: "easeInOut" }}
                >
                  <Scissors cutting />
                </motion.div>
              </div>
            </>
          )}
        </div>
      )}

      <main className="mx-auto max-w-md min-h-dvh flex flex-col justify-between px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <motion.p className="display text-2xl font-semibold" initial={false} animate={show} transition={{ duration: 0.6, ease, delay: 0.3 }}>
          DouceCreative
        </motion.p>
        <motion.div initial={false} animate={show} transition={{ duration: 0.7, ease, delay: 0.45 }}>
          <h2 className="display text-6xl leading-[0.95]">
            Tu estilo,
            <br />a tu hora.
          </h2>
          <p className="mt-5 text-g4">Reserva tu cita en menos de un minuto.</p>
        </motion.div>
        <motion.div className="flex flex-col items-center gap-2" initial={false} animate={show} transition={{ duration: 0.6, ease, delay: 0.65 }}>
          <div className="w-full grid grid-cols-2 gap-2">
            <Link href="/reservar" className="btn btn-primary">
              Pedir cita <Arrow />
            </Link>
            <Link href="/login?next=/citas" className="btn btn-secondary">
              Mis citas
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
