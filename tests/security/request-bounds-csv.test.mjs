import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "../../lib/csv.ts";
import { readBoundedJson } from "../../lib/request-body.ts";

test("bounded JSON rejects non-JSON and oversized request bodies", async () => {
  const wrongType = new Request("https://www.hersemita.com/api/test", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  assert.deepEqual(await readBoundedJson(wrongType, 100), {
    ok: false,
    status: 400,
    error: "Expected an application/json request",
  });

  const oversized = new Request("https://www.hersemita.com/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(200) }),
  });
  const result = await readBoundedJson(oversized, 100);
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
});

test("CSV output neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell("=HYPERLINK(\"https://attacker.example\")"), '"\'=HYPERLINK(""https://attacker.example"")"');
  assert.equal(csvCell("ordinary text"), '"ordinary text"');
});
