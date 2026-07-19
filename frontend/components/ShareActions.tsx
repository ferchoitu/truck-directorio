"use client";

import { useState } from "react";

export default function ShareActions({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-2xl bg-white shadow-sm px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-lime-400 hover:text-zinc-900"
    >
      {copied ? "✓ Link copied" : "📤 Share"}
    </button>
  );
}
