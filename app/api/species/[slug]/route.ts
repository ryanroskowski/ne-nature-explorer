import { NextRequest, NextResponse } from "next/server";
import { getSpecies } from "@/lib/data/species";
import { getArticlesForSpecies } from "@/lib/data/articles";

/**
 * GET /api/species/[slug]
 * Returns species data + related articles as JSON for the split-pane explorer.
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

  return NextResponse.json(
    { species, articles },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
