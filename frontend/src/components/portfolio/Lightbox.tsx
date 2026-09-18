import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PortfolioImage } from "../../data/portfolio.generated";

type LightboxProps = {
  images: PortfolioImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const image = images[index];

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusables(): HTMLElement[] {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
      if (event.key === "Tab") {
        const nodes = focusables();
        if (nodes.length === 0) return;
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [index, images.length, onClose, onIndexChange]);

  if (!image) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Photograph viewer"
      aria-describedby="lightbox-caption"
    >
      <div
        className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-md"
        onClick={onClose}
      />

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center text-text hover:text-accent"
      >
        <X aria-hidden="true" />
        <span className="sr-only">Close photograph viewer</span>
      </button>

      <button
        type="button"
        className="absolute left-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center text-text hover:text-accent"
        onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
      >
        <ChevronLeft aria-hidden="true" />
        <span className="sr-only">Previous photograph</span>
      </button>

      <button
        type="button"
        className="absolute right-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center text-text hover:text-accent md:right-16"
        onClick={() => onIndexChange((index + 1) % images.length)}
      >
        <ChevronRight aria-hidden="true" />
        <span className="sr-only">Next photograph</span>
      </button>

        <figure
        className="relative z-10 mx-4 max-h-[88vh] max-w-5xl min-w-0"
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          if (start == null || end == null) return;
          const delta = end - start;
          if (delta > 40) onIndexChange((index - 1 + images.length) % images.length);
          if (delta < -40) onIndexChange((index + 1) % images.length);
        }}
      >
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-[80vh] w-auto max-w-full object-contain shadow-2xl"
        />
        <figcaption id="lightbox-caption" className="mt-4 text-center text-sm text-text-secondary" aria-live="polite">
          {image.alt}
          <span className="mx-2 text-text-muted">·</span>
          {index + 1} of {images.length}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
