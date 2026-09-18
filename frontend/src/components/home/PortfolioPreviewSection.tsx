import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { distinctImageAlt } from "../../lib/imageAlt";
import { fetchGallery, mediaUrl, type GalleryImage } from "../../lib/publicApi";
import { Reveal, Stagger, StaggerItem } from "../../lib/motion";
import { usePublicData } from "../../lib/usePublicData";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
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

  return (
    <Section className="tone-dark">
      <Container>
        <Reveal className="mb-stack-xl flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <Heading>Gallery</Heading>
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
          <p className="text-text-secondary">Loading gallery…</p>
        ) : curated.length === 0 ? (
          <p className="text-text-secondary">
            Gallery images will appear here once they are published.
          </p>
        ) : (
          <Stagger className="grid grid-cols-2 gap-grid-tight sm:gap-control md:grid-cols-4 md:gap-stack-sm">
            {curated.map((image, index) => (
              <StaggerItem
                key={image.id}
                className={
                  index === 0 || index === 5
                    ? "col-span-2 row-span-2 aspect-square overflow-hidden md:aspect-auto md:min-h-[22rem]"
                    : "aspect-[4/5] overflow-hidden"
                }
              >
                <img
                  src={mediaUrl(image.thumbUrl || image.url)}
                  alt={distinctImageAlt(image.alt, image.id, curated)}
                  loading="lazy"
                  className="h-full w-full object-cover object-top transition duration-700 hover:scale-[1.03]"
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Container>
    </Section>
  );
}
