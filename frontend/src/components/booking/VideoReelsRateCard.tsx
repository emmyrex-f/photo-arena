import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { readServiceVideoContent } from "../../data/serviceVideoContent";
import { formatDuration } from "../../lib/datetime";
import {
  formatNairaFromKobo,
  sortPublicPackages,
  type PublicService,
} from "../../lib/publicApi";
import { useSetting } from "../../lib/settings";

interface VideoReelsRateCardProps {
  service: PublicService;
  selectedPackageId?: string;
  onSelectPackage?: (pkgId: string) => void;
  onContinue?: () => void;
  mode?: "book" | "display";
}

export function VideoReelsRateCard({
  service,
  selectedPackageId,
  onSelectPackage,
  onContinue,
  mode = "book",
}: VideoReelsRateCardProps) {
  const navigate = useNavigate();
  const content = readServiceVideoContent(useSetting("services.video", ""));
  const packages = sortPublicPackages(service.packages);
  const selectedPkg = packages.find((p) => p.id === selectedPackageId) ?? null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && selectedPkg && !dialog.open) dialog.showModal();
    else if ((!dialogOpen || !selectedPkg) && dialog.open) dialog.close();
  }, [dialogOpen, selectedPkg]);

  return (
    <section aria-labelledby="video-reels-rate-card-title" className="min-w-0">
      <div>
        <div className="mb-5 sm:mb-6">
          <p className="font-subtitle mb-1 text-xs uppercase tracking-[0.18em] text-accent">
            {content.eyebrow}
          </p>
          <h2
            id="video-reels-rate-card-title"
            className="font-display text-2xl sm:text-3xl text-text"
          >
            {content.title}
          </h2>
          {content.paragraphs.length ? (
            <div className="mt-3 max-w-2xl space-y-2 text-sm leading-relaxed text-text-secondary">
              {content.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : null}
        </div>

        {/* 4 Tier Rows */}
        <div className="space-y-4">
          {packages.map((pkg) => {
            const specs = [formatDuration(pkg.durationMinutes), pkg.includes].filter(Boolean);

            const isSelected = pkg.id === selectedPackageId;
            const online = pkg.onlinePriceKobo;
            const discount = pkg.discountPercent;

            return (
              <div
                key={pkg.id}
                onClick={() => {
                  if (mode === "book" && onSelectPackage) {
                    onSelectPackage(pkg.id);
                    setDialogOpen(true);
                  } else if (mode === "display") {
                    navigate(`/book?package=${encodeURIComponent(pkg.id)}`);
                  }
                }}
                className={`group flex cursor-pointer flex-col items-stretch overflow-hidden rounded-lg border bg-surface transition-all sm:flex-row ${
                  isSelected
                    ? "border-accent shadow-md ring-2 ring-accent"
                    : "border-border hover:border-accent hover:shadow-sm"
                }`}
              >
                <div className="flex shrink-0 items-center justify-center border-b border-accent bg-accent px-6 py-4 font-subtitle text-sm font-semibold uppercase tracking-widest text-text-on-accent sm:w-40 sm:border-b-0 sm:border-r sm:text-base">
                  {pkg.name}
                </div>

                {/* Center Details */}
                <div className="p-4 sm:py-4 sm:px-6 flex-1 flex flex-col justify-center space-y-1.5 font-body text-sm text-text">
                  {specs.map((spec, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-center gap-2"
                    >
                      <span className="text-base leading-none text-accent">•</span>
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>

                {/* Right Black Price Box */}
                <div className="flex shrink-0 flex-col items-center justify-center border-t border-ink bg-ink px-6 py-4 text-center text-sage sm:w-52 sm:border-l sm:border-t-0">
                  <span className="font-display text-xl font-bold text-accent sm:text-2xl">
                    {formatNairaFromKobo(pkg.priceKobo)}
                  </span>
                  {online != null && online !== pkg.priceKobo ? (
                    <span className="mt-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-800/40">
                      {formatNairaFromKobo(online)} online ({discount}% off)
                    </span>
                  ) : null}

                  {mode === "display" ? (
                    <Button
                      to={`/book?package=${encodeURIComponent(pkg.id)}`}
                      className="mt-2.5 w-full text-xs py-1.5"
                    >
                      Book {pkg.name}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {mode === "book" ? (
          <dialog
            ref={dialogRef}
            aria-labelledby="video-reels-selected-title"
            onClose={() => setDialogOpen(false)}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDialogOpen(false);
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-bg p-0 text-text shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            {selectedPkg ? (
              <div className="relative p-6">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  aria-label="Close"
                  className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-elevated hover:text-text"
                >
                  <X className="size-4" aria-hidden />
                </button>
                <p className="font-subtitle mb-1 text-xs uppercase tracking-[0.18em] text-accent">
                  Selected package
                </p>
                <h3 id="video-reels-selected-title" className="font-display pr-8 text-2xl text-text">
                  {selectedPkg.name} ({formatDuration(selectedPkg.durationMinutes)})
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{selectedPkg.includes}</p>
                {onContinue ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setDialogOpen(false);
                      onContinue();
                    }}
                    className="mt-6 w-full"
                  >
                    Continue with {selectedPkg.name}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </dialog>
        ) : null}

        {/* Delivery & Add-on Notes */}
        {content.notes.length ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-5 font-subtitle text-xs uppercase tracking-wide text-text-secondary">
            {content.notes.map((note) => (
              <p key={note}>◾ {note}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
