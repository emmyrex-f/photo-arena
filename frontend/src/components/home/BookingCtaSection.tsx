import { ArrowRight } from "lucide-react";
import { Reveal } from "../../lib/motion";
import { useSetting } from "../../lib/settings";
import { site } from "../../lib/site";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

export function BookingCtaSection() {
  const heading = useSetting("cta.heading", site.cta.heading);
  const savedBody = useSetting("cta.body", site.cta.body);
  const discountPercent = useSetting("policies.onlineDiscountPercent");
  const standardBody = savedBody.replace(
    /^Reserve a studio session online and receive \d+(?:\.\d+)?% off\.(?= Walk-ins are welcome Monday–Saturday 8:00 AM – 6:00 PM and Sunday 12:00 PM – 6:00 PM\.$)/,
    "Reserve a studio session online.",
  );
  const body = standardBody === site.cta.body && Number(discountPercent) > 0
    ? standardBody.replace("Reserve a studio session online.", `Reserve a studio session online and receive ${discountPercent}% off.`)
    : standardBody;
  const buttonLabel = useSetting("cta.buttonLabel", site.cta.buttonLabel);
  const buttonHref = useSetting("cta.buttonHref", site.cta.buttonHref);

  return (
    <Section className="tone-accent relative overflow-hidden py-16 sm:py-20">
      <Container className="max-w-3xl text-center">
        <Reveal>
          <Heading className="text-white drop-shadow-xs">{heading}</Heading>
          <p className="mx-auto mt-stack max-w-xl text-stone-200/95 leading-relaxed text-sm sm:text-base">
            {body}
          </p>
          <div className="mt-stack-lg flex justify-center">
            <Button
              to={buttonHref}
              className="!bg-white !text-stone-950 hover:!bg-stone-50 border-2 !border-white shadow-2xl hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 px-9 py-4 text-base font-bold tracking-wider rounded-full group ring-4 ring-white/20"
            >
              <span>{buttonLabel}</span>
              <ArrowRight className="h-4 w-4 text-stone-900 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
