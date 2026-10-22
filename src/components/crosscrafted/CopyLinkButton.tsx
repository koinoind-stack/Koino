"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

/**
 * CopyLinkButton — a client component that copies the current URL to clipboard.
 *
 * This MUST be a client component because it uses an onClick event handler.
 * In Next.js App Router, event handlers cannot be defined in Server Components
 * when the rendered JSX is passed as children to a Client Component (like
 * PublicPageLayout). The onClick function is not serializable across the
 * Server→Client boundary.
 */
export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
    >
      <Share2 size={12} /> {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}
