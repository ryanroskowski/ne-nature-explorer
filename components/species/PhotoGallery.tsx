"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { blurDataURL } from "@/lib/image-utils";
import type { SpeciesPhoto } from "@/lib/types";

export default function PhotoGallery({ photos }: { photos: SpeciesPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
          setLightboxIndex((prev) =>
            prev !== null && prev > 0 ? prev - 1 : prev
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          setLightboxIndex((prev) =>
            prev !== null && prev < photos.length - 1 ? prev + 1 : prev
          );
          break;
      }
    },
    [lightboxIndex, photos.length]
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
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${lightboxIndex + 1} of ${photos.length}`}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 z-10 text-white/80 hover:text-white p-2"
              aria-label="Close lightbox"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Previous */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(lightboxIndex - 1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                aria-label="Previous photo"
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next */}
            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(lightboxIndex + 1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                aria-label="Next photo"
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Image */}
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
              {/* Attribution */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-8 rounded-b-lg">
                <p className="text-sm text-white/90">
                  {photos[lightboxIndex].attribution}
                </p>
                <a
                  href={photos[lightboxIndex].observationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/60 hover:text-white/90 transition-colors"
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
