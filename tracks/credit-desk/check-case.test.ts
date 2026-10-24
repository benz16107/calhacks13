// Run: node --test tracks/credit-desk/check-case.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCase, parseCsv } from "./check-case.ts";

const CASE = join(import.meta.dirname, "cases", "fogline-2026-10");

test("parses quoted fields with commas and quotes", () => {
  assert.deepEqual(parseCsv('a,b\n"1,000","say ""hi"""\n'), [{ a: "1,000", b: 'say "hi"' }]);
});

test("the shipped case passes", () => {
  assert.deepEqual(checkCase(CASE).problems, []);
});

test("a broken case is caught", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "case-")), "c");
  cpSync(CASE, dir, { recursive: true });
  const inv = join(dir, "invoices.csv");
  writeFileSync(inv, readFileSync(inv, "utf8").replace("INV-24044,C-1002", "INV-24044,C-9999").replace("INV-24047,C-1002", "INV-24047,"));
  const app = join(dir, "applications", "APP-1041.json");
  writeFileSync(app, readFileSync(app, "utf8").replace('"credit_limit": 8000', '"credit_limit": "8000"'));
  const problems = checkCase(dir).problems.join("\n");
  assert.match(problems, /customer_id C-9999 is not in customers.csv/);
  assert.match(problems, /invoices.csv row 3: customer_id is empty/);
  assert.match(problems, /APP-1041.json: request.credit_limit must be a number/);
});
