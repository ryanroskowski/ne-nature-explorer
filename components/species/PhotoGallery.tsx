"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { blurDataURL } from "@/lib/image-utils";
import type { SpeciesPhoto } from "@/lib/types";

export default function PhotoGallery({ photos }: { photos: SpeciesPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null && prev < photos.length - 1 ? prev + 1 : prev
    );
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null && prev > 0 ? prev - 1 : prev
    );
  }, []);

  // Keyboard navigation for lightbox
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;

      switch (e.key) {
        case "Escape":
          setLightboxIndex(null);
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
      }
    },
    [lightboxIndex, goNext, goPrev]
  );

  // Touch swipe handlers for lightbox
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;

      // Only swipe if horizontal movement is dominant and exceeds threshold
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) goNext();
        else goPrev();
      }
    },
    [goNext, goPrev]
  );

  useEffect(() => {
    if (lightboxIndex !== null) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent background scrolling
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, handleKeyDown]);

  if (photos.length === 0) return null;

  return (
    <>
      {/* Horizontal scrolling gallery */}
      <div className="relative -mx-4 sm:-mx-6" role="region" aria-label="Photo gallery">
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 pb-3 photo-scroll">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIndex(i)}
              className="relative shrink-0 rounded-xl overflow-hidden group cursor-pointer"
              style={{ width: photos.length === 1 ? "100%" : undefined }}
              aria-label={`View photo ${i + 1} of ${photos.length} in full size`}
            >
              <div className={`relative ${photos.length === 1 ? "h-72 w-full" : "h-56 w-72"}`}>
                <Image
                  src={photo.mediumUrl}
                  alt={`Photo ${i + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="300px"
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                  priority={i === 0}
                />
              </div>
              {/* Attribution overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white/90 truncate">
                  {photo.attribution}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${lightboxIndex + 1} of ${photos.length}`}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 z-20 text-white/80 hover:text-white p-2"
              aria-label="Close lightbox"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image + overlaid navigation */}
            <motion.div
              key={lightboxIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-[90vw] max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={photos[lightboxIndex].largeUrl}
                alt={`Photo ${lightboxIndex + 1}`}
                width={1200}
                height={900}
                className="object-contain max-h-[85vh] rounded-lg"
                sizes="90vw"
              />

              {/* Previous — overlaid on left edge of image */}
              {lightboxIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  className="absolute left-0 top-0 bottom-0 w-16 sm:w-20 flex items-center justify-start pl-2 text-white/70 hover:text-white active:text-white transition-colors"
                  aria-label="Previous photo"
                >
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Next — overlaid on right edge of image */}
              {lightboxIndex < photos.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="absolute right-0 top-0 bottom-0 w-16 sm:w-20 flex items-center justify-end pr-2 text-white/70 hover:text-white active:text-white transition-colors"
                  aria-label="Next photo"
                >
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Attribution */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-8 rounded-b-lg pointer-events-none">
                <p className="text-sm text-white/90">
                  {photos[lightboxIndex].attribution}
                </p>
                <a
                  href={photos[lightboxIndex].observationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/60 hover:text-white/90 transition-colors pointer-events-auto"
                >
                  View on iNaturalist →
                </a>
              </div>
            </motion.div>

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-ui">
              {lightboxIndex + 1} / {photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
