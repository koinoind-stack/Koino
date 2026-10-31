// Merge i18n-en-ext-*.mjs exports into src/lib/i18n/en.ts (idempotent).
// Existing keys are never overwritten; duplicate keys across ext files are
// reported once. Appends a single "// ─── Full-site translation keys ───"
// section before the final closing brace.
import { promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EN = path.join(ROOT, "..", "src", "lib", "i18n", "en.ts");

const extFiles = ["i18n-en-ext-1.mjs", "i18n-en-ext-2.mjs", "i18n-en-ext-3.mjs", "i18n-en-ext-4.mjs"];

function parseEn(src) {
  const start = src.indexOf("export const en: Record<string, string> = {");
  if (start === -1) throw new Error("en export not found");
  const objStart = src.indexOf("{", start);
  const objEnd = src.lastIndexOf("};");
  const body = src.slice(objStart + 1, objEnd);
  const keys = new Map();
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(body))) keys.set(m[1], m[2]);
  return { keys, objStart, objEnd };
}

const src = await fs.readFile(EN, "utf8");
const { keys, objEnd } = parseEn(src);
const before = keys.size;

const sections = [];
const seen = new Set();
let dupes = 0;
for (const f of extFiles) {
  const mod = await import(path.join(ROOT, f));
  for (const [section, entries] of Object.entries(mod)) {
    const lines = [];
    for (const [k, v] of Object.entries(entries)) {
      if (keys.has(k)) { dupes++; continue; } // already in en.ts — skip
      if (seen.has(k)) { dupes++; continue; } // dup across files — skip
      seen.add(k);
      keys.set(k, v);
      const esc = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
      lines.push(`  "${k}": "${esc}",`);
    }
    if (lines.length) sections.push(`  // ─── ${section} ───\n` + lines.join("\n"));
  }
}

if (!sections.length) {
  console.log(`No new keys to merge (en has ${before} keys). Done.`);
  process.exit(0);
}

const out = src.slice(0, objEnd) + "\n  // ─── Full-site translation keys (complete-website-translation) ───\n" +
  sections.join("\n\n") + "\n" + src.slice(objEnd);
await fs.writeFile(EN, out);
console.log(`en.ts: ${before} → ${keys.size} keys (+${keys.size - before}); skipped duplicates: ${dupes}`);
