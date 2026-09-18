import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Eyebrow } from "../components/ui/Heading";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";
import { site } from "../lib/site";

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found" noIndex />
      <Section className="tone-dark flex min-h-[70vh] items-center">
        <Container className="max-w-2xl text-center">
          <Eyebrow>404</Eyebrow>
          <h1 className="font-display text-5xl text-text sm:text-6xl">This frame is empty.</h1>
          <p className="mx-auto mt-stack max-w-md text-text-secondary">
            The page you’re looking for isn’t in the archive. Head home, or book a session at {site.name}.
          </p>
          <div className="mt-stack-lg flex flex-wrap justify-center gap-stack-sm">
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
