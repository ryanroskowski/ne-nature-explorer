# Feature Ideas — NE Nature Explorer

A running list of features worth considering, organized by the purpose
they serve. Picked to lean into what makes this app distinctive: a
curated, regional, *educational* field guide — not an observation logger
or an iNaturalist competitor.

---

## Field-companion features
*The app's literal use case is being outside.*

### "What's here right now"
Combine geolocation + current month + existing `commonality` and
`monthly` data to produce a live "likely species near you this week"
feed. Every ingredient already exists — this just surfaces them.
A natural fit for a homepage hero that changes every visit.

### PWA with offline species packs
Add a service worker and let users "download this group" or "download
this nature area" for offline browsing. The app is used in places with
no signal; this is the single biggest usability win for real fieldwork.
Next.js supports this natively.

### Life list / "My sightings"
localStorage-only, no account. Users check species they've seen, with
a count and "last seen on this date near this area" note. Creates
retention without any backend. Pair naturally with the PWA work.

---

## Learning features
*The educational mission.*

### ID quiz / flashcard mode
Pick a group and difficulty, see four photos, guess the species.
Scores over time. Photo scoring is already in place, so images are
high quality. Probably the single biggest "why come back" feature for
kids and students.

### Dichotomous key / interactive ID tree
Step-by-step: *"Are the leaves in pairs?"* → narrows down. Authoring
the branches is work, but starting with trees would cover a huge use
case. A complement to `/identify`, not a replacement.

### Glossary of terms
A small `/glossary` page with hover-definitions for terms like *bract*,
*scat*, *imbricate*, *monoecious*. Makes generated content approachable
for newcomers without dumbing it down.

---

## Content depth
*Most of the data for these already exists.*

### Per-species phenology strip
A 12-bar horizontal chart on each species page showing peak bloom /
migration / activity months. Monthly and seasonal data already exist;
this just visualizes it at species level.

### Range maps
Real, per-species range maps from authoritative sources. See
`docs/range-maps-research.md` for the source survey and recommended
tiered strategy.

### Range / state badges
Small "Seen in: MA · CT · RI" chips on species cards. State data
already exists, just not surfaced at card level.

### Audio for non-birds
Amphibian and insect calls from Xeno-canto / Macaulay are CC-licensed.
Spring peepers, wood frogs, cicadas, katydids all have iconic sounds
and would dramatically enrich non-bird pages.

### Indigenous / ethnobotanical notes
Respectful, sourced from published references. For a regional NE guide
this is meaningful — white pine, sweetgrass, sugar maple all have
significant indigenous histories absent from generic iNaturalist data.

---

## Return-visit hooks

### Species of the day / week
Deterministic daily rotation keyed on the date, weighted toward the
current season. Shows on homepage.

### Seasonal timeline view
"April in New England": trout lilies up, wood frogs calling, phoebes
back. Pulls from monthly + commonality data.

---

## Educator features
*A distinctive niche worth owning.*

### Printable field guide generator
Pick an area or a group, get a nicely typeset PDF with photos + key ID
tips. Teachers love this. `@react-pdf/renderer` makes it tractable.

### Scavenger hunt generator
Given a nature area, produce a printable checklist of ~10 species to
find there, weighted by commonality. Two hours of work, big classroom
value.

---

## Top three picks

If forced to prioritize:

1. **Life list + PWA / offline** (together — they reinforce each other;
   the app becomes a real field tool)
2. **ID quiz mode** (huge learning value, uses assets already generated)
3. **Range maps** + **phenology strip** on species pages (pure content
   polish; transforms the species page from "article" to "reference")
