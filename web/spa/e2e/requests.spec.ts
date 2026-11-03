import { duplicates, expect, loaded, routes, test, trackApi } from "./support";

// A request sent twice is a bug the eye cannot see: StrictMode mounting a screen twice, a
// queryFn reading React Query's `signal`, an effect that refetches what the stream just said.
// Each check below is "no URL was read twice within one action".

test("a full page load reads each URL once", async ({ browser, seed }) => {
  // One context per screen, all at once: each page's reads are its own, so they cannot mix.
  const dups = (
    await Promise.all(
      routes(seed).map(async (route) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const api = trackApi(page);
        await page.goto(route);
        await loaded(page);
        await page.waitForTimeout(800); // a late duplicate comes from the stream's `ready`
        const d = duplicates(api.take());
        await ctx.close();
        return d.length ? `${route}: ${d.join(", ")}` : "";
      }),
    )
  ).filter(Boolean);
  expect(dups).toEqual([]);
});

test("moving through the sidebar reads each URL once per move", async ({ page }) => {
  await page.goto("/app/");
  await loaded(page);
  await page.waitForTimeout(800);
  const api = trackApi(page);
  api.take();
  const dups: string[] = [];
  for (const to of ["/app/runs", "/app/workflows", "/app/", "/app/ingest/streams", "/app/ingest/loads", "/app/data", "/app/data/endpoints", "/app/", "/app/runs"]) {
    await page.locator(`nav a[href="${to}"], nav a[href="${to.replace(/\/$/, "")}"]`).first().click();
    await loaded(page);
    await page.waitForTimeout(700);
    const d = duplicates(api.take());
    if (d.length) dups.push(`-> ${to}: ${d.join(", ")}`);
  }
  expect(dups).toEqual([]);
});

test("searching and opening a run read each URL once", async ({ page, seed }) => {
  await page.goto("/app/workflows");
  await loaded(page);
  const api = trackApi(page);
  api.take();
  await page.getByRole("searchbox").fill(seed.slug.slice(0, 4));
  await page.waitForTimeout(1500);
  expect(duplicates(api.take()), "workflows search").toEqual([]);

  await page.goto("/app/runs");
  await loaded(page);
  api.take();
  await page.locator("#runs-list a[href*='/runs/']").first().click();
  await page.waitForTimeout(1500);
  expect(duplicates(api.take()), "open a run").toEqual([]);
});
