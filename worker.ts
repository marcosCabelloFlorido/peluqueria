import handler from "./.open-next/worker.js";

type Env = { SITE_URL: string; CRON_SECRET: string };

export default {
  fetch: handler.fetch,
  // Cron Trigger -> endpoint idempotente de recordatorios (también mantiene activa la BD).
  async scheduled(_: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const headers = { Authorization: `Bearer ${env.CRON_SECRET}` };
    ctx.waitUntil(fetch(`${env.SITE_URL}/api/cron/reminders`, { headers }));
    // Resumen diario al admin: el endpoint solo envía a las 21:00 (Madrid).
    ctx.waitUntil(fetch(`${env.SITE_URL}/api/cron/daily-summary`, { headers }));
    // Reactivación de clientes inactivos: el endpoint solo envía a las 11:00 (Madrid).
    ctx.waitUntil(fetch(`${env.SITE_URL}/api/cron/winback`, { headers }));
  },
};
