import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";
import { site } from "../lib/site";

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found" noIndex />
      <PageHeader
        eyebrow="404"
        title="This frame is empty."
        description={`The page you’re looking for isn’t in the archive. Head home, or book a session at ${site.name}.`}
      />
      <Section>
        <Container className="max-w-2xl">
          <div className="flex flex-wrap gap-stack-sm">
            <Button to="/">Back home</Button>
            <Button to="/book" variant="secondary">
              Book Now
            </Button>
          </div>
          <p className="mt-stack-lg text-sm text-text-muted">
            Or{" "}
            <Link to="/contact" className="text-accent hover:text-accent-hover">
              contact the studio
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
