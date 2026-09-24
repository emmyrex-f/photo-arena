import { useLocation } from "react-router-dom";
import { headerStillForPath } from "../../data/headerStills";
import { cn } from "../../lib/cn";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";

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
}) {
  const { pathname } = useLocation();
  const usePhoto = photo && !NO_PHOTO_PATHS.has(pathname);
  const still = usePhoto ? headerStillForPath(pathname) : null;
  const src = usePhoto ? image ?? still?.src : undefined;
  const position = objectPosition ?? still?.objectPosition ?? "center 24%";

  if (!src) {
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
        <img
          src={src}
          alt=""
          decoding="async"
          className="pointer-events-none absolute inset-0 size-full object-cover"
          style={{ objectPosition: position }}
        />
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
      </div>
    </div>
  );
}
