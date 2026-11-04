// Quick test of OpenAI key
import OpenAI from "openai";

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const c = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Say hello in Hindi (one word)" }],
    max_tokens: 20,
  });
  console.log("✅ OpenAI works!");
  console.log("Response:", c.choices[0].message.content);
}

main().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
