# New England Nature Explorer — Refined Implementation Plan

## Context

Build an interactive educational website for learning the flora (and eventually fauna, fungi, etc.) of New England. The user is self-teaching botany starting with conifers and wants an intuitive, explorable platform that makes it easy to contextualize where a species sits in the tree of life, compare related species, and discover what's common vs. rare. The original plan from a prior Claude session was solid architecturally but had several factual errors and gaps that this refined plan corrects.

**Key corrections from the original plan:**
- 5 of 6 iNaturalist place_ids for New England states were wrong
- GBIF dependency is unnecessary — iNaturalist's taxa API already provides full taxonomy
- USDA PLANTS Database has no reliable public API — drop it; use iNaturalist's `establishment_means` instead
- Field name is `preferred_common_name`, not `common_name`
- Need robust rate-limiting strategy (iNaturalist recommends ~60 req/min, hard limit ~100)
- Photo categorization (bark vs. leaf vs. whole plant) needs a concrete strategy

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | SSG for species pages, fast loads, great DX |
| Styling | Tailwind CSS v4 | Custom warm/earthy theme, rapid iteration |
| Animation | Framer Motion | Smooth tree expansion, page transitions |
| Search | Fuse.js | Client-side fuzzy search over species index |
| Content Gen | Claude API (Sonnet) | ~$0.02/species, rich educational content |
| Data Source | iNaturalist API | Species lists, taxonomy, photos, abundance |
| Deployment | Vercel (free tier) | Perfect for SSG/ISR Next.js sites |
| Language | TypeScript | Type safety across data pipeline and UI |

---

## Data Pipeline (build-time scripts)

All scripts live in `scripts/` and run via `npm run pipeline`. They produce static JSON in `data/` that Next.js reads at build time.

### Stage 1: Fetch Species List
**Script:** `scripts/01-fetch-species.ts`
**Source:** iNaturalist `/v1/observations/species_counts`
**Corrected place_ids:** CT=49, MA=2, ME=17, NH=41, RI=8, VT=47
**Params:** `iconic_taxa=Plantae`, `quality_grade=research`, `per_page=500`
**Output:** Species list with taxon_id, scientific_name, preferred_common_name, observation_count, ancestry, default_photo
**Rate limiting:** 1 request/sec with exponential backoff on 429s. Cache all responses locally.
**Pagination:** Loop with `page` param. Max 10,000 results via pagination (sufficient for NE plants).
**For v1 (conifers only):** Add `taxon_id=47375` (Pinales) to scope to just conifers (~17 species).

### Stage 2: Build Taxonomy Tree
**Script:** `scripts/02-build-taxonomy.ts`
**Source:** iNaturalist `/v1/taxa/{id}` with `?all=true` to get ancestor chain
**Process:** For each species from Stage 1, fetch full taxon details including ancestors. Build a nested tree structure from kingdom down to species. iNaturalist provides `ancestor_ids` and `ancestors` directly — no need for GBIF.
**Output:** `data/taxonomy.json` — nested tree with nodes at each rank (kingdom, phylum, class, order, family, genus, species). Each node has: id, name, preferred_common_name, rank, species_count, description placeholder.

### Stage 3: Fetch Photos
**Script:** `scripts/03-fetch-photos.ts`
**Source:** iNaturalist `/v1/observations` per species
**Params:** `taxon_id={id}`, `place_id=2,8,17,41,47,49`, `quality_grade=research`, `photos=true`, `photo_license=cc-by,cc-by-nc,cc0,cc-by-sa`, `per_page=12`, `order_by=votes`
**Output:** Per species, 6-10 photos with: url (medium + large), attribution (observer username), license, observation_id.
**Photo categorization:** Use observation `description` and `tags` fields where available. For v1, skip auto-categorization — display as a gallery. Can add Claude Vision classification in a later phase if needed.
**Photo URLs:** CC-licensed photos use `inaturalist-open-data.s3.amazonaws.com/photos/{id}/{size}.{ext}`. Store both medium and large URLs.

### Stage 4: Generate Content via Claude API
**Script:** `scripts/04-generate-content.ts`
**Source:** Anthropic API (claude-sonnet-4-20250514 or newer)
**Process:** For each species, send structured prompt with all data from Stages 1-3. Request JSON output with fields:
- `nameStory` — why it has this common name (2-3 sentences)
- `description` — what it is in plain language (3-4 sentences)
- `idTips` — array of 4-6 identification tips with labels, the most diagnostic one marked
- `habitat` — where in New England to find it
- `seasonality` — what to look for each season
- `funFact` — one genuinely surprising fact
- `confusionNotes` — what it's confused with (nullable)
- `contextualKnowledge` — naming issues, cultural notes (nullable)
- `compareHints` — how it differs from its closest relatives in the same genus

Also generate content for each genus and family node in the taxonomy tree.

**Cost:** ~$0.02/species. 17 conifers = ~$0.34. Full plants (~1500 species) = ~$30.
**Caching:** Store raw API responses. Only regenerate if source data changes (hash comparison).
**Batch API:** Use Anthropic's Batch API for bulk generation (50% cost reduction).

### Stage 5: Assemble Final Data
**Script:** `scripts/05-assemble.ts`
**Process:** Combine all outputs into final JSON structure.
**Output files:**
```
data/
  taxonomy.json              — Full nested tree for the explorer
  species/
    pinus-strobus.json       — Complete species page data
    tsuga-canadensis.json
    ...
  commonality.json           — Species ranked by observation count with tier labels
  search-index.json          — Flat array for Fuse.js: { slug, commonName, scientificName, family, genus }
  contextual-knowledge.json  — Cross-cutting explainer topics
```

### Pipeline runner
**Script:** `scripts/run-pipeline.ts`
**Runs stages 1-5 in sequence.** Each stage checks for cached data and skips if unchanged. A `--force` flag re-runs everything. A `--taxon` flag scopes to a specific taxon (e.g., `--taxon=47375` for conifers only).

---

## App Structure & Pages

### Layout
- **Header:** Site name + logo, navigation tabs (Explore, Compare, Common, Search), current kingdom selector (Plants, Fungi[coming soon], etc.)
- **Breadcrumbs:** Always visible below header. Shows path in taxonomy: Plants > Gymnosperms > Conifers > Pine Family > Pines > Eastern White Pine
- **Footer:** Minimal — attribution, data sources, CC license info

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page — hero, kingdom cards, stats, "Start Learning" CTA |
| `/explore` | Tree of Life Explorer — hierarchical, expandable taxonomy view |
| `/explore/[...path]` | Deep-linked tree state (e.g., `/explore/gymnosperms/pinaceae`) |
| `/compare/[group]` | Compare mode — side-by-side species cards for a genus or family |
| `/common` | Commonality browser — species sorted by abundance, tiered |
| `/species/[slug]` | Individual species page (SSG) |
| `/learn/[slug]` | Contextual knowledge articles (cedar confusion, etc.) |

### Tree of Life Explorer (`/explore`)
- **Not a D3 visualization** — a styled, animated hierarchical list/accordion
- Each taxonomy level is a row that expands on click with Framer Motion
- Shows: node name, common name, species count badge, small representative photo
- Expanded node shows: description of the group, child nodes as cards
- At genus level: shows species as comparison cards inline
- Color-coded by family (consistent colors used everywhere)
- Breadcrumb updates as you navigate deeper
- URL updates so states are shareable/bookmarkable

### Compare Mode (`/compare/[group]`)
- Select a genus or family to compare all its species
- Species shown as cards in a grid with key distinguishing features as rows
- Table view toggle: columns = species, rows = features (needle count, bark type, habitat, etc.)
- "How to tell them apart" summary auto-generated from `compareHints`

### Commonality Browser (`/common`)
- Species sorted by iNaturalist observation count
- Tiered: Very Common (top 20%), Common, Moderate, Uncommon, Rare
- Card size reflects tier (larger = more common)
- Filter by group (all plants, just trees, just conifers, etc.)
- "Start Here" recommendation for the top 20 most common

### Species Page (`/species/[slug]`)
1. **Header:** Common name (large serif), scientific name (italic), family > genus breadcrumb, abundance dots (●●●○○)
2. **Photo gallery:** Horizontal scroll of 4-8 CC-licensed photos with lightbox on click. Attribution below each photo.
3. **"Why This Name?"** — Etymology and name story
4. **"How to Identify"** — Labeled tips. Most diagnostic feature marked with a star. Sensory details (touch, smell, sound).
5. **"Where to Find"** — NE-specific habitat. Associated species.
6. **"Through the Seasons"** — Seasonal changes and what to look for
7. **"Did You Know?"** — One wow-factor fact
8. **"Don't Confuse With"** — Look-alikes with distinguishing tips (if applicable)
9. **"Good to Know"** — Contextual knowledge like naming confusions (if applicable)
10. **"Related Species"** — Links to other species in the same genus with thumbnail + one-line distinction

### Landing Page (`/`)
- Hero: "Discover the Living World of New England"
- Kingdom cards: Plants (active), Fungi (coming soon), Birds (coming soon), etc.
- Stats: "X species of plants across Y families"
- Featured species carousel or "species of the day"
- "Start Learning" button -> Commonality Browser

---

## Design System

### Colors
```
--bg-primary:      #faf7f0   (warm cream)
--bg-card:         #fffdf8   (off-white)
--bg-card-alt:     #f5f0e6   (warm gray)
--border:          #e4dcc8   (soft tan)
--text-primary:    #2e2e26   (warm near-black)
--text-secondary:  #7a7568   (warm gray)
--accent-green:    #2d6a4f   (forest — primary actions, conifers)
--accent-gold:     #8b6914   (warmth — fun facts, abundance)
--accent-teal:     #1a7a6a   (water — habitat, Cupressaceae)
--accent-rose:     #9a4060   (caution — Taxaceae, warnings)
```

### Typography
- **Headings:** Lora (Google Font, serif) — warm, scholarly, readable
- **Body:** System font stack with Georgia preference — no extra font load for body
- **UI elements:** System sans-serif stack
- **Line height:** 1.7-1.85 for body text

### Component Patterns
- Cards with 1px warm borders, subtle shadow, 12-16px rounded corners
- Gentle hover: translateY(-2px) + shadow increase
- Abundance indicator: ●●●○○ dots in gold
- Family color badges throughout (consistent from explorer -> cards -> species page)
- Skeleton loading states for images

---

## File Structure

```
nature_app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing
│   ├── explore/
│   │   ├── page.tsx                # Tree of Life Explorer root
│   │   └── [...path]/
│   │       └── page.tsx            # Deep-linked tree state
│   ├── compare/
│   │   └── [group]/
│   │       └── page.tsx            # Compare mode
│   ├── common/
│   │   └── page.tsx                # Commonality browser
│   ├── species/
│   │   └── [slug]/
│   │       └── page.tsx            # Species page (SSG)
│   ├── learn/
│   │   └── [slug]/
│   │       └── page.tsx            # Contextual knowledge articles
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Breadcrumbs.tsx
│   │   └── Footer.tsx
│   ├── explorer/
│   │   ├── TaxonomyTree.tsx        # The main tree explorer component
│   │   ├── TaxonomyNode.tsx        # Single expandable node
│   │   └── NodeCard.tsx            # Card within a node
│   ├── species/
│   │   ├── SpeciesHeader.tsx
│   │   ├── PhotoGallery.tsx
│   │   ├── IdTips.tsx
│   │   ├── SeasonalNotes.tsx
│   │   └── RelatedSpecies.tsx
│   ├── compare/
│   │   ├── CompareGrid.tsx
│   │   └── CompareTable.tsx
│   ├── common/
│   │   ├── CommonalityGrid.tsx
│   │   └── TierSection.tsx
│   └── ui/
│       ├── AbundanceDots.tsx
│       ├── FamilyBadge.tsx
│       ├── SearchBar.tsx
│       └── SpeciesCard.tsx
├── lib/
│   ├── types.ts                    # All TypeScript interfaces
│   ├── data.ts                     # Data loading helpers (read JSON files)
│   ├── taxonomy.ts                 # Taxonomy tree traversal utilities
│   └── search.ts                   # Fuse.js search configuration
├── data/                           # Generated by pipeline (gitignored)
│   ├── taxonomy.json
│   ├── commonality.json
│   ├── search-index.json
│   ├── contextual-knowledge.json
│   └── species/
│       └── *.json
├── scripts/
│   ├── 01-fetch-species.ts
│   ├── 02-build-taxonomy.ts
│   ├── 03-fetch-photos.ts
│   ├── 04-generate-content.ts
│   ├── 05-assemble.ts
│   ├── run-pipeline.ts
│   └── lib/
│       ├── inaturalist.ts          # iNaturalist API client with rate limiting
│       ├── claude.ts               # Claude API wrapper for content gen
│       ├── cache.ts                # File-based caching for API responses
│       └── types.ts                # Pipeline-specific types
├── public/
│   └── fonts/                      # Lora font files (self-hosted)
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                      # ANTHROPIC_API_KEY
```

---

## Implementation Order

### Phase 1: Project Setup + Data Pipeline for Conifers
1. Initialize Next.js project with TypeScript + Tailwind
2. Install deps: `framer-motion`, `fuse.js`, `@anthropic-ai/sdk`, `tsx` (for running TS scripts)
3. Define TypeScript types for all data structures (`lib/types.ts`, `scripts/lib/types.ts`)
4. Build iNaturalist API client with rate limiting and caching (`scripts/lib/inaturalist.ts`)
5. Implement Stage 1: Fetch conifer species (~17 species, taxon_id=47375)
6. Implement Stage 2: Build taxonomy tree from iNaturalist taxa API
7. Implement Stage 3: Fetch CC-licensed photos for each species
8. Implement Stage 4: Generate content via Claude API (requires user's API key in `.env.local`)
9. Implement Stage 5: Assemble final JSON data files
10. Run full pipeline for conifers, verify output data

### Phase 2: Core UI Components + Species Pages
1. Set up design system: Tailwind theme config, global styles, Lora font
2. Build layout: Header, Breadcrumbs, Footer
3. Build SpeciesCard component (used everywhere)
4. Build Species Page with all sections
5. Build Photo Gallery with lightbox
6. Generate static species pages from data via `generateStaticParams`
7. Build Landing Page

### Phase 3: Explorer + Compare + Common Views
1. Build TaxonomyTree + TaxonomyNode components with Framer Motion animations
2. Build Explore page with deep-linking via catch-all route
3. Build Compare Mode with grid and table views
4. Build Commonality Browser with tiered layout
5. Implement search with Fuse.js
6. Wire up navigation and breadcrumbs across all views

### Phase 3.5: Pipeline Improvements (AI Photos + Taxon-Aware Prompts)
_Before polish, improve the data quality itself._
1. **AI photo scoring (Stage 3b):** After fetching photos, use Claude Vision to score each image for representativeness (clear view of the whole plant, good lighting, shows diagnostic features). Filter out bad picks (underwater shots, extreme close-ups of the wrong thing, blurry images). Rank and select the best 6-8 per species.
2. **Taxon-aware content prompts:** Make `generateSpeciesContent` adapt its prompt based on the major group:
   - **Conifers/Gymnosperms:** Emphasize cones, needles, bark, silhouette
   - **Angiosperms (flowering plants):** Emphasize flowers, fruit, leaf shape, seeds
   - **Fungi:** Emphasize cap, gills/pores, spore print, edibility warnings, habitat substrate
   - **Birds:** Emphasize plumage, song/call, behavior, flight pattern, nesting
   - **Insects:** Emphasize wing patterns, life stages, host plants, behavior
   - **Lichens:** Emphasize growth form (crustose/foliose/fruticose), substrate, color
3. **Data backup + regeneration system:** `scripts/backup-data.ts` — snapshot current `data/` and `.cache/` to timestamped archive. `scripts/regenerate.ts --prompt-version=2` — clear content cache only and re-generate with updated prompts/model without re-fetching from iNaturalist.

### Phase 4: Polish + Deploy
1. Mobile responsive pass on all pages
2. Accessibility audit (keyboard nav, ARIA labels, color contrast, screen reader)
3. Image optimization (Next.js Image component, lazy loading, blur placeholders)
4. SEO: meta tags, Open Graph, structured data
5. Deploy to Vercel
6. Write contextual knowledge articles (cedar confusion, etc.)

### Phase 5: Expand to All Trees + Shrubs
1. Re-run pipeline without taxon filter (or broader filter for woody plants)
2. Review and spot-check generated content
3. Performance test with larger dataset
4. Add ISR (Incremental Static Regeneration) if build times get long

### Phase 6: Interactive Browse Features
1. **Browse by seed type:** Interactive page where users browse species by seed/reproductive structure (cone, winged seed, fruit, nut, berry, acorn, etc.) with representative photos of each type. Clicking a type shows all matching species.
2. **Browse by flower type:** Same concept but for flowers — group angiosperms by flower shape, color, petal count, bloom season. Interactive visual catalog.
3. **Seasonal guide:** "What to look for this month" — dynamically highlights species by what's visible right now. Spring ephemerals, fall color, winter bark ID, etc. Consider pulling phenology data from iNaturalist.

### Phase 7: Learning & Reference Pages
1. **Tips & resources for learning:** Curated page with recommended field guides, apps, local clubs, and self-study approach
2. **Terminology & concepts page:** Interactive glossary — deciduous vs. evergreen, monocot vs. dicot, taxonomy basics, morphological terms with diagrams
3. **-ology curriculum pages:** Each major category (Botany, Mycology, Ornithology, Entomology, Lichenology) gets a "study map" — what to learn first, progression from beginner to advanced, key concepts, recommended curriculum
4. **Evolution timeline:** Interactive visual story of plant evolution (and later other groups). Major milestones: first land plants, seed evolution, flower evolution, grass evolution, etc. Timeline with illustrations and links to relevant species in the explorer.

### Future Phases: All Plants, Fungi, Insects, Birds, Lichens
- Same pipeline with `iconic_taxa` parameter swapped
- Content generation prompts already adapted per kingdom (from Phase 3.5)
- Kingdom-specific UI additions (spore print colors, bird call audio, etc.)
- Each kingdom launch should include its corresponding -ology curriculum page

---

## Verification Plan

After each phase:

- **Phase 1:** Run `npm run pipeline -- --taxon=47375` and verify `data/` contains valid JSON for ~17 conifer species with photos and generated content
- **Phase 2:** Run `npm run dev`, navigate to `/species/pinus-strobus`, verify all sections render with real data and photos display correctly
- **Phase 3:** Verify `/explore` tree expands/collapses smoothly, `/compare/pinus` shows all pine species side by side, `/common` shows species sorted by abundance
- **Phase 3.5:** Re-run pipeline with `--force` on photos/content stages. Verify improved photo picks and richer content. Spot-check 5-10 species pages.
- **Phase 4:** Run Lighthouse audit (target 90+ on all categories), test on mobile viewport, verify deployment on Vercel

---

## Key Decisions Changed from Original Plan

1. **Dropped GBIF dependency** — iNaturalist's taxa API provides the same taxonomy data, simpler to use one source
2. **Dropped USDA PLANTS Database** — no reliable API; iNaturalist has native/introduced status via `establishment_means`
3. **Tree visualization = animated accordion, not D3** — simpler, more accessible, fits the "museum browsing" feel better than a graph
4. **Added Fuse.js for search** — original plan had no search implementation detail
5. **TypeScript scripts instead of JS** — type safety in the pipeline prevents data bugs
6. **Numbered script stages** — makes the pipeline execution order explicit
7. **Fixed iNaturalist place_ids** — CT=49, MA=2, ME=17, NH=41, RI=8, VT=47
8. **Corrected API field name** — `preferred_common_name` not `common_name`
