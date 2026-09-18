import { Reveal } from "../../lib/motion";
import { useSiteInfo } from "../../lib/settings";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

export function BookingCtaSection() {
  const info = useSiteInfo();

  return (
    <Section className="tone-dark border-y border-border">
      <Container className="max-w-3xl text-center">
        <Reveal>
          <Heading>Ready to create something memorable?</Heading>
          <p className="mx-auto mt-stack max-w-xl text-text-secondary">
            Reserve a studio session online and receive 5% off. Walk-ins are welcome Monday–Saturday{" "}
            {info.hoursWeekday} and Sunday {info.hoursSunday}.
          </p>
          <div className="mt-stack-lg">
            <Button to="/book">Book Your Session</Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
