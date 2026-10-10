import { expect, test } from "@playwright/test";
import { getAxeResults, injectAxe } from "axe-playwright";

test("dashboard operations timeline exposes live telemetry controls without replacing the dashboard", async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/sandbox");

    const timeline = page.getByRole("region", { name: "Operations timeline" });
    await expect(timeline).toBeVisible();
    await expect(timeline.getByRole("button", { name: "Pause" })).toBeVisible();

    await timeline.getByRole("button", { name: "Pause" }).click();
    await expect(timeline.getByRole("button", { name: "Resume" })).toBeVisible();

    await timeline.getByRole("button", { name: "Table" }).click();
    await expect(timeline.getByRole("table", { name: "Telemetry values by timestamp" })).toBeVisible();

    const worldNetwork = page.getByRole("button", { name: /World 12 60%/ });
    await worldNetwork.focus();
    await page.keyboard.press("Enter");
    await expect(worldNetwork).toHaveAttribute("aria-pressed", "true");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await injectAxe(page);
    const results = await getAxeResults(page);
    expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")).map((violation) => violation.id), `width ${width}`).toEqual([]);
  }
});
