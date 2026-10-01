import { useMemo } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { PortfolioGrid } from "../components/portfolio/PortfolioGrid";
import { Container } from "../components/ui/Container";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Section } from "../components/ui/Section";
import { PORTFOLIO_PAGE_SLIDES } from "../data/headerStills";
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
        slides={PORTFOLIO_PAGE_SLIDES}
        slidesSettingKey="site.header.portfolio"
      />
      <Section>
        <Container>
          {loading && images.length === 0 ? (
            <CameraSpinner label="Loading gallery" caption="Loading gallery…" />
          ) : (
            <PortfolioGrid images={images} showFilters />
          )}
        </Container>
      </Section>
    </>
  );
}
