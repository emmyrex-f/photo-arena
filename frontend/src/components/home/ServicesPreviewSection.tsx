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
import { CameraSpinner } from "../ui/CameraSpinner";
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
    <Section className="bg-surface">
      <Container>
        <Reveal className="mb-stack-xl max-w-2xl">
          <Eyebrow>Our Services</Eyebrow>
          <Heading className="mt-stack-sm">What we photograph</Heading>
          <p className="mt-stack text-text-secondary">
            The major session types. Full package details and duration options are on the services page.
          </p>
        </Reveal>
        {loading && preview.length === 0 ? (
          <CameraSpinner label="Loading sessions" caption="Loading sessions…" />
        ) : (
          <Stagger className="grid gap-stack md:grid-cols-2">
            {preview.map((service) => {
              const image = serviceHeroSrc(service);
              const from = formatNairaFromKobo(service.startingPriceKobo);
              return (
                <StaggerItem key={service.id}>
                  <Link
                    to={`/services#${service.slug}`}
                    className="group relative block aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-[4/3]"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-ink" />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/10"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-card">
                      <h3 className="font-display text-2xl text-white">{service.name}</h3>
                      {service.summary ? (
                        <p className="mt-eyebrow line-clamp-2 text-sm leading-relaxed text-sage">
                          {service.summary}
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm font-medium text-accent">
                        From {from}
                        {service.kind === "RENTAL" ? "/hr" : ""}
                      </p>
                    </div>
                    <span className="sr-only">View {service.name} on the services page</span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
        <Reveal className="mt-stack-xl">
          <Button to="/services">
            View All Services
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Reveal>
      </Container>
    </Section>
  );
}
