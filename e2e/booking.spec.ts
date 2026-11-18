import { expect, test } from "@playwright/test";

test("invitado reserva sin cuenta y luego entra para ver su cita", async ({ page }) => {
  const email = `e2e${Date.now()}@test.dev`;

  // 1. Servicios (sin sesión)
  await page.goto("/reservar");
  await page.getByRole("button", { name: /Barba/ }).click();
  await page.getByRole("button", { name: "Elegir fecha" }).click();

  // 2. Día y hora
  const day = page.locator('[role=grid] button:not([disabled])').last(); // último día: fuera del límite de cancelación
  await expect(day).toBeVisible();
  await day.click();
  const slot = page.getByRole("group", { name: "Horas disponibles" }).getByRole("button").first();
  await slot.click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // 3. Datos de contacto y confirmar
  await expect(page.getByRole("heading", { name: "Confirma tu cita" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirmar cita" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Nombre").fill("Cliente E2E");
  await page.getByLabel("Teléfono").fill("600123123");
  await page.getByLabel("Email").fill(email);
  await confirm.click();
  await expect(page.getByRole("heading", { name: "¡Cita confirmada!" })).toBeVisible();

  // 4. Modal opcional de login → crear cuenta → la cita queda en "Mis citas"
  await expect(page.getByRole("heading", { name: "¿Quieres iniciar sesión?" })).toBeVisible();
  await page.getByRole("link", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Entrar con contraseña" }).click();
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre").fill("Cliente E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("secret123");
  await page.locator("form").getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/citas/);

  // 5. Cancelar
  await expect(page.getByText("Confirmada")).toBeVisible();
  await page.waitForLoadState("networkidle"); // hidratación antes de pulsar
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Sí, cancelar cita" }).click();
  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.getByText("Cancelada")).toBeVisible();

  // sin scroll horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
