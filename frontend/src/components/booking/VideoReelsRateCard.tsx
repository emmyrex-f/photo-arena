import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { formatDuration } from "../../lib/datetime";
import {
  formatNairaFromKobo,
  sortPublicPackages,
  type PublicService,
} from "../../lib/publicApi";

interface VideoReelsRateCardProps {
  service: PublicService;
  selectedPackageId?: string;
  onSelectPackage?: (pkgId: string) => void;
  onContinue?: () => void;
  mode?: "book" | "display";
}

const TIER_SPECS: Record<
  string,
  { name: string; specs: string[]; defaultPriceKobo: number }
> = {
  "video-reels-basic": {
    name: "1 OUTFIT",
    specs: ["1 outfit", "Shoot duration: 30 min", "1 outfit · 1 4K reel (15–30 secs)"],
    defaultPriceKobo: 50_000_00,
  },
  "video-reels-standard": {
    name: "2 OUTFITS",
    specs: ["2 outfits", "Shoot duration: 1 hr", "2 outfits · 2 4K reels (30 sec–1 min each)"],
    defaultPriceKobo: 90_000_00,
  },
  "video-reels-premium": {
    name: "3 OUTFITS",
    specs: ["3 outfits", "Shoot duration: 2 hrs", "3 outfits · 3 4K reels"],
    defaultPriceKobo: 140_000_00,
  },
  "video-reels-deluxe": {
    name: "4 OUTFITS",
    specs: [
      "4 outfits",
      "Shoot duration: 2 hr 30 min",
      "4 outfits · 4 4K reels + 1 combo reel of all 4 outfits",
    ],
    defaultPriceKobo: 200_000_00,
  },
};

export function VideoReelsRateCard({
  service,
  selectedPackageId,
  onSelectPackage,
  onContinue,
  mode = "book",
}: VideoReelsRateCardProps) {
  const navigate = useNavigate();
  const packages = sortPublicPackages(service.packages);
  const selectedPkg = packages.find((p) => p.id === selectedPackageId) ?? null;

  return (
    <section aria-labelledby="video-reels-rate-card-title" className="min-w-0">
      <div>
        <div className="mb-5 sm:mb-6">
          <p className="font-subtitle mb-1 text-xs uppercase tracking-[0.18em] text-accent">
            Video content
          </p>
          <h2
            id="video-reels-rate-card-title"
            className="font-display text-2xl sm:text-3xl text-text"
          >
            Studio Video Content Sessions
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            {mode === "book"
              ? "Select a package tier below to book your 4K video reel session"
              : "High-end cinematic video reels tailored for influencers, brands, and creatives"}
          </p>
        </div>

        {/* 4 Tier Rows */}
        <div className="space-y-4">
          {packages.map((pkg) => {
            const byOutfit =
              pkg.outfitCount === 1
                ? TIER_SPECS["video-reels-basic"]
                : pkg.outfitCount === 2
                  ? TIER_SPECS["video-reels-standard"]
                  : pkg.outfitCount === 3
                    ? TIER_SPECS["video-reels-premium"]
                    : pkg.outfitCount === 4
                      ? TIER_SPECS["video-reels-deluxe"]
                      : null;

            const tierInfo = TIER_SPECS[pkg.id] ?? byOutfit ?? {
              name:
                pkg.outfitCount != null
                  ? `${pkg.outfitCount} OUTFIT${pkg.outfitCount > 1 ? "S" : ""}`
                  : pkg.name.toUpperCase(),
              specs: [
                pkg.outfitCount ? `${pkg.outfitCount} outfit${pkg.outfitCount > 1 ? "s" : ""}` : "",
                `Shoot duration: ${formatDuration(pkg.durationMinutes)}`,
                pkg.includes || "4K reel",
              ].filter(Boolean),
              defaultPriceKobo: pkg.priceKobo,
            };

            const isSelected = pkg.id === selectedPackageId;
            const online = pkg.onlinePriceKobo;
            const discount = pkg.discountPercent;

            return (
              <div
                key={pkg.id}
                onClick={() => {
                  if (mode === "book" && onSelectPackage) {
                    onSelectPackage(pkg.id);
                  } else if (mode === "display") {
                    navigate(`/book?package=${encodeURIComponent(pkg.id)}`);
                  }
                }}
                className={`group rounded-lg border transition-all flex flex-col sm:flex-row items-stretch overflow-hidden cursor-pointer ${isSelected
                    ? "border-[#df9e18] ring-2 ring-[#df9e18] shadow-md bg-white dark:bg-stone-800"
                    : "border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 hover:border-[#df9e18] hover:shadow-sm"
                  }`}
              >
                {/* Left Gold Block with Tier Name */}
                <div className="bg-[#df9e18] text-white font-subtitle font-semibold text-sm sm:text-base px-6 py-4 sm:w-40 flex items-center justify-center shrink-0 uppercase tracking-widest border-b sm:border-b-0 sm:border-r border-[#c78b10]">
                  {tierInfo.name}
                </div>

                {/* Center Details */}
                <div className="p-4 sm:py-4 sm:px-6 flex-1 flex flex-col justify-center space-y-1.5 font-body text-sm text-text">
                  {tierInfo.specs.map((spec, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-center gap-2"
                    >
                      <span className="text-[#df9e18] text-base leading-none">•</span>
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>

                {/* Right Black Price Box */}
                <div className="bg-[#111111] text-white px-6 py-4 sm:w-52 flex flex-col items-center justify-center shrink-0 text-center border-t sm:border-t-0 sm:border-l border-stone-800">
                  <span className="font-display text-xl sm:text-2xl font-bold text-[#df9e18]">
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
                      Book {tierInfo.name}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Continue Action for Selected Package in Booking Mode */}
        {mode === "book" && selectedPkg ? (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-accent/15 border border-accent/40 shadow-xs">
            <div>
              <p className="font-display text-base font-semibold text-text">
                Selected: {selectedPkg.name} ({formatDuration(selectedPkg.durationMinutes)})
              </p>
              <p className="text-xs text-text-secondary">{selectedPkg.includes}</p>
            </div>
            {onContinue ? (
              <Button
                type="button"
                onClick={onContinue}
                className="w-full sm:w-auto shrink-0"
              >
                Continue with {selectedPkg.name}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Delivery & Add-on Notes */}
        <div className="mt-8 pt-5 border-t border-border/40 text-xs text-text-secondary font-subtitle uppercase tracking-wide flex flex-wrap items-center justify-between gap-2">
          <p>◾ Delivery: within 72 hours</p>
          <p>◾ 24-hour delivery: express fee 50% of bill</p>
        </div>
      </div>
    </section>
  );
}
