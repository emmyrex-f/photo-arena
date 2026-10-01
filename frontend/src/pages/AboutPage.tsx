import { Lightbulb, MapPin, Smartphone, Sparkles, Users, Footprints } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { ABOUT_PAGE_SLIDES } from "../data/headerStills";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Heading } from "../components/ui/Heading";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";
import { aboutStudioImage } from "../data/serviceMedia";
import { usePolicyValues } from "../lib/policies";
import { useSiteInfo } from "../lib/settings";

const whyCards: {
  icon: typeof Lightbulb;
  title: string;
  body: string;
  hours?: boolean;
  address?: boolean;
}[] = [
  {
    icon: Lightbulb,
    title: "Professional Lighting",
    body: "Our studio is equipped with professional-grade lighting setups designed to flatter every skin tone and style — no dark, unflattering shots here.",
  },
  {
    icon: Footprints,
    title: "Walk-In Friendly",
    hours: true,
    body: "No appointment needed. Come as you are, any day we are open.",
  },
  {
    icon: Users,
    title: "Diverse Experiences",
    body: "From corporate headshots to birthday blowouts, kids portraits to passport photos — we cover every milestone and need under one roof.",
  },
  {
    icon: Smartphone,
    title: "Mobile-Friendly Arena",
    body: "Prefer your own phone? We have a personal arena space designed for mobile phone shoots — just bring yourself and your creativity.",
  },
  {
    icon: Sparkles,
    title: "Premium Experience",
    body: "From the moment you walk in, you'll feel the difference. Our studio is crafted for comfort, creativity, and exceptional results every time.",
  },
  {
    icon: MapPin,
    title: "Prime Location",
    address: true,
    body: "Conveniently located on Peter Odili Road, Port Harcourt — easy to find, easy to reach, and worth every drive.",
  },
];

export function AboutPage() {
  const info = useSiteInfo();
  const policies = usePolicyValues();

  return (
    <>
      <Seo
        title="About"
        description="Photo Arena is a walk-in portrait studio in Port Harcourt — lighting, sets, and calm direction without the wait."
        path="/about"
      />
      <PageHeader
        eyebrow="About"
        title="A studio built for a world-class photo, without the wait."
        description="Photo Arena is a walk-in portrait studio in Port Harcourt. The room, the lights, and the sets are ready. You bring the occasion."
        slides={ABOUT_PAGE_SLIDES}
        slidesSettingKey="site.header.about"
      />
      <Section>
        <Container className="grid gap-grid-lg lg:grid-cols-2">
          <div>
            <Heading as="h2">The studio</Heading>
            <p className="mt-stack leading-relaxed text-text-secondary">
              Photo Arena sits just off Peter Odili Road. It was built so people do not have to wait
              weeks for a considered portrait — birthdays, work, family, or a quiet pre-wedding
              session.
            </p>
            <p className="mt-stack-sm leading-relaxed text-text-secondary">
              We provide the lights, backdrops, and direction. You provide the reason to be
              photographed.
            </p>
            <img
              src={aboutStudioImage}
              alt="Inside the Photo Arena studio space"
              className="mt-stack-lg w-full object-cover"
            />
          </div>
          <div className="grid gap-stack-lg sm:grid-cols-2">
            {whyCards.map((item) => (
              <article key={item.title}>
                <item.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-eyebrow font-display text-xl">{item.title}</h3>
                <p className="mt-label text-sm leading-relaxed text-text-secondary">
                  {item.body}
                  {item.hours
                    ? ` Monday–Saturday ${info.hoursWeekday}. Sunday ${info.hoursSunday}.`
                    : null}
                  {item.address ? ` ${info.address}.` : null}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </Section>
      <Section className="bg-surface/30">
        <Container className="text-center">
          <Heading as="h2">Come experience the Arena</Heading>
          <p className="mx-auto mt-stack max-w-lg text-text-secondary">
            Open every day. Sunday from midday ({info.hoursSunday}). Monday–Saturday {info.hoursWeekday}.
            Book online for {policies.onlineDiscountPercent}% off, or walk in.
          </p>
          <div className="mt-stack-lg">
            <Button to="/book">Book Your Session</Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
