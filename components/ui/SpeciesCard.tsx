"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import AbundanceDots from "./AbundanceDots";
import FamilyBadge from "./FamilyBadge";
import { blurDataURL } from "@/lib/image-utils";
import type { AbundanceTier } from "@/lib/types";

interface SpeciesCardProps {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  familyCommonName?: string;
  thumbnailUrl?: string;
  abundanceTier: AbundanceTier;
  compact?: boolean;
  large?: boolean;
  /** Mark as priority for above-fold images */
  priority?: boolean;
  /** Multiple photos enable carousel arrows */
  photos?: { mediumUrl: string }[];
}

export default function SpeciesCard({
  slug,
  commonName,
  scientificName,
  family,
  familyCommonName,
  thumbnailUrl,
  abundanceTier,
  compact = false,
  large = false,
  priority = false,
  photos,
}: SpeciesCardProps) {
  const photoHeight = large ? "h-56" : compact ? "h-32" : "h-44";
  const hasCarousel = photos && photos.length > 1;

  // Carousel state — only used when photos are provided
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartX = useRef(0);

  const goNext = useCallback(() => {
    if (photos && photoIndex < photos.length - 1) {
      setPhotoIndex((i) => i + 1);
    }
  }, [photoIndex, photos]);

  const goPrev = useCallback(() => {
    if (photoIndex > 0) {
      setPhotoIndex((i) => i - 1);
    }
  }, [photoIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(deltaX) > 50) {
        if (deltaX < 0) goNext();
        else goPrev();
      }
    },
    [goNext, goPrev]
  );

  // Determine current image URL
  const currentImageUrl = hasCarousel
    ? photos[photoIndex].mediumUrl
    : photos?.[0]?.mediumUrl || thumbnailUrl;

  // --- Carousel layout: photo area is interactive, content area is link ---
  if (hasCarousel) {
    return (
      <div className="group/card bg-card rounded-2xl border border-border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        {/* Photo area — interactive carousel, NOT a link */}
        <div
          className={`relative overflow-hidden bg-cream-dark ${photoHeight}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="region"
          aria-label={`${commonName} photos — ${photoIndex + 1} of ${photos.length}`}
          aria-roledescription="carousel"
        >
          {/* Use key to trigger CSS transition on change */}
          <Image
            key={photos[photoIndex].mediumUrl}
            src={photos[photoIndex].mediumUrl}
            alt={`${commonName} — photo ${photoIndex + 1}`}
            fill
            className="object-cover animate-fade-in"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            placeholder="blur"
            blurDataURL={blurDataURL}
          />

          {/* Left arrow */}
          <button
            onClick={goPrev}
            disabled={photoIndex === 0}
            className={`absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 z-10 transition-opacity
              ${photoIndex === 0 ? "opacity-0 pointer-events-none" : "opacity-50 group-hover/card:opacity-100"}`}
            aria-label="Previous photo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right arrow */}
          <button
            onClick={goNext}
            disabled={photoIndex === photos.length - 1}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 z-10 transition-opacity
              ${photoIndex === photos.length - 1 ? "opacity-0 pointer-events-none" : "opacity-50 group-hover/card:opacity-100"}`}
            aria-label="Next photo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Photo counter */}
          <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-xs font-ui px-1.5 py-0.5 rounded z-10">
            {photoIndex + 1} / {photos.length}
          </span>
        </div>

        {/* Content area — IS a link to species page */}
        <Link
          href={`/species/${slug}`}
          className={`block hover:bg-forest/5 transition-colors ${compact ? "p-3" : large ? "p-5" : "p-4"}`}
        >
          <h3 className={`font-serif font-semibold text-text-primary group-hover/card:text-forest transition-colors ${compact ? "text-sm" : large ? "text-lg" : "text-base"}`}>
            {commonName}
          </h3>
          <p className={`italic text-text-secondary ${compact ? "text-xs" : "text-sm"}`}>
            {scientificName}
          </p>
          <div className={`flex items-center justify-between ${compact ? "mt-2" : "mt-3"}`}>
            <FamilyBadge family={family} familyCommonName={familyCommonName} />
            <AbundanceDots tier={abundanceTier} />
          </div>
        </Link>
      </div>
    );
  }

  // --- Simple layout: whole card is a link (original behavior) ---
  return (
    <Link
      href={`/species/${slug}`}
      className="group block bg-card rounded-2xl border border-border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Photo */}
      <div className={`relative overflow-hidden bg-cream-dark ${photoHeight}`}>
        {currentImageUrl ? (
          <Image
            src={currentImageUrl}
            alt={commonName}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            placeholder="blur"
            blurDataURL={blurDataURL}
            priority={priority}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={compact ? "p-3" : large ? "p-5" : "p-4"}>
        <h3 className={`font-serif font-semibold text-text-primary group-hover:text-forest transition-colors ${compact ? "text-sm" : large ? "text-lg" : "text-base"}`}>
          {commonName}
        </h3>
        <p className={`italic text-text-secondary ${compact ? "text-xs" : "text-sm"}`}>
          {scientificName}
        </p>
        <div className={`flex items-center justify-between ${compact ? "mt-2" : "mt-3"}`}>
          <FamilyBadge family={family} familyCommonName={familyCommonName} />
          <AbundanceDots tier={abundanceTier} />
        </div>
      </div>
    </Link>
  );
}
