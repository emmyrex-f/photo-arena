import { useMemo } from "react";
import { Instagram } from "lucide-react";
import { distinctImageAlt } from "../../lib/imageAlt";
import { fetchGallery, mediaUrl } from "../../lib/publicApi";
import { Reveal, Stagger, StaggerItem } from "../../lib/motion";
import { instagramHandleFromUrl, useJsonSetting, useSiteInfo } from "../../lib/settings";
import { site } from "../../lib/site";
import { usePublicData } from "../../lib/usePublicData";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

type IgItem = { image: string; href?: string; alt?: string };

export function InstagramStrip() {
  const { instagram } = useSiteInfo();
  const configured = useJsonSetting<IgItem[]>("instagram.items", []);
  const { data: gallery } = usePublicData(() => fetchGallery(), []);

  const tiles = useMemo(() => {
    if (configured.length > 0) {
      return configured.slice(0, 6).map((item, index) => ({
        ...item,
        alt: distinctImageAlt(item.alt ?? "", String(index), configured.slice(0, 6).map((row, i) => ({
          id: String(i),
          alt: row.alt ?? "",
        }))),
      }));
    }
    const photos = (gallery ?? []).slice(0, 6);
    return photos.map((image) => ({
      image: mediaUrl(image.thumbUrl || image.url),
      href: instagram || undefined,
      alt: distinctImageAlt(image.alt, image.id, photos),
    }));
  }, [configured, gallery, instagram]);

  if (tiles.length === 0) return null;

  return (
    <Section>
      <Container>
        <Reveal className="mb-stack-xl flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Instagram</Eyebrow>
            <Heading as="h2" className="mt-stack-sm">From the feed</Heading>
          </div>
          {instagram ? (
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-hover"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
              {instagramHandleFromUrl(instagram, site.instagramHandle)}
            </a>
          ) : null}
        </Reveal>
        <Stagger className="grid grid-cols-2 gap-grid-tight sm:grid-cols-3 sm:gap-control md:gap-stack-sm">
          {tiles.map((tile, index) => {
            const alt = tile.alt?.trim() || "";
            const label = alt
              ? `${alt} (opens Instagram)`
              : "Photo Arena on Instagram";
            const inner = (
              <img
                src={tile.image}
                alt={tile.href ? "" : alt || "Photograph at Photo Arena"}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover object-top transition duration-500 hover:opacity-90"
              />
            );
            return (
              <StaggerItem key={`${tile.image}-${index}`}>
                {tile.href ? (
                  <a
                    href={tile.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden"
                    aria-label={label}
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="overflow-hidden">{inner}</div>
                )}
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </Section>
  );
}
