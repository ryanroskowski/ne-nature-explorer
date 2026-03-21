"use client";

const MONTHS = [
  { key: "january", short: "Jan", label: "January" },
  { key: "february", short: "Feb", label: "February" },
  { key: "march", short: "Mar", label: "March" },
  { key: "april", short: "Apr", label: "April" },
  { key: "may", short: "May", label: "May" },
  { key: "june", short: "Jun", label: "June" },
  { key: "july", short: "Jul", label: "July" },
  { key: "august", short: "Aug", label: "August" },
  { key: "september", short: "Sep", label: "September" },
  { key: "october", short: "Oct", label: "October" },
  { key: "november", short: "Nov", label: "November" },
  { key: "december", short: "Dec", label: "December" },
];

const SEASON_COLORS: Record<string, string> = {
  winter: "bg-blue-50 text-blue-700",
  spring: "bg-green-50 text-green-700",
  summer: "bg-amber-50 text-amber-700",
  fall: "bg-orange-50 text-orange-700",
};

const MONTH_SEASON: Record<string, string> = {
  january: "winter",
  february: "winter",
  march: "spring",
  april: "spring",
  may: "spring",
  june: "summer",
  july: "summer",
  august: "summer",
  september: "fall",
  october: "fall",
  november: "fall",
  december: "winter",
};

interface MonthSelectorProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelect: (month: string) => void;
}

export default function MonthSelector({
  selectedMonth,
  availableMonths,
  onSelect,
}: MonthSelectorProps) {
  return (
    <div className="mb-6">
      <div
        className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none"
        role="tablist"
        aria-label="Select month"
      >
        {MONTHS.map((m) => {
          const isAvailable = availableMonths.includes(m.key);
          const isSelected = selectedMonth === m.key;
          const season = MONTH_SEASON[m.key];
          return (
            <button
              key={m.key}
              onClick={() => isAvailable && onSelect(m.key)}
              disabled={!isAvailable}
              role="tab"
              aria-selected={isSelected}
              className={`shrink-0 px-3 py-2 rounded-xl text-sm font-ui font-medium transition-all duration-200 ${
                isSelected
                  ? "bg-forest text-white shadow-sm"
                  : isAvailable
                    ? `${SEASON_COLORS[season]} hover:ring-2 hover:ring-forest/30`
                    : "bg-cream-dark text-text-muted opacity-50 cursor-default"
              }`}
            >
              <span className="sm:hidden">{m.short}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { MONTHS, MONTH_SEASON };
