/**
 * GroupIcon — uses Twemoji images for groups whose native emoji don't render
 * well across platforms. Falls back to native emoji for groups with good support.
 *
 * Twemoji groups: cnidarians (🪼), myriapods (🐛), echinoderms (⭐), lichens (🌱), plants (🌿)
 * Native emoji: mammals, amphibians, reptiles, birds, fungi, insects, arachnids, fish, mollusks, crustaceans
 */

/* eslint-disable @next/next/no-img-element */

interface GroupIconProps {
  groupKey: string;
  emoji?: string;
  size?: number;
  className?: string;
}

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

// Map group keys to Twemoji codepoints for groups that need image-based emoji
const TWEMOJI_CODES: Record<string, string> = {
  cnidarians: "1fabc",   // 🪼 jellyfish — doesn't render on many systems
  myriapods: "1f41b",    // 🐛 bug — closest available emoji for centipede
  echinoderms: "2b50",   // ⭐ star — represents sea star
  lichens: "1f331",      // 🌱 seedling — closest to lichen
  plants: "1f33f",       // 🌿 herb
};

export default function GroupIcon({ groupKey, emoji, size = 20, className }: GroupIconProps) {
  const twemojiCode = TWEMOJI_CODES[groupKey];
  if (twemojiCode) {
    return (
      <img
        src={`${TWEMOJI_BASE}/${twemojiCode}.svg`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`inline-block shrink-0 ${className || ""}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  // Native emoji for groups with good cross-platform support
  return (
    <span aria-hidden="true" className={className}>
      {emoji || "🔬"}
    </span>
  );
}
