import { useLocation } from "react-router-dom";
import { headerStillForPath, type HeaderStill } from "../../data/headerStills";
import { cn } from "../../lib/cn";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
import { SlideDots, useImageListSetting, useSlideshow } from "../ui/Slideshow";

/** Home keeps its own video hero — no photo banner. */
const NO_PHOTO_PATHS = new Set(["/"]);

export function PageHeader({
  eyebrow,
  title,
  description,
  bordered = true,
  className = "",
  photo = true,
  image,
  objectPosition,
  slides,
  slidesSettingKey,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  bordered?: boolean;
  className?: string;
  /** Photo banner with overlay copy. Off on Home. */
  photo?: boolean;
  /** Explicit still (Services Sony, Portfolio portrait, Book, …). */
  image?: string;
  /** CSS object-position, e.g. "74% 8%". */
  objectPosition?: string;
  /** Crossfading banner photos; wins over `image`. */
  slides?: HeaderStill[];
  /** CMS setting holding a JSON array of image URLs; overrides `slides` when set. */
  slidesSettingKey?: string;
}) {
  const cmsUrls = useImageListSetting(slidesSettingKey);
  if (cmsUrls.length) slides = cmsUrls.map((src) => ({ src, objectPosition: "center 25%" }));
  const { pathname } = useLocation();
  const usePhoto = photo && !NO_PHOTO_PATHS.has(pathname);
  const still = usePhoto ? headerStillForPath(pathname) : null;
  // Explicit `image` wins; empty string means "no photo" (no path fallback).
  const src = !usePhoto
    ? undefined
    : image !== undefined
      ? image || undefined
      : still?.src;
  const position = objectPosition ?? still?.objectPosition ?? "center 24%";
  const frames: HeaderStill[] =
    usePhoto && slides?.length ? slides : src ? [{ src, objectPosition: position }] : [];

  const [active, setActive] = useSlideshow(frames.length);

  if (!frames.length) {
    return (
      <div
        className={cn(
          "bg-gradient-to-b from-surface to-bg py-header-y",
          bordered && "border-b border-elevated",
          className,
        )}
      >
        <Container className="max-w-3xl">
          {eyebrow ? (
            <p className="font-subtitle mb-eyebrow text-xs uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
          ) : null}
          <Heading as="h1">{title}</Heading>
          {description ? (
            <p className="font-body mt-stack max-w-xl text-base leading-relaxed text-text-secondary">
              {description}
            </p>
          ) : null}
        </Container>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full bg-ink",
        "shadow-[0_0_0_100vmax_var(--pa-ink)] [clip-path:inset(0_-100vmax)]",
        className,
      )}
    >
      <div className="relative isolate min-h-[min(48vh,26rem)] w-full overflow-hidden sm:min-h-[min(52vh,30rem)]">
        {frames.map((frame, i) => (
          <img
            key={frame.src}
            src={frame.src}
            alt=""
            decoding="async"
            loading={i === 0 ? "eager" : "lazy"}
            className={cn(
              "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-in-out",
              i === active ? "opacity-100" : "opacity-0",
            )}
            style={{ objectPosition: frame.objectPosition }}
          />
        ))}
        <Container className="relative z-[1] flex min-h-[min(48vh,26rem)] max-w-none flex-col justify-end pb-10 pt-10 sm:min-h-[min(52vh,30rem)] sm:pb-14 sm:pt-12">
          <div className="pa-banner-copy">
            {eyebrow ? (
              <p className="font-subtitle mb-eyebrow text-xs uppercase tracking-[0.2em] text-accent">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl md:text-6xl">
              {title}
            </h1>
            {description ? (
              <p className="font-body mt-stack text-base leading-relaxed text-white/90 sm:text-lg">
                {description}
              </p>
            ) : null}
          </div>
        </Container>
        <SlideDots
          count={frames.length}
          active={active}
          onPick={setActive}
          className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4"
        />
      </div>
    </div>
  );
}
