"use client";

import type { AbundanceTier } from "@/lib/types";

const tierMap: Record<AbundanceTier, number> = {
  "very-common": 5,
  common: 4,
  moderate: 3,
  uncommon: 2,
  rare: 1,
};

const tierLabels: Record<AbundanceTier, string> = {
  "very-common": "Very Common",
  common: "Common",
  moderate: "Moderate",
  uncommon: "Uncommon",
  rare: "Rare",
};

export default function AbundanceDots({
  tier,
  showLabel = false,
}: {
  tier: AbundanceTier;
  showLabel?: boolean;
}) {
  const filled = tierMap[tier];
  const total = 5;

  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Abundance: ${tierLabels[tier]} (${filled} of ${total})`}>
      <div className="flex gap-0.5" title={tierLabels[tier]}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`inline-block w-2 h-2 rounded-full ${
              i < filled ? "bg-gold" : "bg-border"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs font-ui text-text-secondary ml-1">
          {tierLabels[tier]}
        </span>
      )}
    </div>
  );
}
