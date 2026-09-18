import { useEffect, useMemo, useState } from "react";
import type { PortfolioImage } from "../../data/portfolio.generated";
import { Lightbox } from "./Lightbox";
import { PortfolioFilter, type FilterId } from "./PortfolioFilter";

/** Matches backend public gallery filter: hide sub-64px placeholder thumbs. */
const MIN_PUBLIC_PHOTO_EDGE_PX = 64;

export function PortfolioGrid({
  images,
  showFilters = false,
  emptyLabel = "Photographs will appear here once they are added.",
}: {
  images: PortfolioImage[];
  showFilters?: boolean;
  emptyLabel?: string;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(() => new Set());

  const visible = useMemo(() => {
    const pool = filter === "all" ? images : images.filter((image) => image.category === filter);
    return pool.filter((image) => !rejectedIds.has(image.id));
  }, [filter, images, rejectedIds]);

  useEffect(() => {
    if (activeIndex !== null && activeIndex >= visible.length) setActiveIndex(null);
  }, [activeIndex, visible.length]);

  function rejectIfPlaceholder(id: string, img: HTMLImageElement) {
    if (img.naturalWidth < MIN_PUBLIC_PHOTO_EDGE_PX || img.naturalHeight < MIN_PUBLIC_PHOTO_EDGE_PX) {
      setRejectedIds((previous) => {
        if (previous.has(id)) return previous;
        const next = new Set(previous);
        next.add(id);
        return next;
      });
    }
  }

  return (
    <div>
      {showFilters ? (
        <div className="mb-stack-lg">
          <PortfolioFilter value={filter} onChange={setFilter} />
        </div>
      ) : null}

          {visible.length === 0 ? (
            <p className="text-text-secondary">
              {images.length === 0
                ? emptyLabel
                : "No photographs in this category yet."}
            </p>
          ) : (
        <div className="masonry">
          {visible.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className="masonry-item group block w-full text-left"
              onClick={() => setActiveIndex(index)}
              aria-label={`View ${image.alt}`}
            >
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                onLoad={(event) => rejectIfPlaceholder(image.id, event.currentTarget)}
                onError={() =>
                  setRejectedIds((previous) => {
                    if (previous.has(image.id)) return previous;
                    const next = new Set(previous);
                    next.add(image.id);
                    return next;
                  })
                }
                className="h-auto w-full object-contain transition duration-500 group-hover:opacity-90"
              />
            </button>
          ))}
        </div>
      )}

      {activeIndex !== null ? (
        <Lightbox
          images={visible}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
