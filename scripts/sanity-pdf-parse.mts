// Local sanity check: verifies that pdf-parse/worker installs the
// globalThis.DOMMatrix polyfill in a plain Node environment.
//
// This is NOT a substitute for production verification on Vercel.
// It only confirms the import path is valid and the polyfill attaches.

async function main() {
  console.log("[sanity] before worker import: DOMMatrix =", typeof (globalThis as any).DOMMatrix);
  const worker = await import("pdf-parse/worker");
  console.log("[sanity] after worker import:  DOMMatrix =", typeof (globalThis as any).DOMMatrix);
  console.log("[sanity] after worker import:  Path2D    =", typeof (globalThis as any).Path2D);
  console.log("[sanity] after worker import:  ImageData =", typeof (globalThis as any).ImageData);
  console.log("[sanity] worker.CanvasFactory type =", typeof worker.CanvasFactory);

  const { PDFParse } = await import("pdf-parse");
  console.log("[sanity] PDFParse type =", typeof PDFParse);

  const fs = await import("node:fs");
  const path = await import("node:path");
  const argPath = process.argv[2];
  const testPath = argPath ? path.resolve(argPath) : "";
  if (!testPath || !fs.existsSync(testPath) || fs.statSync(testPath).isDirectory()) {
    console.log("[sanity] no test PDF provided, skipping parse step");
    return;
  }
  const buf = fs.readFileSync(testPath);
  console.log("[sanity] pdf buffer bytes =", buf.length);

  const parser = new PDFParse({
    data: new Uint8Array(buf),
    CanvasFactory: worker.CanvasFactory,
  });
  try {
    const result = await parser.getText();
    console.log("[sanity] getText succeeded, text length =", result.text.length);
    console.log("[sanity] pages =", Array.isArray(result.pages) ? result.pages.length : 0);
    console.log("[sanity] first 200 chars =", JSON.stringify(result.text.slice(0, 200)));
  } finally {
    try { await parser.destroy(); } catch {}
  }
}

main().catch((e) => {
  console.error("[sanity] FAILED:", e);
  process.exit(1);
});
