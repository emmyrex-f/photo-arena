import { aboutStudioImage } from "../../data/serviceMedia";
import { useSiteInfo } from "../../lib/settings";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

/** Short About on the home page — existing studio copy only, no invented claims. */
export function HomeAboutSection() {
  const info = useSiteInfo();

  return (
    <Section>
      <Container className="grid items-center gap-grid-lg lg:grid-cols-2">
        <div>
          <Eyebrow>About</Eyebrow>
          <Heading>A walk-in studio in Port Harcourt</Heading>
          <p className="mt-stack max-w-xl leading-relaxed text-text-secondary">{info.tagline}</p>
          <p className="mt-stack-sm max-w-xl leading-relaxed text-text-secondary">
            Monday–Saturday {info.hoursWeekday}. Sunday {info.hoursSunday}. {info.address}.
          </p>
          <div className="mt-stack-lg flex flex-wrap gap-stack-sm">
            <Button to="/about" variant="secondary">
              About the studio
            </Button>
            <Button to="/faq" variant="ghost">
              Questions
            </Button>
          </div>
        </div>
        <img
          src={aboutStudioImage}
          alt="Inside the Photo Arena studio space"
          className="w-full object-cover object-center"
        />
      </Container>
    </Section>
  );
}
