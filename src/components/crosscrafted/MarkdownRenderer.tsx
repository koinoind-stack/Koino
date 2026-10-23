"use client";

import ReactMarkdown from "react-markdown";

// ─── URL sanitizer ─────────────────────────────────────────────────────────
// Blocks dangerous protocols (javascript:, data:, vbscript:, file:) in
// markdown links + images. Only allows http:, https:, mailto:, tel:, and
// relative URLs (starting with / or #).
function safeUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Client component wrapper for react-markdown.
 *
 * react-markdown v10 uses useState/useEffect internally, which are NOT
 * available in Next.js Server Components. This wrapper is marked
 * "use client" so the hooks work correctly. The markdown content is
 * passed as a prop from the Server Component.
 *
 * Includes the safeUrl() sanitizer for links + images — blocks
 * javascript:, data:, vbscript:, file: protocols.
 */
export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-2xl font-black text-white mt-8 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-extrabold text-white mt-7 mb-3 pb-1 border-b border-white/[0.06]">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold text-white mt-5 mb-2">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-bold text-white mt-4 mb-2">{children}</h4>,
        p: ({ children }) => <p className="text-[15px] text-[#A09DB1] leading-[1.75] mb-4">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-[#C4BFD1]">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-outside pl-6 mb-4 space-y-1.5 text-[15px] text-[#A09DB1] leading-[1.75]">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside pl-6 mb-4 space-y-1.5 text-[15px] text-[#A09DB1] leading-[1.75]">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#7C3AED] bg-[#7C3AED]/5 pl-4 pr-3 py-2 my-4 rounded-r-lg">
            <div className="text-[15px] text-[#C4BFD1] italic leading-[1.75]">{children}</div>
          </blockquote>
        ),
        a: ({ href, children }) => {
          const safeHref = safeUrl(href);
          if (!safeHref) {
            return <span className="text-[#94A3B8]">{children}</span>;
          }
          return (
            <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-[#38BDF8] underline decoration-[#38BDF8]/40 underline-offset-2 hover:decoration-[#38BDF8] transition-all">
              {children}
            </a>
          );
        },
        img: ({ src, alt }) => {
          const safeSrc = safeUrl(src as string);
          if (!safeSrc) return null;
          return (
            <img src={safeSrc} alt={alt || ""} className="w-full rounded-xl my-4 max-h-96 object-cover" />
          );
        },
        hr: () => <hr className="border-white/[0.08] my-6" />,
        code: ({ children }) => <code className="bg-white/[0.06] text-[#A78BFA] px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>,
        pre: ({ children }) => <pre className="bg-[#0f0f1a] border border-white/[0.06] rounded-xl p-4 overflow-x-auto mb-4 text-[13px]">{children}</pre>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
