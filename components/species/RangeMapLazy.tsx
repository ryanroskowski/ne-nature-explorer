"use client";

import { useEffect, useState } from "react";

/**
 * Client-side lazy-loaded range map for the species page.
 *
 * The server-rendered RangeMap baked ~325 KB of basemap SVG into every
 * prerendered species page, pushing Vercel's output over its disk limit.
 * This component fetches the SVG from `/api/range/[slug]` after hydration
 * so the basemap lives in one long-cached response, not 10k HTML files.
 *
 * Renders nothing (no heading, no skeleton) if the species has no range
 * data — matching the old conditional render on the page.
 */
export default function RangeMapLazy({ slug }: { slug: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/range/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json: { rangeMapHtml: string | null } = await res.json();
        if (cancelled) return;
        if (!json.rangeMapHtml) {
          setState("empty");
          return;
        }
        setHtml(json.rangeMapHtml);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // No heading or skeleton if the species has no range data.
  if (state === "empty" || state === "error") return null;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2 text-forest">
        <span>🧭</span>
        Range
      </h2>
      {state === "loading" ? (
        // Reserve the same aspect ratio as the SVG (800×500 = 1.6:1)
        // so the page doesn't jump when the map arrives.
        <div
          className="bg-card border border-border rounded-xl overflow-hidden animate-pulse"
          style={{ aspectRatio: "800 / 500" }}
          aria-hidden="true"
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: html ?? "" }} />
      )}
    </section>
  );
}
