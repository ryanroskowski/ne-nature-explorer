"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface PlantNetResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    scientificNameAuthorship: string;
    family: {
      scientificNameWithoutAuthor: string;
    };
    genus: {
      scientificNameWithoutAuthor: string;
    };
    commonNames: string[];
  };
  gbif?: { id: number };
  images?: Array<{
    url: { m: string };
    organ: string;
    citation: string;
  }>;
}

interface IdentifyResponse {
  results: PlantNetResult[];
  remainingIdentificationRequests?: number;
  error?: string;
}

type OrganType = "auto" | "leaf" | "flower" | "fruit" | "bark" | "habit";

const ORGAN_OPTIONS: { value: OrganType; label: string; icon: string }[] = [
  { value: "auto", label: "Auto-detect", icon: "🔍" },
  { value: "flower", label: "Flower", icon: "🌸" },
  { value: "leaf", label: "Leaf", icon: "🍃" },
  { value: "fruit", label: "Fruit", icon: "🍎" },
  { value: "bark", label: "Bark", icon: "🪵" },
  { value: "habit", label: "Whole plant", icon: "🌿" },
];

function scientificNameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export default function IdentifyPage() {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [organ, setOrgan] = useState<OrganType>("auto");
  const [results, setResults] = useState<PlantNetResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [speciesExistence, setSpeciesExistence] = useState<Record<string, boolean>>({});
  const [remainingIds, setRemainingIds] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isExhausted = remainingIds !== null && remainingIds <= 0;

  const updateRemaining = useCallback((count: number) => {
    setRemainingIds(count);
    try {
      sessionStorage.setItem("plantnet-remaining", String(count));
    } catch {
      // sessionStorage not available
    }
  }, []);

  // Restore remaining count from sessionStorage on page load
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("plantnet-remaining");
      if (stored !== null) {
        setRemainingIds(parseInt(stored, 10));
      }
    } catch {
      // sessionStorage not available
    }
  }, []);

  const addImages = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size < 10 * 1024 * 1024
    );
    if (newFiles.length === 0) return;

    setImages((prev) => {
      const combined = [...prev, ...newFiles].slice(0, 5);
      return combined;
    });

    for (const file of newFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string].slice(0, 5));
      };
      reader.readAsDataURL(file);
    }

    // Clear previous results
    setResults(null);
    setError(null);
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setResults(null);
    setError(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      addImages(e.dataTransfer.files);
    },
    [addImages]
  );

  const checkSpeciesExistence = async (slugs: string[]) => {
    try {
      const res = await fetch(`/api/search-index`);
      const data: { slug: string }[] = await res.json();
      const slugSet = new Set(data.map((entry) => entry.slug));
      const existence: Record<string, boolean> = {};
      for (const slug of slugs) {
        existence[slug] = slugSet.has(slug);
      }
      setSpeciesExistence(existence);
    } catch {
      // If search index fails, just don't show database links
      setSpeciesExistence({});
    }
  };

  const identify = async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      for (const image of images) {
        formData.append("images", image);
      }
      for (let i = 0; i < images.length; i++) {
        formData.append("organs", organ);
      }

      const response = await fetch("/api/identify", {
        method: "POST",
        body: formData,
      });

      const data: IdentifyResponse = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          updateRemaining(0);
        }
        setError(data.error || "Identification failed");
        return;
      }

      // Track remaining daily identifications
      if (data.remainingIdentificationRequests !== undefined) {
        updateRemaining(data.remainingIdentificationRequests);
      }

      if (!data.results || data.results.length === 0) {
        setError(
          "No plant species could be identified. Try a clearer photo with good lighting."
        );
        return;
      }

      setResults(data.results);

      // Check which species exist in our database
      const slugs = data.results.map((r) =>
        scientificNameToSlug(r.species.scientificNameWithoutAuthor)
      );
      checkSpeciesExistence(slugs);
    } catch {
      setError("Failed to connect to identification service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImages([]);
    setPreviews([]);
    setResults(null);
    setError(null);
    setSpeciesExistence({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest mb-3">
            🌿 Plant Identifier
          </h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            Upload a photo of any plant and get an instant identification.
            For best results, photograph a single clear feature — a flower,
            leaf, or bark.
          </p>
          <p className="text-xs text-text-secondary/60 mt-2">
            Powered by Pl@ntNet · For plants only
            {remainingIds !== null && (
              <span
                className={`ml-1 ${
                  remainingIds <= 0
                    ? "text-red-500 font-medium"
                    : remainingIds <= 10
                      ? "text-amber-600 font-medium"
                      : ""
                }`}
              >
                · {remainingIds} ID{remainingIds !== 1 ? "s" : ""} remaining today
              </span>
            )}
          </p>
        </div>

        {/* Exhausted banner */}
        {isExhausted && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 text-center">
            <p className="text-red-700 font-ui font-medium">
              Daily identification limit reached
            </p>
            <p className="text-red-600/80 text-sm mt-1">
              The free PlantNet API allows a limited number of identifications
              per day. This resets at midnight UTC — try again tomorrow!
            </p>
          </div>
        )}

        {/* Free tier notice */}
        <div className="bg-blue-50/60 border border-blue-200/50 rounded-lg px-4 py-3 mb-6 text-center">
          <p className="text-xs text-blue-700/70">
            🌱 This feature uses PlantNet&apos;s free tier — there&apos;s a shared limit of
            500 identifications per day across all visitors. We&apos;re working on increasing
            this quota. If the limit is reached, try again after midnight UTC.
          </p>
        </div>

        {/* Upload area */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-6">
          {/* Organ selector */}
          <div className="mb-5">
            <label className="block text-sm font-ui font-medium text-text-primary mb-2">
              What part of the plant is in your photo?
            </label>
            <div className="flex flex-wrap gap-2">
              {ORGAN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOrgan(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-ui transition-all ${
                    organ === opt.value
                      ? "bg-forest text-white shadow-sm"
                      : "bg-cream text-text-secondary hover:bg-cream-dark"
                  }`}
                >
                  <span className="mr-1">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? "border-forest bg-forest/5"
                : "border-border"
            }`}
          >
            {/* Gallery input (no capture) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && addImages(e.target.files)}
              className="hidden"
            />
            {/* Camera input (capture=environment) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files && addImages(e.target.files)}
              className="hidden"
            />

            {previews.length === 0 ? (
              <div>
                <div className="text-4xl mb-3">🌿</div>
                <p className="text-text-primary font-ui font-medium mb-4">
                  Upload a plant photo to identify
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {/* Take Photo — mobile only (on desktop capture just opens file picker) */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="sm:hidden inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-forest text-white font-ui font-medium text-sm hover:bg-forest-light transition-colors"
                  >
                    📷 Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border text-text-primary font-ui font-medium text-sm hover:bg-cream transition-colors sm:bg-forest sm:text-white sm:border-forest sm:hover:bg-forest-light"
                  >
                    <span className="sm:hidden">🖼️ Choose from Library</span>
                    <span className="hidden sm:inline">📷 Upload Photo</span>
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-4">
                  Drag & drop also works · Up to 5 images · JPEG or PNG
                </p>
              </div>
            ) : (
              <div
                className="flex flex-wrap gap-3 justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {previews.map((preview, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={preview}
                      alt={`Upload ${i + 1}`}
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      aria-label={`Remove image ${i + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {previews.length < 5 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-text-secondary hover:border-forest/50 hover:text-forest transition-all"
                  >
                    <span className="text-2xl">+</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={identify}
              disabled={images.length === 0 || loading || isExhausted}
              className="flex-1 bg-forest text-white font-ui font-medium py-3 px-6 rounded-xl hover:bg-forest-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Identifying…
                </span>
              ) : isExhausted ? (
                "Daily limit reached"
              ) : (
                "Identify Plant"
              )}
            </button>
            {(images.length > 0 || results) && (
              <button
                onClick={reset}
                className="px-5 py-3 rounded-xl border border-border text-text-secondary font-ui hover:bg-cream transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6"
            >
              <p className="text-red-700 font-ui text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {results && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="font-serif text-xl font-bold text-forest">
                Results
              </h2>

              {results.map((result, i) => {
                const slug = scientificNameToSlug(
                  result.species.scientificNameWithoutAuthor
                );
                const inDatabase = speciesExistence[slug];
                const confidence = Math.round(result.score * 100);
                const commonName = result.species.commonNames?.[0];

                return (
                  <motion.div
                    key={slug}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`bg-white rounded-xl border overflow-hidden ${
                      i === 0
                        ? "border-forest shadow-md"
                        : "border-border shadow-sm"
                    }`}
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {i === 0 && confidence >= 20 && (
                            <span className="inline-block text-xs font-ui font-semibold text-forest bg-forest/10 rounded-full px-2.5 py-0.5 mb-2">
                              Best match
                            </span>
                          )}
                          <h3 className="font-serif text-lg font-bold text-text-primary">
                            {commonName ||
                              result.species.scientificNameWithoutAuthor}
                          </h3>
                          <p className="text-sm text-text-secondary italic">
                            {result.species.scientificNameWithoutAuthor}
                          </p>
                          <p className="text-xs text-text-secondary mt-1">
                            Family:{" "}
                            {result.species.family?.scientificNameWithoutAuthor}
                          </p>
                        </div>

                        {/* Confidence */}
                        <div className="text-right shrink-0">
                          <div
                            className={`text-2xl font-bold font-ui ${
                              confidence >= 50
                                ? "text-forest"
                                : confidence >= 20
                                  ? "text-amber-600"
                                  : "text-text-secondary"
                            }`}
                          >
                            {confidence}%
                          </div>
                          <div className="text-xs text-text-secondary">
                            confidence
                          </div>
                        </div>
                      </div>

                      {/* Reference images from PlantNet */}
                      {result.images && result.images.length > 0 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                          {result.images.slice(0, 4).map((img, j) => (
                            <img
                              key={j}
                              src={img.url?.m}
                              alt={`Reference: ${result.species.scientificNameWithoutAuthor} ${img.organ}`}
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}

                      {/* Link to species page or external */}
                      <div className="flex gap-2 mt-4">
                        {inDatabase ? (
                          <Link
                            href={`/species/${slug}`}
                            className="flex-1 text-center bg-forest text-white font-ui font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-forest-light transition-colors"
                          >
                            View on NE Nature →
                          </Link>
                        ) : (
                          <a
                            href={`https://www.inaturalist.org/search?q=${encodeURIComponent(result.species.scientificNameWithoutAuthor)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center bg-cream text-text-primary font-ui font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-cream-dark transition-colors border border-border"
                          >
                            View on iNaturalist ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Low confidence warning */}
              {results[0] && results[0].score < 0.2 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-700 text-sm font-ui">
                    <strong>Low confidence results.</strong> Try uploading a
                    clearer photo showing distinctive features like flowers,
                    leaves, or bark patterns.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tips section */}
        {!results && !loading && (
          <div className="bg-white/60 rounded-xl p-5 border border-border/50">
            <h3 className="font-serif font-bold text-forest mb-3">
              📸 Tips for better results
            </h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex gap-2">
                <span>🌸</span>
                <span>
                  <strong>Flowers</strong> give the most accurate
                  identifications
                </span>
              </li>
              <li className="flex gap-2">
                <span>🍃</span>
                <span>
                  <strong>Leaves</strong> — photograph the top side with clear
                  shape visible
                </span>
              </li>
              <li className="flex gap-2">
                <span>📐</span>
                <span>
                  Fill the frame with the plant feature — avoid distant shots
                </span>
              </li>
              <li className="flex gap-2">
                <span>☀️</span>
                <span>Good natural lighting dramatically improves accuracy</span>
              </li>
              <li className="flex gap-2">
                <span>📷</span>
                <span>
                  Upload multiple photos (up to 5) of different parts for better
                  results
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
