import { NextRequest, NextResponse } from "next/server";
import { renderRangeMapHtml } from "@/lib/data/range-map-svg";

/**
 * GET /api/range/[slug]
 * Returns just the Little's-style range-map SVG as an HTML string.
 *
 * Split out from /api/species/[slug] so species pages can lazy-fetch
 * only the range map (keeping the ~325 KB basemap SVG out of the
 * prerendered page HTML — otherwise the 10k prerendered species pages
 * balloon Vercel output past the 12 GB disk limit).
 *
 * Cache aggressively: basemap + per-species range are static at deploy
 * time, only change when the range-maps pipeline regenerates them.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const rangeMapHtml = renderRangeMapHtml(slug);

  return NextResponse.json(
    { rangeMapHtml },
    {
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
      },
    }
  );
}
