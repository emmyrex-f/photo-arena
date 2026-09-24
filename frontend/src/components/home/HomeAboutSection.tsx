import { useSetting, useSiteInfo } from "../../lib/settings";
import { site } from "../../lib/site";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

/** Short About on the home page — copy from settings (`about.*`), no invented claims. */
export function HomeAboutSection() {
  const info = useSiteInfo();
  const headline = useSetting("about.headline", site.about.headline);
  const body = useSetting("about.body", site.about.body);
  const imageUrl = useSetting("about.imageUrl", site.about.imageUrl);
  const ctaLabel = useSetting("about.ctaLabel", site.about.ctaLabel);
  const ctaHref = useSetting("about.ctaHref", site.about.ctaHref);

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
        <img
          src={imageUrl}
          alt="Inside the Photo Arena studio space"
          className="w-full rounded-2xl object-cover object-center shadow-soft"
        />
      </Container>
    </Section>
  );
}
