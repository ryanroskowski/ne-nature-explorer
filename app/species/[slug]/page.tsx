import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSpecies, getAllSpeciesSlugs } from "@/lib/data/species";
import { getArticlesForSpecies } from "@/lib/data/articles";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PhotoGallery from "@/components/species/PhotoGallery";
import IdTips from "@/components/species/IdTips";
import SeasonalNotes from "@/components/species/SeasonalNotes";
import RelatedSpecies from "@/components/species/RelatedSpecies";
import AbundanceDots from "@/components/ui/AbundanceDots";
import FamilyBadge from "@/components/ui/FamilyBadge";
import NativeStatusBadge from "@/components/ui/NativeStatusBadge";
import EcologicalRoleBadges from "@/components/ui/EcologicalRoleBadges";
import { BloomSeasonBadge, PollinatorAttractionBadge } from "@/components/ui/PlantBadges";
import BirdAudioPlayer from "@/components/species/BirdAudioPlayer";

// Allow on-demand rendering — too many species (~16k) to pre-build at deploy time.
// Pages are generated on first visit, then cached by Vercel's CDN.
export const dynamicParams = true;

// Pre-build a small subset (most common species) for instant loading
export async function generateStaticParams() {
  // Only pre-render the first 200 most popular species at build time
  const slugs = getAllSpeciesSlugs();
  return slugs.slice(0, 200).map((slug) => ({ slug }));
}

// Generate metadata for SEO with Open Graph
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const species = getSpecies(slug);
  if (!species) return { title: "Species Not Found" };

  const title = `${species.commonName} (${species.scientificName})`;
  const description = species.description || `Learn about ${species.commonName} — identification tips, habitat, and more.`;
  const imageUrl = species.photos[0]?.largeUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(imageUrl && {
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 900,
            alt: `${species.commonName} photo`,
          },
        ],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

// Section wrapper component
function Section({
  title,
  icon,
  children,
  accent,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className={`font-serif text-xl font-semibold mb-4 flex items-center gap-2 ${accent || "text-text-primary"}`}>
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SpeciesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const species = getSpecies(slug);
  if (!species) notFound();

  // JSON-LD structured data for species
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    name: `${species.commonName} (${species.scientificName})`,
    headline: species.commonName,
    description: species.description,
    image: species.photos[0]?.largeUrl,
    about: {
      "@type": "Taxon",
      name: species.scientificName,
      alternateName: species.commonName,
      parentTaxon: {
        "@type": "Taxon",
        name: species.genus,
        alternateName: species.genusCommonName,
      },
    },
  };

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumbs — append ?group= so explore links load the right taxonomy */}
      <Breadcrumbs items={species.breadcrumb.map(item => ({
        ...item,
        slug: item.slug.startsWith("explore") && species.group
          ? `${item.slug}?group=${species.group}`
          : item.slug,
      }))} />

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary capitalize">
              {species.commonName}
            </h1>
            <p className="text-lg italic text-text-secondary mt-1">
              {species.scientificName}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <FamilyBadge
              family={species.family}
              familyCommonName={species.familyCommonName}
            />
            <AbundanceDots tier={species.abundanceTier} showLabel />
            {species.isNative !== undefined && (
              <NativeStatusBadge isNative={species.isNative} isInvasive={species.isInvasive} />
            )}
            {species.ecologicalRole && (
              <EcologicalRoleBadges role={species.ecologicalRole} />
            )}
            {species.bloomPeriod && (
              <BloomSeasonBadge bloomPeriod={species.bloomPeriod} />
            )}
            {species.pollinatorInfo && species.pollinatorInfo.length > 0 && (
              <PollinatorAttractionBadge pollinators={species.pollinatorInfo} />
            )}
          </div>
        </div>
        {species.description && (
          <p className="mt-4 text-text-secondary leading-relaxed text-lg">
            {species.description}
          </p>
        )}
      </header>

      {/* Photo Gallery */}
      <PhotoGallery photos={species.photos} />

      {/* Bird Audio */}
      {species.audio && species.audio.length > 0 && (
        <Section title="Listen" icon="🎶" accent="text-forest">
          <BirdAudioPlayer audio={species.audio} commonName={species.commonName} xenoCantoUrl={species.xenoCantoUrl} />
        </Section>
      )}

      {/* Why This Name? */}
      {species.nameStory && (
        <Section title="Why This Name?" icon="📖">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-text-secondary leading-relaxed">
              {species.nameStory}
            </p>
          </div>
        </Section>
      )}

      {/* How to Identify */}
      {species.idTips && species.idTips.length > 0 && (
        <Section title="How to Identify" icon="🔍" accent="text-forest">
          <IdTips tips={species.idTips} />
        </Section>
      )}

      {/* Where to Find */}
      {species.habitat && (
        <Section title="Where to Find" icon="🗺️" accent="text-teal">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-text-secondary leading-relaxed">
              {species.habitat}
            </p>
          </div>
        </Section>
      )}

      {/* Through the Seasons */}
      {species.seasonality && (
        <Section title="Through the Seasons" icon="📅">
          <SeasonalNotes data={species.seasonality} />
        </Section>
      )}

      {/* Did You Know? */}
      {species.funFact && (
        <Section title="Did You Know?" icon="💡" accent="text-gold">
          <div className="bg-gold/5 border border-gold/15 rounded-xl p-5">
            <p className="text-text-primary leading-relaxed font-medium">
              {species.funFact}
            </p>
          </div>
        </Section>
      )}

      {/* Don't Confuse With */}
      {species.confusionNotes && (
        <Section title="Don't Confuse With" icon="⚠️" accent="text-rose">
          <div className="bg-rose/5 border border-rose/15 rounded-xl p-5">
            <p className="text-text-secondary leading-relaxed">
              {species.confusionNotes}
            </p>
          </div>
        </Section>
      )}

      {/* Good to Know */}
      {species.contextualKnowledge && (
        <Section title="Good to Know" icon="💬">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-text-secondary leading-relaxed">
              {species.contextualKnowledge}
            </p>
          </div>
        </Section>
      )}

      {/* Related Species */}
      {species.relatedSpecies && species.relatedSpecies.length > 0 && (
        <Section title="Related Species" icon="🌿">
          <RelatedSpecies species={species.relatedSpecies} />
        </Section>
      )}

      {/* Related Articles */}
      {(() => {
        const articles = getArticlesForSpecies(slug);
        if (articles.length === 0) return null;
        return (
          <Section title="Dive Deeper" icon="📚">
            <div className="space-y-2">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="group flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-forest/30 transition-colors"
                >
                  <span className="text-2xl shrink-0" aria-hidden="true">
                    {article.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif font-semibold text-sm text-text-primary group-hover:text-forest transition-colors">
                      {article.title}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {article.subtitle}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* External Links */}
      <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-3 text-sm font-ui">
        <a
          href={species.iNaturalistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-text-secondary hover:text-forest hover:border-forest/30 transition-colors"
        >
          View on iNaturalist →
        </a>
        {species.wikipediaUrl && (
          <a
            href={species.wikipediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-text-secondary hover:text-forest hover:border-forest/30 transition-colors"
          >
            Wikipedia →
          </a>
        )}
      </div>
    </article>
  );
}
