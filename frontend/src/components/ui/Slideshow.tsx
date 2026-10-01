import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { useJsonSetting } from "../../lib/settings";

const SLIDE_INTERVAL_MS = 6000;
const NO_URLS: string[] = [];

export function isSafeImageUrl(value: unknown): value is string {
  return typeof value === "string" && (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value));
}

/** CMS setting holding a JSON array of image URLs; [] when unset or invalid. */
export function useImageListSetting(key: string | undefined): string[] {
  const raw = useJsonSetting<unknown>(key ?? "", NO_URLS);
  return Array.isArray(raw) ? raw.filter(isSafeImageUrl) : NO_URLS;
}

/** Auto-advancing index; paused for reduced motion; manual pick restarts the timer. */
export function useSlideshow(count: number) {
  const [raw, setActive] = useState(0);
  const active = count ? raw % count : 0;
  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % count), SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [raw, count]);
  return [active, setActive] as const;
}

export function SlideDots({
  count,
  active,
  onPick,
  className,
}: {
  count: number;
  active: number;
  onPick: (index: number) => void;
  className?: string;
}) {
  if (count < 2) return null;
  return (
    <div className={cn("z-[2] flex", className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Show photo ${i + 1} of ${count}`}
          aria-pressed={i === active}
          onClick={() => onPick(i)}
          className="group flex size-6 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span
            className={cn(
              "block h-2 rounded-full transition-all",
              i === active ? "w-5 bg-accent" : "w-2 bg-white/60 group-hover:bg-white",
            )}
          />
        </button>
      ))}
    </div>
  );
}
