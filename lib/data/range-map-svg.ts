/**
 * Server-side string builder for the Little's-style range map.
 *
 * Used from two places:
 *   1. components/species/RangeMap.tsx (server component on the species page)
 *   2. app/api/species/[slug]/route.tsx (species API for the split-pane panel)
 *
 * The panel is a client component and can't render a server component
 * directly, and Next.js rejects importing `react-dom/server` from route
 * handlers. So we render the SVG to a raw string here and inject it via
 * dangerouslySetInnerHTML on the client.
 */

import { geoAlbers, geoPath, type GeoProjection } from "d3-geo";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { getBasemap, getRangeForSpecies, type SpeciesRange } from "./ranges";

const WIDTH = 800;
const HEIGHT = 500;

// Framing polygon (counter-clockwise) covering mainland North America.
// Passed to fitExtent so every species map frames the same area — a
// species dot in Vermont sits in the same spot across all 10,000 maps.
const NA_FRAME = {
  type: "Polygon" as const,
  coordinates: [
    [
      [-128, 14],
      [-128, 60],
      [-55, 60],
      [-55, 14],
      [-128, 14],
    ],
  ],
};

function buildProjection(): GeoProjection {
  return geoAlbers()
    .rotate([96, 0])
    .center([0, 38])
    .parallels([29.5, 45.5])
    .fitExtent(
      [
        [10, 10],
        [WIDTH - 10, HEIGHT - 10],
      ],
      NA_FRAME
    );
}

function sourceLabel(source: SpeciesRange["source"]): string {
  switch (source) {
    case "littles":
      return "Native range — Little (1971) via USGS";
    case "inat-hull":
      return "Observation range — iNaturalist";
  }
}

/** Minimal HTML-entity escape for text that ends up inside an SVG attribute or caption. */
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the full range-map markup (a <figure> wrapping an <svg> + caption)
 * as a single HTML string. Returns null when no range data exists for the
 * species or when the basemap is unavailable.
 */
export function renderRangeMapHtml(slug: string): string | null {
  const range = getRangeForSpecies(slug);
  const basemap = getBasemap();
  if (!range || !basemap) return null;

  const projection = buildProjection();
  const path = geoPath(projection);

  const pathOf = (f: Feature<Geometry, GeoJsonProperties>): string =>
    path(f) ?? "";

  const countriesFill = basemap.countries.features
    .map((f) => `<path d="${pathOf(f)}" fill="#efece3" stroke="none"/>`)
    .join("");

  const neHighlight = basemap.neStates.features
    .map((f) => `<path d="${pathOf(f)}" fill="#e3dfd0" stroke="none"/>`)
    .join("");

  const stateBorders = basemap.states.features
    .map(
      (f) =>
        `<path d="${pathOf(f)}" fill="none" stroke="#9a9382" stroke-width="0.5" stroke-linejoin="round"/>`
    )
    .join("");

  const countryOutlines = basemap.countries.features
    .map(
      (f) =>
        `<path d="${pathOf(f)}" fill="none" stroke="#6b6554" stroke-width="0.9" stroke-linejoin="round"/>`
    )
    .join("");

  const rangeFill = `<path d="${pathOf(range.polygon)}" fill="var(--color-forest, #2d6a4f)" fill-opacity="0.55" stroke="var(--color-forest, #2d6a4f)" stroke-width="1" stroke-linejoin="round"/>`;

  const ariaLabel = `Range map for ${escapeText(range.scientificName)}`;
  const label = escapeText(sourceLabel(range.source));
  const obsSpan =
    range.observationCount !== undefined
      ? `<span class="text-text-muted">${range.observationCount.toLocaleString()} observations</span>`
      : "";

  return (
    `<figure class="bg-card border border-border rounded-xl overflow-hidden">` +
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="w-full h-auto block bg-cream" role="img" aria-label="${ariaLabel}">` +
    `<g>${countriesFill}</g>` +
    `<g>${neHighlight}</g>` +
    `<g>${stateBorders}</g>` +
    `<g>${countryOutlines}</g>` +
    rangeFill +
    `</svg>` +
    `<figcaption class="px-4 py-2 text-xs font-ui text-text-secondary bg-cream-dark/30 border-t border-border flex items-center justify-between gap-3">` +
    `<span>${label}</span>${obsSpan}` +
    `</figcaption>` +
    `</figure>`
  );
}
