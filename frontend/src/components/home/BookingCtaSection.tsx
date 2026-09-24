import { Reveal } from "../../lib/motion";
import { useSetting } from "../../lib/settings";
import { site } from "../../lib/site";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

export function BookingCtaSection() {
  const heading = useSetting("cta.heading", site.cta.heading);
  const body = useSetting("cta.body", site.cta.body);
  const buttonLabel = useSetting("cta.buttonLabel", site.cta.buttonLabel);
  const buttonHref = useSetting("cta.buttonHref", site.cta.buttonHref);

  return (
    <Section className="tone-accent relative overflow-hidden">
      <Container className="max-w-3xl text-center">
        <Reveal>
          <Heading>{heading}</Heading>
          <p className="mx-auto mt-stack max-w-xl text-text-secondary">{body}</p>
          <div className="mt-stack-lg">
            <Button to={buttonHref}>{buttonLabel}</Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
