"use client";

const COLORS = [
  { name: "white", hex: "#FFFFFF", border: "#D1D5DB" },
  { name: "yellow", hex: "#FFD700", border: "#FFD700" },
  { name: "orange", hex: "#FF8C00", border: "#FF8C00" },
  { name: "pink", hex: "#FF69B4", border: "#FF69B4" },
  { name: "red", hex: "#DC143C", border: "#DC143C" },
  { name: "purple", hex: "#8B008B", border: "#8B008B" },
  { name: "blue", hex: "#4169E1", border: "#4169E1" },
  { name: "green", hex: "#228B22", border: "#228B22" },
];

interface FlowerColorPickerProps {
  selectedColors: string[];
  colorCounts: Record<string, number>;
  onToggle: (color: string) => void;
}

export default function FlowerColorPicker({
  selectedColors,
  colorCounts,
  onToggle,
}: FlowerColorPickerProps) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-ui font-semibold text-text-primary mb-3">Flower Color</h3>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Flower color filter">
        {COLORS.map((color) => {
          const isSelected = selectedColors.includes(color.name);
          const count = colorCounts[color.name] || 0;
          return (
            <button
              key={color.name}
              onClick={() => onToggle(color.name)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                isSelected
                  ? "bg-forest/10 ring-2 ring-forest"
                  : "hover:bg-cream-dark"
              }`}
              aria-pressed={isSelected}
              aria-label={`${color.name} — ${count} species`}
            >
              <span
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 shadow-sm transition-transform duration-200"
                style={{
                  backgroundColor: color.hex,
                  borderColor: isSelected ? "#2D5F2D" : color.border,
                  transform: isSelected ? "scale(1.1)" : "scale(1)",
                }}
              />
              <span className="text-xs font-ui text-text-secondary capitalize">{color.name}</span>
              <span className="text-xs font-ui text-text-muted">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
