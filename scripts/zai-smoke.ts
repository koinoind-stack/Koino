import ZAI from "z-ai-web-dev-sdk";

async function main() {
  const zai = await ZAI.create();
  const res = await zai.chat.completions.create({
    messages: [
      { role: "system", content: "You are an English→Telugu Bible translator. Reply with ONLY valid JSON." },
      { role: "user", content: 'Translate this trivia question to Telugu (natural, simple, Christian register). Reply JSON: {"q":"...","options":["","","",""]}\n\nQuestion: Who built the ark?\nOptions: ["Noah","Moses","Abraham","David"]' },
    ],
  });
  console.log("RAW:", res.choices[0]?.message?.content?.slice(0, 300));
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
