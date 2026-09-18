import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { serviceHeroSrc } from "../../data/serviceMedia";
import { Reveal, Stagger, StaggerItem } from "../../lib/motion";
import {
  fetchServices,
  formatNairaFromKobo,
  type PublicService,
} from "../../lib/publicApi";
import { usePublicData } from "../../lib/usePublicData";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Eyebrow, Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

/** Prefer these live catalogue slugs for the 2×2 home preview. */
const PREVIEW_SLUGS = ["personal-birthday", "bundle-of-joy-0-1", "pre-wedding", "space-rental"];

function pickPreview(services: PublicService[]): PublicService[] {
  const bySlug = new Map(services.map((service) => [service.slug, service]));
  const preferred = PREVIEW_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (service): service is PublicService => Boolean(service),
  );
  if (preferred.length >= 4) return preferred.slice(0, 4);
  const rest = services.filter((service) => !PREVIEW_SLUGS.includes(service.slug));
  return [...preferred, ...rest].slice(0, 4);
}

export function ServicesPreviewSection() {
  const { data, loading } = usePublicData(() => fetchServices(), []);
  const preview = useMemo(() => pickPreview(data ?? []), [data]);

  return (
    <Section className="bg-surface/30">
      <Container>
        <Reveal className="mb-stack-xl max-w-2xl">
          <Eyebrow>Sessions</Eyebrow>
          <Heading>What we photograph</Heading>
          <p className="mt-stack text-text-secondary">
            The major session types. Full package details and duration options are on the services page.
          </p>
        </Reveal>
        {loading && preview.length === 0 ? (
          <p className="text-text-secondary">Loading sessions…</p>
        ) : (
          <Stagger className="grid gap-px bg-elevated md:grid-cols-2">
            {preview.map((service) => {
              const image = serviceHeroSrc(service);
              const from = formatNairaFromKobo(service.startingPriceKobo);
              return (
                <StaggerItem key={service.id} className="bg-bg p-card-lg">
                  {image ? (
                    <Link
                      to={`/services#${service.slug}`}
                      className="block"
                    >
                      <img
                        src={image}
                        alt=""
                        className="mb-6 aspect-[4/5] w-full object-cover object-top transition-opacity hover:opacity-90 sm:aspect-[4/3]"
                      />
                      <span className="sr-only">View {service.name} on the services page</span>
                    </Link>
                  ) : null}
                  <h3 className="font-display text-2xl text-text">{service.name}</h3>
                  {service.summary ? (
                    <p className="mt-eyebrow text-sm leading-relaxed text-text-secondary">{service.summary}</p>
                  ) : null}
                  <p className="mt-6 text-sm text-accent">
                    From {from}
                    {service.kind === "RENTAL" ? "/hr" : ""}
                  </p>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
        <Reveal className="mt-stack-xl">
          <Button to="/services" variant="secondary">
            View All Services
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Reveal>
      </Container>
    </Section>
  );
}
