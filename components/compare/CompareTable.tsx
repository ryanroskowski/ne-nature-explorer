"use client";

import Link from "next/link";
import Image from "next/image";
import { blurDataURL } from "@/lib/image-utils";
import type { SpeciesData } from "@/lib/types";

const features = [
  { key: "needles", label: "Key ID Feature", extract: (s: SpeciesData) => {
    const primary = s.idTips.find(t => t.isPrimary);
    return primary ? primary.description : s.idTips[0]?.description || "—";
  }},
  { key: "habitat", label: "Habitat", extract: (s: SpeciesData) => {
    // First sentence only
    return s.habitat?.split(". ")[0] + "." || "—";
  }},
  { key: "abundance", label: "How Common", extract: (s: SpeciesData) => {
    const labels: Record<string, string> = {
      "very-common": "Very Common",
      "common": "Common",
      "moderate": "Moderate",
      "uncommon": "Uncommon",
      "rare": "Rare",
    };
    return `${labels[s.abundanceTier]} (${s.observationCount.toLocaleString()} obs.)`;
  }},
  { key: "funfact", label: "Fun Fact", extract: (s: SpeciesData) => {
    return s.funFact || "—";
  }},
];

export default function CompareTable({ species }: { species: SpeciesData[] }) {
  if (species.length < 2) return null;

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full border-collapse min-w-[600px]">
        {/* Header row with species names and photos */}
        <thead>
          <tr>
            <th className="text-left p-3 bg-cream-dark/50 rounded-tl-xl font-ui text-xs text-text-muted uppercase tracking-wider w-32 align-bottom">
              Feature
            </th>
            {species.map((s) => (
              <th key={s.slug} className="p-3 bg-cream-dark/50 last:rounded-tr-xl">
                <Link href={`/species/${s.slug}`} className="group block">
                  <div className="relative w-16 h-16 mx-auto rounded-xl overflow-hidden bg-cream-dark mb-2">
                    {s.photos[0]?.mediumUrl ? (
                      <Image
                        src={s.photos[0].mediumUrl}
                        alt={s.commonName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="64px"
                        placeholder="blur"
                        blurDataURL={blurDataURL}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-text-muted">🌿</div>
                    )}
                  </div>
                  <span className="font-serif font-semibold text-sm text-text-primary group-hover:text-forest transition-colors capitalize block">
                    {s.commonName}
                  </span>
                  <span className="text-xs italic text-text-secondary block">
                    {s.scientificName}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feature, fi) => (
            <tr key={feature.key} className={fi % 2 === 0 ? "bg-card" : "bg-cream/50"}>
              <td className="p-3 font-ui font-medium text-sm text-text-primary align-top border-r border-border">
                {feature.label}
              </td>
              {species.map((s) => (
                <td key={s.slug} className="p-3 text-sm text-text-secondary leading-relaxed align-top border-r border-border last:border-r-0">
                  {feature.extract(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
