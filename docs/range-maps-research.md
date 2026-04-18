# Range Maps — Source Research & Recommendation

## The question
Can we add authoritative range maps to species pages (like the classic
Little's white pine map)? What sources are available, what are their
licenses, and what's the best tiered strategy?

---

## Source-by-source verdict

### A) USGS / USDA Little's Range Maps (trees) — **USE**
- ~679 North American tree species, shapefile per species
- **Public domain** (US federal work); cite Little
- Canonical rehost: [`github.com/wpetry/USTreeAtlas`](https://github.com/wpetry/USTreeAtlas)
- Also at USGS: "Digital Representations of Tree Species Range Maps"
- Format: ESRI shapefile → convert with `ogr2ogr` or `mapshaper`

### B) Wikipedia / Wikimedia Commons — **USE as fallback**
- Broad, patchy coverage across all taxa
- MediaWiki API: `query&prop=images&titles={SciName}` → `imageinfo` for
  URL + license
- Filename heuristic: match `range`, `distribution`, `distrib`, `map`,
  `native`, `habitat`, `-en.svg`; SVG hits are usually range maps
- Most files are CC-BY-SA 4.0 or PD — check `extmetadata` per file;
  attribution required for CC-BY-SA

### C) iNaturalist — **USE** (observation density)
- Their `range_kml` / atlas field is sparsely populated — don't rely on it
- **Pre-rendered heatmap tiles**:
  `https://api.inaturalist.org/v1/points/{z}/{x}/{y}.png?taxon_id=X`
- Observations endpoint also works for custom rendering:
  `GET /v1/observations?taxon_id=X&per_page=200&geo=true`
- Rate limit: 100 req/min hard, 60 recommended
- License: observations CC0/CC-BY/CC-BY-NC per record; API free

### D) GBIF — **USE** (occurrence density)
- **Pre-rendered density tiles**:
  `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=X&style=classic.poly`
- License: CC-BY per dataset; attribute "GBIF.org"

### E) eBird / Cornell (birds) — **AVOID for redistribution**
- Status & Trends maps are CC-BY-NC-SA via `ebirdst` R package
- **Re-hosting rendered images requires permission**; scraping tiles
  prohibited by ToS
- Link out only; use other sources for displayed bird ranges

### F) USDA PLANTS Database — **USE** (county-level plants)
- JSON API: `plants.usda.gov/api/plants/search`; per-symbol
  distribution returns state/county FIPS codes
- **Public domain**
- Render yourself against TIGER/Line county shapefile

### G) BONAP — **AVOID**
- Terms explicitly prohibit redistribution/scraping. Link out only.

### H) IUCN Red List — **USE** (mammals, amphibians, reptiles, fish)
- [Spatial data download](https://www.iucnredlist.org/resources/spatial-data-download)
  — free with registration
- Free for non-commercial/educational use with attribution; this
  project qualifies
- Raw shapefile redistribution not permitted, but **derived rendered
  maps are fine** with citation

### I) Other
- **Map of Life** (`mol.org`) — API aggregator, useful for
  cross-checking; attribution required
- **NatureServe Explorer** — state-level; restrictive terms, link only
- **BirdLife International** — free bird shapefiles for non-commercial
  research with registration at `datazone.birdlife.org`; rendered
  derivatives OK, raw files not

---

## Recommended tiered strategy

| Taxon | Primary | Fallback 1 | Fallback 2 |
|---|---|---|---|
| **Trees (native)** | Little's shapefile → GeoJSON | USDA PLANTS county map | GBIF density tile |
| **Other plants** | USDA PLANTS county map | GBIF density tile | Wikipedia image |
| **Birds** | BirdLife shapefile → render | Wikipedia range SVG | GBIF density tile |
| **Mammals / Reptiles / Amphibians** | IUCN shapefile → render | Wikipedia | GBIF density tile |
| **Fish** | IUCN (freshwater) | GBIF density tile | Wikipedia |
| **Insects / Arachnids / Mollusks** | GBIF density tile | iNat tile | Wikipedia |
| **Fungi / Lichens** | iNat tile | GBIF density tile | — |
| **Universal fallback** | iNat observation points clipped to NE | | |

---

## Implementation sketch

Pipeline stage `scripts/06-range-maps.ts`:

1. For each species, try sources in order above
2. For shapefile sources, render to PNG server-side using `d3-geo` +
   `canvas` in a consistent Little's-style look (NA basemap, green
   range polygon, NE states highlighted)
3. For tile sources, composite a 3×3 tile grid at an appropriate zoom
   centered on eastern North America
4. Cache to `public/range-maps/{slug}.png` (+ `.webp` via `sharp`)
5. Record `source`, `license`, `attribution`, `url` in species JSON
6. Display on species page with attribution line below the map

Resume-safe like existing pipeline stages — skip species with cached
maps. Re-run when new taxa are added.

**Minimum viable first pass:**
- **Little's for trees** (public domain, authoritative, matches the
  example)
- **iNat tile API for everything else** (universal coverage, consistent
  style, zero auth, zero licensing friction)

That combination alone would give ~95% of species a usable map in one
weekend of work.
