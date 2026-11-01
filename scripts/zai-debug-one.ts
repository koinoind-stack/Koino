import ZAI from "z-ai-web-dev-sdk";

const SYSTEM = `Translate the English question below to Telugu. Reply ONLY with lines:
@@ID=<id>
@Q=<Telugu question>
@O=<Telugu option 1>
@O=<Telugu option 2>
@E=<Telugu explanation>`;

async function main() {
  const zai = await ZAI.create();
  try {
    const res = await zai.chat.completions.create({
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            "@@ID=test_001\n@OPTIONS_COUNT=2\n@Q=Who built the ark?\n@O=Noah\n@O=Moses\n@E=Noah built the ark per Genesis 6.",
        },
      ],
    });
    const content = res.choices[0]?.message?.content ?? "(empty)";
    console.log("MODEL:", res.model ?? "(none)");
    console.log("USAGE:", JSON.stringify(res.usage ?? {}));
    console.log("CONTENT>>>");
    console.log(content.slice(0, 800));
    console.log("<<<END");
  } catch (e) {
    console.log("ERROR:", (e as Error).message);
  }
}
main();
