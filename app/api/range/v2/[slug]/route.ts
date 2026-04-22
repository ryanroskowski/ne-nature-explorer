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
 * Cache header: short browser max-age (1 hour), longer CDN s-maxage,
 * and stale-while-revalidate so the CDN serves fast while it refreshes.
 *
 * Earlier iteration used `immutable` with a week-long max-age — but
 * range data changes when we fix pipeline bugs (see the NA point clip
 * fix) and `immutable` locks stale data in users' browsers until the
 * TTL expires. The shorter browser TTL means users see fixes quickly.
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
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
