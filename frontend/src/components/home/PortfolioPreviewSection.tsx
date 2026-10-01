import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PortfolioImage } from "../../data/portfolio.generated";
import { distinctImageAlt } from "../../lib/imageAlt";
import { fetchGallery, mediaUrl } from "../../lib/publicApi";
import { Reveal } from "../../lib/motion";
import { usePublicData } from "../../lib/usePublicData";
import { Lightbox } from "../portfolio/Lightbox";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

/** Fisher-Yates shuffle for randomized layout on page load */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function PortfolioPreviewSection() {
  const { data } = usePublicData(() => fetchGallery(), []);

  // Strict synchronization: all images marked as featured by admin are shown (no artificial limit)
  const featuredImages = useMemo(
    () => (data ?? []).filter((image) => image.featured),
    [data],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Dynamic layout order generated fresh per page reload / device session
  const [displayImages, setDisplayImages] = useState<PortfolioImage[]>([]);

  useEffect(() => {
    if (featuredImages.length > 0) {
      const formatted: PortfolioImage[] = featuredImages.map((image) => ({
        id: image.id,
        src: mediaUrl(image.url || image.thumbUrl),
        alt: distinctImageAlt(image.alt, image.id, featuredImages),
        category: image.category,
        featured: image.featured,
      }));
      setDisplayImages(shuffleArray(formatted));
    } else {
      setDisplayImages([]);
    }
  }, [featuredImages]);

  // If there are no featured images (or still loading), remove/hide the entire section
  if (featuredImages.length === 0) {
    return null;
  }

  return (
    <Section className="bg-gradient-to-b from-bg to-surface">
      <Container>
        <Reveal className="mb-stack-xl flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <Eyebrow>Gallery</Eyebrow>
            <Heading className="mt-stack-sm">Portfolio Preview</Heading>
            <p className="mt-stack text-text-secondary">
              A short edit from recent sessions. The full archive lives on the portfolio page.
            </p>
          </div>
          <Button to="/portfolio" variant="secondary">
            View Full Portfolio
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Reveal>

        {/* True Multi-Column Masonry (Waterfall layout with max 3 columns) */}
        <div className="columns-1 sm:columns-2 md:columns-3 gap-5 [column-fill:balance]">
          {displayImages.map((image, index) => (
            <div
              key={image.id}
              className="break-inside-avoid mb-5 overflow-hidden rounded-2xl group shadow-sm hover:shadow-md transition-all duration-300 bg-surface/50"
            >
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group block w-full overflow-hidden text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer"
                aria-label={`View ${image.alt}`}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.03] block"
                />
              </button>
            </div>
          ))}
        </div>
      </Container>

      {activeIndex !== null && displayImages[activeIndex] ? (
        <Lightbox
          images={displayImages}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </Section>
  );
}
