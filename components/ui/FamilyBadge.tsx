"use client";

// 10 visually distinct color combos that work on warm cream backgrounds
const colorPalette = [
  "bg-forest/10 text-forest border-forest/20",       // forest green
  "bg-teal/10 text-teal border-teal/20",             // teal
  "bg-rose/10 text-rose border-rose/20",             // rose
  "bg-gold/10 text-gold border-gold/20",             // gold
  "bg-[#5b4fa8]/10 text-[#5b4fa8] border-[#5b4fa8]/20",  // purple
  "bg-[#b85c2f]/10 text-[#b85c2f] border-[#b85c2f]/20",  // rust
  "bg-[#2a7b9b]/10 text-[#2a7b9b] border-[#2a7b9b]/20",  // ocean
  "bg-[#7a6340]/10 text-[#7a6340] border-[#7a6340]/20",  // earth brown
  "bg-[#8b5e83]/10 text-[#8b5e83] border-[#8b5e83]/20",  // mauve
  "bg-[#3d7a5f]/10 text-[#3d7a5f] border-[#3d7a5f]/20",  // sage
];

/** Simple string hash → consistent palette index */
function hashFamily(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % colorPalette.length;
}

export default function FamilyBadge({
  family,
  familyCommonName,
}: {
  family: string;
  familyCommonName?: string;
}) {
  const colorClass = colorPalette[hashFamily(family)];
  const label = familyCommonName || family;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-ui border ${colorClass}`}
    >
      {label}
    </span>
  );
}
