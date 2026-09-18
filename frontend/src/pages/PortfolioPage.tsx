import { useMemo } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { PortfolioGrid } from "../components/portfolio/PortfolioGrid";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import type { PortfolioImage } from "../data/portfolio.generated";
import { distinctImageAlt } from "../lib/imageAlt";
import { fetchGallery, mediaUrl } from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { usePublicData } from "../lib/usePublicData";

export function PortfolioPage() {
  const { data, loading } = usePublicData(() => fetchGallery(), []);

  const images: PortfolioImage[] = useMemo(
    () => {
      const source = data ?? [];
      return source.map((image) => ({
        id: image.id,
        src: mediaUrl(image.thumbUrl || image.url),
        alt: distinctImageAlt(image.alt, image.id, source),
        category: image.category,
        featured: image.featured,
      }));
    },
    [data],
  );

  return (
    <>
      <Seo
        title="Portfolio"
        description="Photographs from Photo Arena sessions in Port Harcourt."
        path="/portfolio"
      />
      <PageHeader
        eyebrow="Portfolio"
        title="The work"
        description="Photographs from Photo Arena sessions. Select an image to view it full screen."
      />
      <Section>
        <Container>
          {loading && images.length === 0 ? (
            <p className="text-text-secondary">Loading gallery…</p>
          ) : (
            <PortfolioGrid images={images} showFilters />
          )}
        </Container>
      </Section>
    </>
  );
}
