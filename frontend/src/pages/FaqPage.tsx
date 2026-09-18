import { FaqList } from "../components/faq/FaqList";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";

export function FaqPage() {
  return (
    <>
      <Seo
        title="FAQ"
        description="Common questions about booking, walk-ins, and sessions at Photo Arena."
        path="/faq"
      />
      <PageHeader
        eyebrow="FAQ"
        title="Questions before you book"
        description="If something is not covered here, call the studio or send a message from the contact page."
      />
      <Section>
        <Container className="max-w-3xl">
          <FaqList />
          <div className="mt-stack-xl">
            <Button to="/book">Book Your Session</Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
