import { HOME_ABOUT_EXTRA_IMAGES } from "../../data/headerStills";
import { cn } from "../../lib/cn";
import { useSetting, useSiteInfo } from "../../lib/settings";
import { site } from "../../lib/site";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";
import { SlideDots, useImageListSetting, useSlideshow } from "../ui/Slideshow";

/** Short About on the home page — copy from settings (`about.*`), no invented claims. */
export function HomeAboutSection() {
  const info = useSiteInfo();
  const headline = useSetting("about.headline", site.about.headline);
  const body = useSetting("about.body", site.about.body);
  const imageUrl = useSetting("about.imageUrl", site.about.imageUrl);
  const ctaLabel = useSetting("about.ctaLabel", site.about.ctaLabel);
  const ctaHref = useSetting("about.ctaHref", site.about.ctaHref);
  const carousel = useImageListSetting("about.images");
  const images = carousel.length ? carousel : [imageUrl, ...HOME_ABOUT_EXTRA_IMAGES];
  const [active, setActive] = useSlideshow(images.length);

  return (
    <Section className="bg-gradient-to-b from-bg to-surface">
      <Container className="grid items-center gap-grid-lg lg:grid-cols-2">
        <div>
          <Eyebrow>About Us</Eyebrow>
          <Heading className="mt-stack-sm">{headline}</Heading>
          <p className="mt-stack max-w-xl leading-relaxed text-text-secondary">{body}</p>
          <p className="mt-stack-sm max-w-xl leading-relaxed text-text-secondary">
            Monday–Saturday {info.hoursWeekday}. Sunday {info.hoursSunday}. {info.address}.
          </p>
          <div className="mt-stack-lg flex flex-wrap gap-stack-sm">
            <Button to={ctaHref}>{ctaLabel}</Button>
            <Button to="/faq" variant="ghost">
              Questions
            </Button>
          </div>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-soft">
          {images.map((src, i) => (
            <img
              key={`${i}-${src}`}
              src={src}
              alt={i === active ? "Inside the Photo Arena studio space" : ""}
              loading={i === 0 ? "eager" : "lazy"}
              className={cn(
                "absolute inset-0 size-full object-cover object-center transition-opacity duration-1000 ease-in-out",
                i === active ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
          <SlideDots
            count={images.length}
            active={active}
            onPick={setActive}
            className="absolute bottom-2 right-2"
          />
        </div>
      </Container>
    </Section>
  );
}
