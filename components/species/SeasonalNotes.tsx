"use client";

interface SeasonalData {
  spring: string;
  summer: string;
  fall: string;
  winter: string;
}

const seasons = [
  { key: "spring" as const, label: "Spring", icon: "🌱", color: "text-forest" },
  { key: "summer" as const, label: "Summer", icon: "☀️", color: "text-gold" },
  { key: "fall" as const, label: "Fall", icon: "🍂", color: "text-rose" },
  { key: "winter" as const, label: "Winter", icon: "❄️", color: "text-teal" },
];

export default function SeasonalNotes({ data }: { data: SeasonalData }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {seasons.map((season) => {
        const text = data[season.key];
        if (!text) return null;
        return (
          <div
            key={season.key}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{season.icon}</span>
              <span className={`font-serif font-semibold ${season.color}`}>
                {season.label}
              </span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
