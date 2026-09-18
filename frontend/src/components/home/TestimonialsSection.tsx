import { fetchTestimonials, mediaUrl } from "../../lib/publicApi";
import { Reveal, Stagger, StaggerItem } from "../../lib/motion";
import { usePublicData } from "../../lib/usePublicData";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

export function TestimonialsSection() {
  const { data, source } = usePublicData(() => fetchTestimonials(), []);

  // Only show when the API returns published testimonials — hide offline fallback empty/seed.
  if (source !== "api" || !data || data.length === 0) return null;

  return (
    <Section className="bg-surface/30">
      <Container>
        <Reveal>
          <Eyebrow>Client notes</Eyebrow>
          <Heading>From the studio</Heading>
        </Reveal>
        <Stagger className="mt-stack-xl grid gap-stack-lg md:grid-cols-2">
          {data.map((item) => (
            <StaggerItem key={item.id} className="border-l border-accent pl-6">
              <blockquote>
                {item.media?.url ? (
                  <img
                    src={mediaUrl(item.media.thumbUrl || item.media.url)}
                    alt={item.media.alt || item.name}
                    className="mb-stack-sm h-14 w-14 object-cover"
                  />
                ) : null}
                <p className="text-text-secondary">{item.quote}</p>
                <footer className="mt-stack-sm text-sm text-text">
                  {item.name}
                  {item.role ? <span className="text-text-muted"> · {item.role}</span> : null}
                </footer>
              </blockquote>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
