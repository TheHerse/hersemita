import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../app/api/coach-activities/route.ts", import.meta.url);
const layoutUrl = new URL("../../app/runners/upload/[runnerId]/layout.tsx", import.meta.url);
const pageUrl = new URL("../../app/runners/upload/[runnerId]/page.tsx", import.meta.url);

test("coach activity writes and upload screens revalidate runner team ownership", async () => {
  const [route, layout, page] = await Promise.all([
    readFile(routeUrl, "utf8"),
    readFile(layoutUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(route, /\.eq\("team_id", context\.team\.id\)/);
  assert.match(route, /hasTrustedRequestOrigin\(request\)/);
  assert.match(route, /readBoundedJson\(request, 24 \* 1024\)/);
  assert.match(layout, /\.eq\("team_id", context\.team\.id\)/);
  assert.doesNotMatch(page, /supabase\.from\("activities"\)\.insert/);
  assert.match(page, /fetch\("\/api\/coach-activities"/);
});
