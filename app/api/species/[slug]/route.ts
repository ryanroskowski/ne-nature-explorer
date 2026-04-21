import { NextRequest, NextResponse } from "next/server";
import { getSpecies } from "@/lib/data/species";
import { getArticlesForSpecies } from "@/lib/data/articles";
import { renderRangeMapHtml } from "@/lib/data/range-map-svg";

/**
 * GET /api/species/[slug]
 * Returns species data + related articles as JSON for the split-pane explorer.
 *
 * Also builds the Little's-style range-map SVG as an HTML string and
 * includes it in the payload when a range exists for the species. The panel
 * is a client component and can't pull the server-only RangeMap component
 * directly, so we build the SVG markup here and inject via
 * dangerouslySetInnerHTML on the client.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const species = getSpecies(slug);

  if (!species) {
    return NextResponse.json({ error: "Species not found" }, { status: 404 });
  }

  const articles = getArticlesForSpecies(slug);
  const rangeMapHtml = renderRangeMapHtml(slug);

  return NextResponse.json(
    { species, articles, rangeMapHtml },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
