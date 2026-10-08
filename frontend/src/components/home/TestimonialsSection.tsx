import { Star } from "lucide-react";
import { fetchTestimonials, mediaUrl, type Testimonial } from "../../lib/publicApi";
import { Reveal, Stagger, StaggerItem } from "../../lib/motion";
import { usePublicData } from "../../lib/usePublicData";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex gap-0.5 text-accent" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={index < filled ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5 text-accent/35"}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}

function Byline({ item }: { item: Testimonial }) {
  const photo = item.media?.url ? mediaUrl(item.media.thumbUrl || item.media.url) : null;
  return (
    <footer className="mt-auto flex items-center gap-3 pt-stack">
      {photo ? (
        <img
          src={photo}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-elevated font-display text-sm text-accent"
        >
          {initials(item.name)}
        </span>
      )}
      <div className="min-w-0">
        <cite className="block text-sm not-italic text-text">{item.name}</cite>
        {item.role ? <p className="truncate text-xs text-text-muted">{item.role}</p> : null}
      </div>
    </footer>
  );
}

export function TestimonialsSection() {
  const { data, source } = usePublicData(() => fetchTestimonials(), []);

  // Only show when the API returns published testimonials — hide offline fallback empty/seed.
  if (source !== "api" || !data || data.length === 0) return null;

  return (
    <Section className="bg-bg">
      <Container>
        <Reveal>
          <Eyebrow>Client Testimonials</Eyebrow>
          <Heading className="mt-stack-sm">From the studio</Heading>
        </Reveal>
        <Stagger className="mt-stack-xl grid items-stretch gap-stack-lg md:grid-cols-2">
          {data.map((item) => (
            <StaggerItem key={item.id} className="h-full">
              <blockquote className="flex h-full flex-col rounded-2xl border border-border-subtle bg-surface p-card shadow-soft">
                {item.rating != null ? <Stars rating={item.rating} /> : null}
                <p className="mt-stack-sm text-pretty leading-relaxed text-text">{item.quote}</p>
                <Byline item={item} />
              </blockquote>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}


