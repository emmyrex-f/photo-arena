import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { PortfolioImage } from "../../data/portfolio.generated";
import { distinctImageAlt } from "../../lib/imageAlt";
import { fetchGallery, mediaUrl, type GalleryImage } from "../../lib/publicApi";
import { Reveal, Stagger, StaggerItem } from "../../lib/motion";
import { usePublicData } from "../../lib/usePublicData";
import { Lightbox } from "../portfolio/Lightbox";
import { Button } from "../ui/Button";
import { CameraSpinner } from "../ui/CameraSpinner";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

/** Curate 8 images: prefer featured, then fill — balanced editorial grid (not masonry). */
function curateEight(images: GalleryImage[]): GalleryImage[] {
  const featured = images.filter((image) => image.featured);
  const rest = images.filter((image) => !image.featured);
  const pool = [...featured, ...rest];
  return pool.slice(0, 8);
}

export function PortfolioPreviewSection() {
  const { data, loading } = usePublicData(() => fetchGallery(), []);
  const curated = useMemo(() => curateEight(data ?? []), [data]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const lightboxImages: PortfolioImage[] = useMemo(
    () =>
      curated.map((image) => ({
        id: image.id,
        src: mediaUrl(image.url || image.thumbUrl),
        alt: distinctImageAlt(image.alt, image.id, curated),
        category: image.category,
        featured: image.featured,
      })),
    [curated],
  );

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

        {loading && curated.length === 0 ? (
          <CameraSpinner label="Loading gallery" caption="Loading gallery…" />
        ) : curated.length === 0 ? (
          <p className="text-text-secondary">
            Gallery images will appear here once they are published.
          </p>
        ) : (
          <Stagger className="grid grid-cols-2 gap-stack-sm md:grid-cols-4">
            {lightboxImages.map((image, index) => (
              <StaggerItem
                key={image.id}
                className={
                  index === 0 || index === 5
                    ? "col-span-2 row-span-2 aspect-square overflow-hidden rounded-2xl md:aspect-auto md:min-h-[22rem]"
                    : "aspect-[4/5] overflow-hidden rounded-2xl"
                }
              >
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="group block h-full w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`View ${image.alt}`}
                >
                  <img
                    src={mediaUrl(curated[index]!.thumbUrl || curated[index]!.url)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.03]"
                  />
                </button>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Container>

      {activeIndex !== null ? (
        <Lightbox
          images={lightboxImages}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </Section>
  );
}
