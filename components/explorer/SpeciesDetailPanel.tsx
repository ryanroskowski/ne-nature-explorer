"use client";

import { motion } from "framer-motion";
import Link from "next/link";
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
import type { SpeciesData, ContextualArticle } from "@/lib/types";

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
    <section className="mt-8">
      <h3
        className={`font-serif text-lg font-semibold mb-3 flex items-center gap-2 ${accent || "text-text-primary"}`}
      >
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

interface SpeciesDetailPanelProps {
  species: SpeciesData;
  articles: ContextualArticle[];
  onClose: () => void;
  onSelectSpecies: (slug: string) => void;
}

export default function SpeciesDetailPanel({
  species,
  articles,
  onClose,
  onSelectSpecies,
}: SpeciesDetailPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full overflow-y-auto bg-card border border-border rounded-2xl split-pane-scroll"
    >
      {/* Sticky header bar */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between rounded-t-2xl">
        <Link
          href={`/species/${species.slug}`}
          className="text-xs font-ui text-forest hover:text-forest-light transition-colors"
        >
          Open full page &rarr;
        </Link>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors text-text-muted hover:text-text-primary"
          aria-label="Close species panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4">
        {/* Header */}
        <header className="mb-4">
          <h2 className="font-serif text-2xl font-bold text-text-primary capitalize">
            {species.commonName}
          </h2>
          <p className="text-base italic text-text-secondary mt-0.5">
            {species.scientificName}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <FamilyBadge family={species.family} familyCommonName={species.familyCommonName} />
            <AbundanceDots tier={species.abundanceTier} showLabel />
            {species.isNative !== undefined && (
              <NativeStatusBadge isNative={species.isNative} />
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
          {species.description && (
            <p className="mt-3 text-text-secondary leading-relaxed text-sm">
              {species.description}
            </p>
          )}
        </header>

        {/* Photos — horizontal scroll with lightbox, same as full species page */}
        <PhotoGallery photos={species.photos} />

        {/* Audio */}
        {species.audio && species.audio.length > 0 && (
          <Section title="Listen" icon="🎶" accent="text-forest">
            <BirdAudioPlayer
              audio={species.audio}
              commonName={species.commonName}
              xenoCantoUrl={species.xenoCantoUrl}
            />
          </Section>
        )}

        {/* Why This Name? */}
        {species.nameStory && (
          <Section title="Why This Name?" icon="📖">
            <div className="bg-cream/50 border border-border rounded-xl p-4">
              <p className="text-text-secondary leading-relaxed text-sm">
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
            <div className="bg-cream/50 border border-border rounded-xl p-4">
              <p className="text-text-secondary leading-relaxed text-sm">
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
            <div className="bg-gold/5 border border-gold/15 rounded-xl p-4">
              <p className="text-text-primary leading-relaxed text-sm font-medium">
                {species.funFact}
              </p>
            </div>
          </Section>
        )}

        {/* Don't Confuse With */}
        {species.confusionNotes && (
          <Section title="Don't Confuse With" icon="⚠️" accent="text-rose">
            <div className="bg-rose/5 border border-rose/15 rounded-xl p-4">
              <p className="text-text-secondary leading-relaxed text-sm">
                {species.confusionNotes}
              </p>
            </div>
          </Section>
        )}

        {/* Good to Know */}
        {species.contextualKnowledge && (
          <Section title="Good to Know" icon="💬">
            <div className="bg-cream/50 border border-border rounded-xl p-4">
              <p className="text-text-secondary leading-relaxed text-sm">
                {species.contextualKnowledge}
              </p>
            </div>
          </Section>
        )}

        {/* Related Species */}
        {species.relatedSpecies && species.relatedSpecies.length > 0 && (
          <Section title="Related Species" icon="🌿">
            <RelatedSpecies
              species={species.relatedSpecies}
              onSelectSpecies={onSelectSpecies}
            />
          </Section>
        )}

        {/* Related Articles */}
        {articles.length > 0 && (
          <Section title="Dive Deeper" icon="📚">
            <div className="space-y-2">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="group flex items-center gap-3 bg-cream/50 border border-border rounded-xl p-3 hover:border-forest/30 transition-colors"
                >
                  <span className="text-xl shrink-0" aria-hidden="true">
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
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* External Links */}
        <div className="mt-8 pt-4 border-t border-border flex flex-wrap gap-2 text-sm font-ui pb-8">
          <a
            href={species.iNaturalistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream/50 border border-border rounded-lg text-text-secondary hover:text-forest hover:border-forest/30 transition-colors text-xs"
          >
            iNaturalist &rarr;
          </a>
          {species.wikipediaUrl && (
            <a
              href={species.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream/50 border border-border rounded-lg text-text-secondary hover:text-forest hover:border-forest/30 transition-colors text-xs"
            >
              Wikipedia &rarr;
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
