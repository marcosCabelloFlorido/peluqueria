// Comprueba que e2e puede correr en local. Nunca contra Supabase remoto:
// el spec crea usuarios y citas reales.
import { existsSync } from "node:fs";

const stop = (why) => {
  process.stdout.write(`e2e no ejecutable: ${why}\n`);
  process.exit(3);
};

// Mismo orden de precedencia que Next en dev. loadEnvFile no pisa variables
// ya definidas, así que gana el primer archivo. No se cargan .env.production*.
for (const f of [".env.development.local", ".env.local", ".env.development", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

// Playwright reutiliza un servidor existente: no sabemos con qué entorno arrancó.
const busy = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(1500) }).then(
  () => true,
  () => false,
);
if (busy) stop("ya hay un servidor en :3000; páralo para que e2e arranque uno con el entorno comprobado");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  stop("NEXT_PUBLIC_SUPABASE_URL vacía o no válida");
}
if (!["127.0.0.1", "localhost"].includes(host)) stop(`Supabase no es local (${host})`);

try {
  const r = await fetch(new URL("/auth/v1/health", url), {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) stop(`Supabase local responde ${r.status}`);
} catch {
  stop("Supabase local apagado (npx supabase start)");
}

const { chromium } = await import("@playwright/test");
if (!existsSync(chromium.executablePath())) stop("faltan navegadores de Playwright (npx playwright install chromium)");
