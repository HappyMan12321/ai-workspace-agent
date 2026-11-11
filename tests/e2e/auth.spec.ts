import { expect, test } from "@playwright/test";

test("account screens are available and explain missing setup", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
});

test("private pages reject unauthenticated access", async ({ page }) => {
  for (const path of ["/app", "/reset-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?notice=setup$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Signed in as", { exact: false })).toHaveCount(0);
  }
});

test("confirmation links validate token details and ignore redirect injection", async ({ page }) => {
  await page.goto("/auth/confirm?type=recovery&next=https://attacker.example");
  await expect(page.getByRole("alert").filter({ hasText: "missing valid confirmation details" })).toBeVisible();
  await page.goto(`/auth/confirm?token_hash=${"a".repeat(64)}&type=recovery&next=https://attacker.example`);
  await expect(page.getByRole("button", { name: "Continue securely" })).toBeDisabled();
  await expect(page).toHaveURL(/127\.0\.0\.1/);
});

test("email confirmation pages suppress referrer leakage", async ({ request }) => {
  const response = await request.get("/auth/confirm");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});
