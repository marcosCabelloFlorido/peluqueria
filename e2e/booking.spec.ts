import { expect, test } from "@playwright/test";

test("usuario nuevo reserva y cancela una cita", async ({ page }) => {
  const email = `e2e${Date.now()}@test.dev`;

  // 0. Sin sesión se pide entrar o registrarse antes de reservar
  await page.goto("/reservar");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByPlaceholder("Nombre").fill("Cliente E2E");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("secret123");
  await page.locator("form").getByRole("button", { name: "Crear cuenta" }).click();

  // 1. Servicios
  await expect(page).toHaveURL(/\/reservar/);
  await page.getByRole("button", { name: /Barba/ }).click();
  await page.getByRole("button", { name: "Elegir fecha" }).click();

  // 2. Día y hora
  const day = page.locator('[role=grid] button:not([disabled])').first();
  await expect(day).toBeVisible();
  await day.click();
  const slot = page.getByRole("group", { name: "Horas disponibles" }).getByRole("button").first();
  await slot.click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // 3. Confirmar
  await expect(page.getByRole("heading", { name: "Confirma tu cita" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page.getByRole("heading", { name: "¡Cita confirmada!" })).toBeVisible();

  // 4. Mis citas + cancelar
  await page.getByRole("link", { name: "Ver mis citas" }).click();
  await expect(page.getByText("Confirmada")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Sí, cancelar cita" }).click();
  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.getByText("Cancelada")).toBeVisible();

  // sin scroll horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
