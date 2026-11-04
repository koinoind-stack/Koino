// Backfill Telugu translations for en.ts keys that are missing or still
// English in te.ts. Uses z-ai-web-dev-sdk chat completions. Checkpointed:
// progress persists in scripts/.te-backfill-progress.json — safe to re-run.
import ZAI from "z-ai-web-dev-sdk";
import { promises as fs } from "fs";
import * as path from "path";
import * as url from "url";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const EN_PATH = path.join(ROOT, "src/lib/i18n/en.ts");
const TE_PATH = path.join(ROOT, "src/lib/i18n/te.ts");
const PROGRESS = path.join(ROOT, "scripts/.te-backfill-progress.json");
const CHUNK = 25;
const CONCURRENCY = 1;
const BATCH_DELAY = 2000;
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS || "0"); // 0 = run all

function parseDict(src, name) {
  const start = src.indexOf(`export const ${name}: Record<string, string> = {`);
  if (start === -1) throw new Error(`${name} export not found`);
  const objStart = src.indexOf("{", start);
  const objEnd = src.lastIndexOf("};");
  const obj = eval("(" + src.slice(objStart, objEnd + 1).replace(/;$/, "") + ")");
  return { obj, objStart, objEnd };
}

const enSrc = await fs.readFile(EN_PATH, "utf8");
const teSrc = await fs.readFile(TE_PATH, "utf8");
const en = parseDict(enSrc, "en").obj;
const te = parseDict(teSrc, "te").obj;

const allowExact = /^(Koino|KJV|WEB|FP|MRP|ESV|WhatsApp|India|\+91…?$|https?:)/;
const todo = Object.keys(en).filter((k) => {
  const v = te[k];
  return v === undefined || (v === en[k] && !allowExact.test(v));
});

let done = {};
try { done = JSON.parse(await fs.readFile(PROGRESS, "utf8")); } catch {}
const pending = todo.filter((k) => !(k in done));
console.log(`Telugu backfill: ${todo.length} to translate, ${Object.keys(done).length} already done, ${pending.length} pending`);

if (pending.length === 0) { console.log("ALL-DONE"); process.exit(0); }

const SYSTEM = `You are a professional English→Telugu (తెలుగు) localizer for KOINO, a Christian community web app used by Telugu-speaking Christians across India.

Translate each UI string to natural, modern, warm Telugu that an ordinary church member understands. Rules:
1. Output ONLY valid JSON: an object mapping every input key to its Telugu string. No commentary, no markdown fences.
2. Preserve every {placeholder}, {count}, {name}, {n}, {q} etc. EXACTLY as-is, including braces.
3. Never translate brand/product names or technical tokens: Koino, WhatsApp, YouTube, Zoom, Google, UPI, QR, PDF, URL, ID, FP, MRP, KJV, WEB, MDX, JPG, PNG, WEBP, MP4, India (place name).
4. Use this Christian glossary consistently: Bible=బైబిల్, God=దేవుడు, Jesus=యేసు, Christ=క్రీస్తు, Lord=ప్రభువు, prayer=ప్రార్థన, church=చర్చి, faith=విశ్వాసం, fellowship=సహవాసం, worship=ఆరాధన, gospel=సువార్త, salvation=రక్షణ, grace=కృప, Holy Spirit=పరిశుద్ధాత్మ, verse=వచనం, chapter=అధ్యాయం, testimony=సాక్ష్యం, blessing=ఆశీర్వాదం, Amen=ఆమెన్, disciple=శిష్యుడు, Scripture=శాస్త్రము, community=సంఘం, worship service=ఆరాధనా సమావేశం.
5. Use established app vocabulary: post=పోస్ట్, reel=రీల్, story=స్టోరీ, feed=ఫీడ్, follow=ఫాలో, followers=ఫాలోవర్స్, notifications=నోటిఫికేషన్లు, groups=గ్రూపులు, marketplace=మార్కెట్‌ప్లేస్, trivia=ట్రివియా, comics=కామిక్స్, profile=ప్రొఫైల్, comment=కామెంట్, like=లైక్, share=షేర్, upload=అప్‌లోడ్, points=పాయింట్లు, streak=స్ట్రీక్, leaderboard=లీడర్‌బోర్డ్, sign in=సైన్ ఇన్, cart=కార్ట్, wishlist=విష్‌లిస్ట్, admin=అడ్మిన్.
6. Buttons and menu items: short polite imperatives (e.g. save=సేవ్ చేయి, delete=తొలగించు, cancel=రద్దు చేయి, submit=సమర్పించు, retry=మళ్లీ ప్రయత్నించండి). Sentences: polite మీరు form.
7. Keep meaning faithful; do not add theological interpretation. Emojis at the start/end of the source string are kept.
8. Keep translations concise so buttons don't overflow: prefer 2-4 words for labels.
9. If a string is already mostly a proper noun/format token (e.g. "-{percent}%", "+91…"), return it unchanged.
10. Telugu text must be pure Telugu script (plus allowed Latin tokens from rule 3/5) — never romanized Telugu.`;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const zai = await ZAI.create();
let failed = 0;

async function translateChunk(keys) {
  const payload = {};
  for (const k of keys) payload[k] = en[k];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await zai.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
        temperature: 0.2,
      });
      const text = (res.choices?.[0]?.message?.content || "").trim().replace(/^```(?:json)?|```$/g, "");
      const parsed = JSON.parse(text);
      const out = {};
      for (const k of keys) {
        const v = parsed[k];
        if (typeof v === "string" && v.length > 0) out[k] = v;
        else out[k] = en[k]; // safe fallback: keep English rather than lose the key
      }
      return out;
    } catch (e) {
      if (attempt === 2) { failed++; console.error(`chunk failed (${keys.length} keys): ${e.message}`); return {}; }
      await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
    }
  }
}

const batches = chunk(pending, CHUNK);
const rounds = MAX_ROUNDS > 0 ? batches.slice(0, MAX_ROUNDS) : batches;
for (let i = 0; i < rounds.length; i += CONCURRENCY) {
  const slice = rounds.slice(i, i + CONCURRENCY);
  const results = await Promise.all(slice.map((b) => translateChunk(b)));
  for (const r of results) Object.assign(done, r);
  await fs.writeFile(PROGRESS, JSON.stringify(done));
  process.stdout.write(`.`);
  await new Promise((r) => setTimeout(r, BATCH_DELAY));
}
console.log(`\nprogress: ${Object.keys(done).length}/${todo.length} (failed chunks: ${failed})`);
if (Object.keys(done).length >= todo.length) console.log("ALL-DONE");
