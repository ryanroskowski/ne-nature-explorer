"use client";

interface IdTip {
  label: string;
  description: string;
  isPrimary?: boolean;
}

export default function IdTips({ tips }: { tips: IdTip[] }) {
  if (!tips || tips.length === 0) return null;

  return (
    <div className="space-y-3">
      {tips.map((tip, i) => (
        <div
          key={i}
          className={`flex gap-3 p-3 rounded-xl ${
            tip.isPrimary
              ? "bg-forest/5 border border-forest/15"
              : "bg-card border border-border"
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {tip.isPrimary ? (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-forest text-white text-xs font-ui font-bold">
                ★
              </span>
            ) : (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-cream-dark text-text-secondary text-xs font-ui font-bold">
                {i + 1}
              </span>
            )}
          </div>
          <div>
            <span className="font-semibold text-text-primary font-serif">
              {tip.label}
            </span>
            {tip.isPrimary && (
              <span className="ml-2 text-xs font-ui text-forest font-medium bg-forest/10 px-1.5 py-0.5 rounded">
                Key Feature
              </span>
            )}
            <p className="mt-1 text-text-secondary text-sm leading-relaxed">
              {tip.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
