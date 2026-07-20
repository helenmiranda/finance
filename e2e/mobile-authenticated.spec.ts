import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("PWA mobile autenticado", () => {
  test.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para validar jornadas autenticadas.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email ?? "");
    await page.getByLabel("Senha").fill(password ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("menu navega com feedback imediato", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir navegação" }).click();
    const transactions = page.getByRole("navigation", { name: "Navegação móvel" }).getByRole("link", { name: "Transações" });
    await transactions.click({ noWaitAfter: true });
    await expect(page.locator("html")).toHaveClass(/navigation-pending/);
    await expect(page).toHaveURL(/\/dashboard\/transacoes/);
    await expect(page.getByRole("heading", { name: "Transações" })).toBeVisible();
  });

  test("dashboard, contas e cartões não criam rolagem horizontal", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/contas", "/dashboard/cartoes"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
});
