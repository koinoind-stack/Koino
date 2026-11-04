// Server-only PDF text extraction helper.
//
// WHY THIS FILE EXISTS
// pdf-parse v2.4.5 uses pdfjs-dist internally. pdfjs-dist reads
// `globalThis.DOMMatrix` during module evaluation / canvas operations.
// On Vercel's Node.js runtime, `DOMMatrix` is NOT defined by default,
// which produces the production crash:
//
//   ReferenceError: DOMMatrix is not defined
//
// The official pdf-parse v2 fix (documented in their troubleshooting
// guide) is to import the worker module BEFORE evaluating PDFParse,
// because the worker module installs the polyfills:
//
//   globalThis.DOMMatrix = @napi-rs/canvas.DOMMatrix
//   globalThis.Path2D    = @napi-rs/canvas.Path2D
//   globalThis.ImageData = @napi-rs/canvas.ImageData
//
// and to pass the worker's `CanvasFactory` into the `PDFParse` constructor.
//
// IMPORT ORDER IS CRITICAL
// A top-level static `import { PDFParse } from "pdf-parse"` would let the
// bundler hoist / reorder evaluation, so PDFParse (and therefore pdfjs-dist)
// could be evaluated BEFORE the worker polyfills are installed.
//
// We avoid that by using `await import()` inside the function so the
// evaluation order is guaranteed at runtime:
//   1. `await import("pdf-parse/worker")`  → installs global polyfills
//   2. `await import("pdf-parse")`         → evaluates PDFParse safely
//   3. `new PDFParse({ data, CanvasFactory })`
//
// This module is intentionally side-effect free at import time — it only
// declares a function. The dynamic imports run when the function is called.

export interface ExtractedPdf {
  text: string;
  pages: string[];
}

export async function extractPdfText(
  buffer: Buffer,
  onStage?: (stage: string, extra?: Record<string, unknown>) => void,
): Promise<ExtractedPdf> {
  onStage?.("importing pdf-parse/worker");

  // 1. Worker polyfills MUST be installed first.
  //    This side-effect import installs globalThis.DOMMatrix / Path2D / ImageData.
  const worker = await import("pdf-parse/worker");

  onStage?.("pdf-parse/worker imported", {
    hasCanvasFactory: typeof worker.CanvasFactory === "function",
  });

  // 2. NOW it is safe to evaluate PDFParse — pdfjs-dist can read DOMMatrix.
  onStage?.("importing pdf-parse");
  const pdfParseModule = await import("pdf-parse");
  const PDFParse = pdfParseModule.PDFParse;
  onStage?.("pdf-parse imported", {
    hasPDFParse: typeof PDFParse === "function",
  });

  // 3. Construct the parser. Pass the worker's CanvasFactory explicitly
  //    so pdfjs-dist uses the @napi-rs/canvas-backed factory rather than
  //    the default DOMCanvasFactory (which would also touch DOMMatrix).
  onStage?.("creating PDFParse instance");
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    CanvasFactory: worker.CanvasFactory,
  });
  onStage?.("PDFParse instance created");

  try {
    onStage?.("calling getText");
    const result = await parser.getText();
    onStage?.("getText succeeded");

    // TextResult shape (per pdf-parse v2 types):
    //   pages: Array<{ pageNumber, text, links?, ... }>
    //   text:   string   // full concatenated text
    const pageTexts: string[] = Array.isArray(result.pages) && result.pages.length > 0
      ? result.pages.map((p: unknown) => {
          if (typeof p === "string") return p;
          if (p && typeof p === "object" && "text" in p) {
            const t = (p as { text?: unknown }).text;
            return typeof t === "string" ? t : "";
          }
          return "";
        })
      : [];

    const joined = pageTexts.length > 0
      ? pageTexts.join("\n\n")
      : (typeof result.text === "string" ? result.text : "");

    onStage?.("extracted text length", {
      length: joined.length,
      pages: pageTexts.length,
    });

    return { text: joined, pages: pageTexts };
  } finally {
    try {
      await parser.destroy();
      onStage?.("parser destroyed");
    } catch {
      // Destroy failures are non-fatal — log nothing.
    }
  }
}
