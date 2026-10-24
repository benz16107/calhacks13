// Checks that a case folder matches the input format in README.md. Usage: node tracks/credit-desk/check-case.ts <case-dir>
// It checks structure and references only. Planted errors (wrong totals, odd dates) are valid input and pass.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Row = Record<string, string>;

export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header = [], ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// file -> [id column, required columns, number columns, date columns]
const TABLES: Record<string, [string, string[], string[], string[]]> = {
  "customers.csv": ["customer_id", ["legal_name", "terms", "credit_limit"], ["credit_limit"], ["last_credit_review"]],
  "invoices.csv": ["invoice_id", ["customer_id", "invoice_date", "terms", "due_date", "total"], ["total", "amount_paid", "discount_allowed", "balance"], ["invoice_date", "due_date"]],
  "invoice_lines.csv": ["", ["invoice_id", "qty", "unit_price", "line_total"], ["qty", "unit_price", "line_total"], []],
  "payments.csv": ["payment_id", ["received_date", "customer_id", "amount"], ["amount", "discount_taken"], ["received_date", "payment_date"]],
  "orders.csv": ["order_id", ["customer_id", "order_date", "amount"], ["amount"], ["order_date", "requested_ship_date"]],
  "sources/bank_statements.csv": ["", ["application_id", "month", "deposits_total"], ["deposits_total"], []],
};
// [file, column, file it must point into]
const REFS: [string, string, string][] = [
  ["invoices.csv", "customer_id", "customers.csv"],
  ["invoice_lines.csv", "invoice_id", "invoices.csv"],
  ["payments.csv", "customer_id", "customers.csv"],
  ["payments.csv", "applied_invoice_id", "invoices.csv"],
  ["orders.csv", "customer_id", "customers.csv"],
];

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isNum = (s: string) => s !== "" && Number.isFinite(Number(s));
const get = (o: any, path: string) => path.split(".").reduce((v, k) => (v == null ? undefined : v[k]), o);

export function checkCase(dir: string): { problems: string[]; summary: string[] } {
  const problems: string[] = [];
  const summary: string[] = [];
  const read = (f: string) => readFileSync(join(dir, f), "utf8");
  const json = (f: string) => {
    try { return JSON.parse(read(f)); } catch (e) { problems.push(`${f}: not valid JSON (${(e as Error).message})`); return undefined; }
  };

  if (!existsSync(join(dir, "case.json"))) return { problems: [`case.json is missing in ${dir}`], summary };
  const meta = json("case.json") ?? {};
  if (!meta.case_id) problems.push("case.json: case_id is required");
  if (!isDate(meta.as_of ?? "")) problems.push("case.json: as_of must be a YYYY-MM-DD date");

  const tables: Record<string, Row[]> = {};
  for (const [file, [idCol, required, nums, dates]] of Object.entries(TABLES)) {
    if (!existsSync(join(dir, file))) continue;
    const rows = parseCsv(read(file));
    tables[file] = rows;
    const cols = new Set(rows.length ? Object.keys(rows[0]) : read(file).split(/\r?\n/)[0].split(",").map((c) => c.trim()));
    for (const c of [idCol, ...required].filter(Boolean)) if (!cols.has(c)) problems.push(`${file}: missing column ${c}`);
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const at = `${file} row ${i + 2}`;
      if (idCol) {
        if (!r[idCol]) problems.push(`${at}: ${idCol} is empty`);
        else if (seen.has(r[idCol])) problems.push(`${at}: duplicate ${idCol} ${r[idCol]}`);
        seen.add(r[idCol]);
      }
      for (const c of nums) if (cols.has(c) && r[c] !== "" && !isNum(r[c])) problems.push(`${at}: ${c} "${r[c]}" is not a number`);
      for (const c of required) if (cols.has(c) && r[c] === "") problems.push(`${at}: ${c} is empty`);
      for (const c of dates) if (cols.has(c) && r[c] !== "" && !isDate(r[c])) problems.push(`${at}: ${c} "${r[c]}" is not YYYY-MM-DD`);
    });
    summary.push(`${file}: ${rows.length} rows`);
  }
  for (const [file, col, target] of REFS) {
    if (!tables[file] || !tables[target]) continue;
    const ids = new Set(tables[target].map((r) => r[TABLES[target][0]]));
    tables[file].forEach((r, i) => {
      if (r[col] && !ids.has(r[col])) problems.push(`${file} row ${i + 2}: ${col} ${r[col]} is not in ${target}`);
    });
  }

  const appIds = new Set<string>();
  if (existsSync(join(dir, "applications"))) {
    for (const f of readdirSync(join(dir, "applications")).filter((f) => f.endsWith(".json")).sort()) {
      const a = json(`applications/${f}`);
      if (!a) continue;
      if (a.application_id !== basename(f, ".json")) problems.push(`applications/${f}: application_id must match the file name`);
      appIds.add(a.application_id);
      for (const p of ["business.legal_name", "guarantor.first_name", "guarantor.last_name", "guarantor.home_address.line1",
        "guarantor.home_address.city", "guarantor.home_address.state", "guarantor.home_address.zip", "received_at"]) {
        if (typeof get(a, p) !== "string" || !get(a, p)) problems.push(`applications/${f}: ${p} is required`);
      }
      for (const p of ["business.annual_revenue", "business.years_in_business", "request.credit_limit"]) {
        if (typeof get(a, p) !== "number") problems.push(`applications/${f}: ${p} must be a number`);
      }
      if (!/^\d{9}$/.test(get(a, "guarantor.ssn") ?? "")) problems.push(`applications/${f}: guarantor.ssn must be 9 digits`);
      if (!isDate(get(a, "guarantor.dob") ?? "")) problems.push(`applications/${f}: guarantor.dob must be YYYY-MM-DD`);
    }
    summary.push(`applications: ${appIds.size}`);
  }
  if (tables["sources/bank_statements.csv"]) {
    tables["sources/bank_statements.csv"].forEach((r, i) => {
      if (!appIds.has(r.application_id)) problems.push(`sources/bank_statements.csv row ${i + 2}: application_id ${r.application_id} has no application`);
    });
  }

  if (existsSync(join(dir, "answer_key.json"))) {
    const key = json("answer_key.json") ?? {};
    const rulesPath = meta.rules ? resolve(dir, meta.rules) : "";
    const rulesText = rulesPath && existsSync(rulesPath) ? readFileSync(rulesPath, "utf8") : "";
    const locs = [...(key.planted_errors ?? []), ...(key.not_errors ?? [])].flatMap((e: any) => e.where ?? []);
    for (const loc of locs) {
      if (!existsSync(join(dir, loc.file))) { problems.push(`answer_key.json: ${loc.file} does not exist`); continue; }
      if (!loc.id) continue;
      const t = tables[loc.file];
      const found = t ? t.some((r) => Object.values(r)[0] === loc.id) : read(loc.file).includes(`"${loc.id}"`);
      if (!found) problems.push(`answer_key.json: ${loc.id} not found in ${loc.file}`);
    }
    const cited = [...(key.planted_errors ?? []), ...(key.application_decisions ?? []).map((d: any) => d.desk)].flatMap((x: any) => x.rules ?? []);
    if (rulesText) for (const id of new Set(cited)) if (!new RegExp(`id: ${id}\\s*$`, "m").test(rulesText)) problems.push(`answer_key.json: rule ${id} is not in ${meta.rules}`);
    for (const d of key.application_decisions ?? []) if (!appIds.has(d.application_id)) problems.push(`answer_key.json: ${d.application_id} has no application`);
    summary.push(`answer_key.json: ${(key.planted_errors ?? []).length} planted errors`);
  }
  return { problems, summary };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: node tracks/credit-desk/check-case.ts <case-dir>"); process.exit(2); }
  const { problems, summary } = checkCase(dir);
  summary.forEach((s) => console.log(s));
  problems.forEach((p) => console.error(`problem: ${p}`));
  console.log(problems.length ? `${problems.length} problems` : "case OK");
  process.exit(problems.length ? 1 : 0);
}
