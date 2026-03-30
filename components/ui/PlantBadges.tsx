const BLOOM_LABELS: Record<string, { label: string; icon: string }> = {
  "early-spring": { label: "Early Spring", icon: "🌱" },
  spring: { label: "Spring", icon: "🌸" },
  "late-spring": { label: "Late Spring", icon: "🌷" },
  "early-summer": { label: "Early Summer", icon: "☀️" },
  summer: { label: "Summer", icon: "🌻" },
  "late-summer": { label: "Late Summer", icon: "🌾" },
  fall: { label: "Fall", icon: "🍂" },
};

const POLLINATOR_DISPLAY: Record<string, { icon: string; label: string }> = {
  bees: { icon: "🐝", label: "Bees" },
  butterflies: { icon: "🦋", label: "Butterflies" },
  moths: { icon: "🦗", label: "Moths" },
  hummingbirds: { icon: "🐦", label: "Hummingbirds" },
  flies: { icon: "🪰", label: "Flies" },
  beetles: { icon: "🪲", label: "Beetles" },
  wasps: { icon: "🐝", label: "Wasps" },
};

export function BloomSeasonBadge({
  bloomPeriod,
}: {
  bloomPeriod: string;
}) {
  const info = BLOOM_LABELS[bloomPeriod];
  if (!info) return null;

  return (
    <span
      title={`Blooms in ${info.label.toLowerCase()}`}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-ui font-medium bg-pink-50 text-pink-800 border border-pink-200"
    >
      <span aria-hidden="true">{info.icon}</span>
      {info.label} bloom
    </span>
  );
}

export function PollinatorAttractionBadge({
  pollinators,
}: {
  pollinators: string[];
}) {
  if (!pollinators.length) return null;

  // Show top 3 pollinator types with icons
  const display = pollinators.slice(0, 3);
  const icons = display
    .map((p) => POLLINATOR_DISPLAY[p]?.icon)
    .filter(Boolean)
    .join("");
  const labels = display
    .map((p) => POLLINATOR_DISPLAY[p]?.label || p)
    .join(", ");
  const extra = pollinators.length > 3 ? ` +${pollinators.length - 3} more` : "";

  return (
    <span
      title={`Attracts: ${pollinators.map((p) => POLLINATOR_DISPLAY[p]?.label || p).join(", ")}`}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-ui font-medium bg-amber-50 text-amber-800 border border-amber-200"
    >
      <span aria-hidden="true">{icons}</span>
      {labels}{extra}
    </span>
  );
}
