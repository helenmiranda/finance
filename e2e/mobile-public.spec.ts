import { expect, test } from "@playwright/test";

test.describe("PWA mobile público", () => {
  test("login cabe na tela e mantém os campos acessíveis", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entre no Poupemos" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("rota protegida direciona para o login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("manifesto contém os recursos necessários para instalação", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBeTruthy();
  });

  test("tela offline explica que dados financeiros não ficam em cache", async ({ page }) => {
    await page.goto("/offline.html");
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
    await expect(page.getByText("Os dados financeiros não ficam armazenados offline por segurança.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
