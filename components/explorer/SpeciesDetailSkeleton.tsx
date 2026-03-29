"use client";

export default function SpeciesDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 bg-cream-dark rounded w-3/4" />
        <div className="h-4 bg-cream-dark rounded w-1/2" />
      </div>

      {/* Photo placeholder */}
      <div className="aspect-[4/3] bg-cream-dark rounded-xl" />

      {/* Description */}
      <div className="space-y-2">
        <div className="h-4 bg-cream-dark rounded w-full" />
        <div className="h-4 bg-cream-dark rounded w-5/6" />
        <div className="h-4 bg-cream-dark rounded w-4/6" />
      </div>

      {/* Section */}
      <div className="space-y-2 pt-4">
        <div className="h-5 bg-cream-dark rounded w-1/3" />
        <div className="h-4 bg-cream-dark rounded w-full" />
        <div className="h-4 bg-cream-dark rounded w-4/5" />
      </div>

      {/* Section */}
      <div className="space-y-2 pt-4">
        <div className="h-5 bg-cream-dark rounded w-2/5" />
        <div className="h-4 bg-cream-dark rounded w-full" />
        <div className="h-4 bg-cream-dark rounded w-3/4" />
      </div>
    </div>
  );
}
