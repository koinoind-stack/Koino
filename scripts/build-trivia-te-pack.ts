// Build-time Telugu content pack for TriviaQuestion rows (NO production DB writes).
// Reads the 400 canonical seed questions, translates via ZAI using a LINE-BASED
// protocol (immune to LLM JSON escaping mistakes), validates Telugu script and
// option counts per item, writes src/lib/i18n/content/trivia-te.json
// Usage: npx tsx scripts/build-trivia-te-pack.ts
import fs from "fs";
import path from "path";
import ZAI from "z-ai-web-dev-sdk";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/lib/i18n/content/trivia-te.json");
const PROG = path.join(ROOT, "scripts/.trivia-te-progress.json");
const BATCH = 4;
const DELAY_MS = 3000;

type SeedQ = { questionId: string; question: string; options: string; explanation?: string };

const NAME_HINT = [
  "Noah=నోయె","Moses=మోషే","Abraham=అబ్రాహాము","Sarah=సారా","Isaac=ఇస్సాకు","Jacob=యాకోబు","Joseph=యోసేపు",
  "David=దావీదు","Goliath=గోలియాతు","Solomon=సొలొమోను","Jesus=యేసు","Mary=మరియు","John the Baptist=యోహాను బాప్తిస్తుడు",
  "Peter=పేతురు","Paul=పౌలు","John=యోహాను","James=యాకోబు","Matthew=మత్తయి","Mark=మార్కు","Luke=లూకా",
  "Thomas=తోమా","Judas=యూదా","Adam=ఆదాము","Eve=అవ్వ","Cain=కయీను","Abel=హాబెలు","Saul=సౌలు","Samuel=సమూయేలు",
  "Elijah=ఏలీయా","Elisha=ఏలీషా","Jonah=యోనా","Daniel=దానియేలు","Esther=ఎస్తేరు","Ruth=రూతు","Job=యోబు",
  "Isaiah=యెషయా","Jeremiah=యిర్మీయా","Ezekiel=యెహెజ్కేలు","Joshua=యెహోషువ","Caleb=కాలేబు","Aaron=అహరోను",
  "Hannah=అన్నా","Gideon=గిద్యోను","Samson=సమ్సోను","Rahab=రాహాబు","Pharaoh=ఫరోను","Pilate=పిలాతు",
  "Zacchaeus=జక్కయి","Lazarus=ఏలాజరు","Martha=మార్త","Barnabas=బర్నబా","Timothy=తిమోతి","Titus=తీతు",
  "Stephen=స్తేఫనసు","Philip=ఫిలిప్పు","Andrew=అంద్రియా","Naaman=నయమాను",
].join(", ");

const SYSTEM = `You are a professional English→Telugu translator for a Christian Bible-trivia app (Telugu Bible, BSI register).
OUTPUT FORMAT — follow EXACTLY. For every input item emit these lines:

@@ID=<the item's id>
@Q=<Telugu question>
@O=<Telugu option 1>
@O=<Telugu option 2>
(one @O line per source option, same order and same count)
@E=<Telugu explanation>

Rules:
- Translate faithfully and naturally; use standard Telugu Bible name transliterations. Glossary: ${NAME_HINT}.
- Bible book names in Telugu: Genesis=ఆదికాండము, Exodus=నిర్గమకాండము, Psalms=కీర్తనలు, Proverbs=సామెతలు, Matthew=మత్తయి, Revelation=ప్రకటన, etc.
- Do NOT add or invent facts; keep the same meaning and difficulty.
- Each @-line stays on ONE line: NEVER insert a newline inside a field. If text is long, keep writing on the same line.
- Never start a continuation line with @; if you must wrap, continue the previous field's line text directly.
- If explanation is empty in the source, write @E with nothing after it.
- No markdown, no code fences, no commentary — only the @@ID/@Q/@O/@E lines.`;

function isTelugu(s: string): boolean {
  return /[\u0C00-\u0C7F]/.test(s);
}

type Raw = { id: string; q: string; options: string[]; explanation: string };

function parseLineFormat(text: string): Raw[] {
  const items: Raw[] = [];
  let cur: Raw | null = null;
  let field: "@Q" | "@O" | "@E" | null = null;
  const appendToField = (line: string) => {
    if (!cur || !field) return;
    if (field === "@Q") cur.q += " " + line;
    else if (field === "@E") cur.explanation += " " + line;
    else if (cur.options.length > 0) cur.options[cur.options.length - 1] += " " + line;
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("@@ID=")) {
      cur = { id: line.slice(5).trim(), q: "", options: [], explanation: "" };
      field = null;
      items.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("@Q=")) { field = "@Q"; cur.q = line.slice(3); continue; }
    if (line.startsWith("@O=")) { field = "@O"; cur.options.push(line.slice(3)); continue; }
    if (line.startsWith("@E=")) { field = "@E"; cur.explanation = line.slice(3); continue; }
    if (line.startsWith("@")) { field = null; continue; } // unknown tag — stop field
    appendToField(line); // wrapped continuation
  }
  return items;
}

type Prog = { done: Record<string, { q: string; options: string[]; explanation: string }>; failed: string[] };
function loadProg(): Prog {
  try { return JSON.parse(fs.readFileSync(PROG, "utf8")); } catch { return { done: {}, failed: [] }; }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const seeds: SeedQ[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, "prisma/questions/part4_intermediate_complete.json"), "utf8")
  );
  const list = seeds.map((s) => ({
    id: s.questionId,
    question: s.question,
    options: JSON.parse(s.options) as string[],
    explanation: s.explanation ?? "",
  }));
  console.log(`[pack] canonical questions: ${list.length}`);

  const prog = loadProg();
  const out: Record<string, { q: string; options: string[]; explanation: string }> = { ...prog.done };
  try {
    const existing = JSON.parse(fs.readFileSync(OUT, "utf8"));
    for (const [k, v] of Object.entries(existing.entries ?? {})) if (!out[k]) out[k] = v as never;
  } catch { /* first run */ }
  const pending = list.filter((q) => !out[q.id]);
  console.log(`[pack] already done: ${list.length - pending.length}, pending: ${pending.length}`);

  const zai = await ZAI.create();
  let ok = 0, bad = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const stillNeeded = new Set(batch.map((b) => b.id));
    const gotItems: Raw[] = [];
    for (let attempt = 1; attempt <= 4 && stillNeeded.size > 0; attempt++) {
      try {
        const sub = batch.filter((b) => stillNeeded.has(b.id));
        const prompt = sub
          .map((q) => `@@ID=${q.id}\n@OPTIONS_COUNT=${q.options.length}\n@Q=${q.question}\n${q.options.map((o) => `@O=${o}`).join("\n")}\n@E=${q.explanation}`)
          .join("\n\n");
        const res = await zai.chat.completions.create({
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
        });
        const parsed = parseLineFormat(res.choices[0]?.message?.content ?? "");
        for (const src of sub) {
          const got = parsed.find((x) => x.id === src.id);
          if (!got) continue;
          if (!isTelugu(got.q)) continue;
          if (got.options.length !== src.options.length) continue;
          if (!got.options.every(isTelugu)) continue;
          gotItems.push(got);
          stillNeeded.delete(src.id);
        }
      } catch (e) {
        console.log(`[pack] attempt ${attempt} error: ${(e as Error).message}`);
        await sleep(6000 * attempt);
      }
    }
    for (const t of gotItems) {
      out[t.id] = { q: t.q, options: t.options, explanation: t.explanation ?? "" };
      ok++;
    }
    if (stillNeeded.size > 0) {
      bad += stillNeeded.size;
      prog.failed.push(...stillNeeded);
      console.log(`[pack] gave up: ${[...stillNeeded].join(",")}`);
    }
    fs.writeFileSync(PROG, JSON.stringify({ done: out, failed: prog.failed }, null, 0));
    process.stdout.write(`[pack] progress ${Object.keys(out).length}/${list.length} (ok=${ok} bad=${bad})\n`);
    if (i + BATCH < pending.length) await sleep(DELAY_MS);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({ lang: "te", generatedAt: new Date().toISOString(), count: Object.keys(out).length, entries: out }, null, 1)
  );
  console.log(`[pack] DONE translated=${ok} failed=${bad} total-in-file=${Object.keys(out).length}`);
  if (prog.failed.length) console.log(`[pack] FAILED IDS: ${prog.failed.join(",")}`);
}

main().catch((e) => { console.error("[pack] FATAL:", e); process.exit(1); });
