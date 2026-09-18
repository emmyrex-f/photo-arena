const filters = [
  { id: "all", label: "All" },
  { id: "birthdays", label: "Birthdays" },
  { id: "portraits", label: "Portraits" },
  { id: "corporate", label: "Corporate" },
  { id: "kids", label: "Kids" },
] as const;

export type FilterId = (typeof filters)[number]["id"];

export function PortfolioFilter({
  value,
  onChange,
}: {
  value: FilterId;
  onChange: (value: FilterId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-grid-tight" role="group" aria-label="Portfolio categories">
      {filters.map((filter) => {
        const selected = value === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={selected}
            className={`min-h-11 rounded-full px-4 text-sm tracking-wide transition-colors ${
              selected
                ? "bg-accent text-text-on-accent"
                : "border border-elevated text-text-secondary hover:text-text"
            }`}
            onClick={() => onChange(filter.id)}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
