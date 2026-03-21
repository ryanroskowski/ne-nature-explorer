"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import AbundanceDots from "@/components/ui/AbundanceDots";
import FamilyBadge from "@/components/ui/FamilyBadge";
import { blurDataURL } from "@/lib/image-utils";
import type { AbundanceTier, SpeciesPhoto } from "@/lib/types";

interface CompareSpeciesCardProps {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  familyCommonName?: string;
  photos: SpeciesPhoto[];
  abundanceTier: AbundanceTier;
}

export default function CompareSpeciesCard({
  slug,
  commonName,
  scientificName,
  family,
  familyCommonName,
  photos,
  abundanceTier,
}: CompareSpeciesCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 = left, 1 = right
  const touchStartX = useRef(0);
  const hasMultiplePhotos = photos.length > 1;

  const goNext = useCallback(() => {
    if (photoIndex < photos.length - 1) {
      setDirection(1);
      setPhotoIndex((i) => i + 1);
    }
  }, [photoIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (photoIndex > 0) {
      setDirection(-1);
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

  const currentPhoto = photos[photoIndex];

  return (
    <div className="group/card bg-card rounded-2xl border border-border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Photo area — interactive, NOT a link */}
      <div
        className="relative overflow-hidden bg-cream-dark h-44"
        onTouchStart={hasMultiplePhotos ? handleTouchStart : undefined}
        onTouchEnd={hasMultiplePhotos ? handleTouchEnd : undefined}
        role={hasMultiplePhotos ? "region" : undefined}
        aria-label={hasMultiplePhotos ? `${commonName} photos — ${photoIndex + 1} of ${photos.length}` : undefined}
        aria-roledescription={hasMultiplePhotos ? "carousel" : undefined}
      >
        {currentPhoto ? (
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={currentPhoto.id}
              custom={direction}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <Image
                src={currentPhoto.mediumUrl}
                alt={`${commonName} — photo ${photoIndex + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                placeholder="blur"
                blurDataURL={blurDataURL}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Navigation arrows */}
        {hasMultiplePhotos && (
          <>
            {/* Left arrow */}
            <button
              onClick={goPrev}
              disabled={photoIndex === 0}
              className={`absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 z-10 transition-opacity
                ${photoIndex === 0 ? "opacity-0 pointer-events-none" : "opacity-50 group-hover/card:opacity-100"}`}
              aria-label="Previous photo"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 19l-7-7 7-7"
                />
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Photo counter */}
            <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-xs font-ui px-1.5 py-0.5 rounded z-10">
              {photoIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {/* Content area — IS a link to species page */}
      <Link
        href={`/species/${slug}`}
        className="block p-4 hover:bg-forest/5 transition-colors"
      >
        <h3 className="font-serif font-semibold text-text-primary group-hover/card:text-forest transition-colors">
          {commonName}
        </h3>
        <p className="italic text-text-secondary text-sm">{scientificName}</p>
        <div className="flex items-center justify-between mt-3">
          <FamilyBadge family={family} familyCommonName={familyCommonName} />
          <AbundanceDots tier={abundanceTier} />
        </div>
      </Link>
    </div>
  );
}
