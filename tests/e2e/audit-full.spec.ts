import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/sandbox/memory");
  // Clear localStorage for deterministic state
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
});

// Helper: retain a transcript
async function retain(page: Page, text: string) {
  const textarea = page.locator("textarea").first();
  await textarea.fill(text);
  await page.getByRole("button", { name: "Retain" }).last().click();
  await page.waitForTimeout(4000);
}

// Helper: recall a query
async function recall(page: Page, query: string) {
  await page.getByText("Recall").first().click();
  await page.waitForTimeout(1500);
  const input = page.locator("input").first();
  await input.fill(query);
  await page.getByRole("button", { name: "Run recall" }).first().click();
  await page.waitForTimeout(5000);
}

test("TM-046: exact fact retrieval - database", async ({ page }) => {
  await retain(page, "User: We are using PostgreSQL as our primary database.\nAssistant: Noted, PostgreSQL is the database.");

  await recall(page, "Which database are we using?");

  const body = await page.locator("body").innerText();
  console.log("TM-046 DB result:", body.includes("PostgreSQL"));
  await page.screenshot({ path: "test-results/tm046-db.png" });
  expect(body).toContain("PostgreSQL");
});

test("TM-047: exact fact retrieval - frontend", async ({ page }) => {
  await retain(page, "User: Our frontend is built with Next.js.\nAssistant: Got it, Next.js frontend.");

  await recall(page, "What is our frontend?");

  const body = await page.locator("body").innerText();
  console.log("TM-047 Frontend result:", body.includes("Next.js"));
  await page.screenshot({ path: "test-results/tm047.png" });
  expect(body).toContain("Next.js");
});

test("TM-061: hallucination - nonexistent approver", async ({ page }) => {
  await recall(page, "Who approved the Kubernetes migration?");

  const body = await page.locator("body").innerText();
  const hasInvented =
    /approved by|John|Sarah|Mike|David/i.test(body) &&
    !body.includes("not found") &&
    !body.includes("no ") &&
    !body.includes("unavailable");
  console.log("TM-061 Hallucination check - invented name?", hasInvented);
  await page.screenshot({ path: "test-results/tm061.png" });
  expect(hasInvented).toBe(false);
});

test("TM-071: temporal - version evolution", async ({ page }) => {
  await retain(page, "User: We are using PostgreSQL 14.\nAssistant: Noted, PostgreSQL 14.");
  await retain(page, "User: We upgraded to PostgreSQL 15 last week.\nAssistant: Noted, PostgreSQL 15.");

  await recall(page, "What version of PostgreSQL are we using?");

  const body = await page.locator("body").innerText();
  console.log("TM-071: PostgreSQL 15 in results?", body.includes("15"));
  console.log("TM-071: PostgreSQL 14 in results?", body.includes("14"));
  await page.screenshot({ path: "test-results/tm071.png" });
  expect(body).toContain("15");
});

test("TM-072: entity scoping - Alice work", async ({ page }) => {
  await retain(page, "User: Alice works at Acme Corp.\nAssistant: Noted, Alice at Acme.");
  await retain(page, "User: Bob works at Beta Inc.\nAssistant: Noted, Bob at Beta.");

  await recall(page, "Where does Alice work?");

  const body = await page.locator("body").innerText();
  console.log("TM-072: Alice result has Acme?", body.includes("Acme"));
  console.log("TM-072: Alice result has Beta?", body.includes("Beta"));
  await page.screenshot({ path: "test-results/tm072.png" });
  expect(body).toContain("Acme");
});
