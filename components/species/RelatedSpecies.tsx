"use client";

import Link from "next/link";
import Image from "next/image";
import { blurDataURL } from "@/lib/image-utils";
import type { RelatedSpecies as RelatedSpeciesType } from "@/lib/types";

export default function RelatedSpecies({
  species,
  onSelectSpecies,
}: {
  species: RelatedSpeciesType[];
  onSelectSpecies?: (slug: string) => void;
}) {
  if (!species || species.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {species.map((s) => (
        <Link
          key={s.slug}
          href={`/species/${s.slug}`}
          onClick={
            onSelectSpecies
              ? (e) => {
                  e.preventDefault();
                  onSelectSpecies(s.slug);
                }
              : undefined
          }
          className="group flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-forest/30 transition-colors"
        >
          {/* Thumbnail */}
          <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-cream-dark">
            {s.thumbnailUrl ? (
              <Image
                src={s.thumbnailUrl}
                alt={s.commonName}
                fill
                className="object-cover"
                sizes="56px"
                placeholder="blur"
                blurDataURL={blurDataURL}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-xs">
                🌿
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0">
            <p className="font-serif font-semibold text-sm text-text-primary group-hover:text-forest transition-colors truncate">
              {s.commonName}
            </p>
            <p className="text-xs italic text-text-secondary truncate">
              {s.scientificName}
            </p>
            {s.distinction && (
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                {s.distinction}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
