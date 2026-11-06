import { expect, test } from "@playwright/test";

test("setup screen and connection check work without credentials", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A foundation for getting things done." })).toBeVisible();
  await expect(page.getByText("Setup required", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByRole("status")).toContainText("Add your Supabase URL");
});
test("unconfigured health response is explicit and uncached", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ status: "not_configured", supabase: "missing_or_invalid_configuration" });
});
