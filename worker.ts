import handler from "./.open-next/worker.js";

type Env = { SITE_URL: string; CRON_SECRET: string };

export default {
  fetch: handler.fetch,
  // Cron Trigger -> endpoint idempotente de recordatorios (también mantiene activa la BD).
  async scheduled(_: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(
      fetch(`${env.SITE_URL}/api/cron/reminders`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }),
    );
  },
};
