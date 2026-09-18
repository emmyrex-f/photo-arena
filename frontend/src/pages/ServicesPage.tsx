import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { Eyebrow, Heading } from "../components/ui/Heading";
import { Section } from "../components/ui/Section";
import {
  fetchServices,
  formatNairaFromKobo,
  groupServicesByKind,
  SERVICE_KIND_LABELS,
  type PublicPackage,
  type PublicService,
} from "../lib/publicApi";
import { serviceHeroSrc } from "../data/serviceMedia";
import { Seo } from "../lib/seo";
import { usePublicData } from "../lib/usePublicData";

function PackageCards({ service }: { service: PublicService }) {
  return (
    <ul className="space-y-control sm:hidden" aria-label={`${service.name} packages`}>
      {service.packages.map((pkg: PublicPackage) => {
        const duration = `${pkg.durationMinutes} min`;
        return (
          <li key={pkg.id} className="border border-elevated bg-surface p-stack">
            <p className="text-xs uppercase tracking-[0.14em] text-accent">{service.name}</p>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <p className="font-display text-xl text-text">{duration}</p>
              <p className="shrink-0 text-base font-medium text-accent">{formatNairaFromKobo(pkg.priceKobo)}</p>
            </div>
            {pkg.includes ? (
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{pkg.includes}</p>
            ) : null}
            <Button
              to={`/book?package=${encodeURIComponent(pkg.id)}`}
              className="mt-3 w-full"
            >
              Book {duration}
              <span className="sr-only">, {service.name}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function ServicesPage() {
  const { data, loading, source } = usePublicData(() => fetchServices(), []);
  const groups = groupServicesByKind(data ?? []);
  const anyProvisional = (data ?? []).some((service) => service.isProvisional);
  const { hash } = useLocation();
  const highlightedSlug = decodeURIComponent(hash.replace(/^#/, ""));

  useEffect(() => {
    if (!highlightedSlug || loading) return;
    const el = document.getElementById(highlightedSlug);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroll = () => {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    };
    scroll();
    const images = [...document.querySelectorAll<HTMLImageElement>("#main img")];
    images.forEach((img) => {
      if (!img.complete) img.addEventListener("load", scroll, { once: true });
    });
    const retry = window.setTimeout(scroll, 450);
    return () => window.clearTimeout(retry);
  }, [highlightedSlug, loading, groups.length]);

  return (
    <>
      <Seo
        title="Services"
        description="Photography sessions, signature sets, booths, backdrops and studio rental at Photo Arena."
        path="/services"
      />
      <PageHeader
        eyebrow="Services"
        title="Sessions, sets, and space hire."
        description="Choose a package online for 5% off. The final amount is confirmed by the booking system at checkout."
      />

      {loading && groups.length === 0 ? (
        <Section>
          <Container>
            <p className="text-text-secondary">Loading services…</p>
          </Container>
        </Section>
      ) : null}

      {groups.map((group) => {
        const labels = SERVICE_KIND_LABELS[group.kind];
        return (
          <Section key={group.kind} className={group.kind === "SESSION" ? undefined : "bg-surface/30"}>
            <Container>
              <Eyebrow>{labels.eyebrow}</Eyebrow>
              <Heading as="h2">{labels.title}</Heading>
              <p className="mt-stack max-w-2xl text-sm text-text-secondary">{labels.blurb}</p>

              <div className="mt-stack-xl space-y-stack-2xl">
                {group.services.map((service) => {
                  const image = serviceHeroSrc(service);
                  return (
                  <article
                    key={service.id}
                    id={service.slug}
                    className={`scroll-mt-28 ${
                      highlightedSlug === service.slug
                        ? "rounded-sm outline outline-1 outline-accent outline-offset-8"
                        : ""
                    }`}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={`${service.name} at Photo Arena`}
                        className="mb-stack aspect-[4/5] w-full max-w-md object-cover object-top sm:max-w-xl"
                      />
                    ) : null}
                    <div className="mb-stack-sm flex flex-wrap items-end justify-between gap-control">
                      <div>
                        <h3 className="font-display text-2xl">{service.name}</h3>
                        {service.summary ? (
                          <p className="mt-2 max-w-xl text-sm text-text-secondary">{service.summary}</p>
                        ) : null}
                      </div>
                      <p className="text-sm text-accent">
                        From {formatNairaFromKobo(service.startingPriceKobo)}
                      </p>
                    </div>
                    <PackageCards service={service} />
                    <div className="hidden min-w-0 overflow-x-auto sm:block">
                      <table className="w-full min-w-[32rem] text-left text-sm">
                        <thead className="text-text-muted">
                          <tr>
                            <th className="py-3 font-medium">Duration</th>
                            <th className="py-3 font-medium">Includes</th>
                            <th className="py-3 font-medium">Studio price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {service.packages.map((pkg) => (
                            <tr key={pkg.id} className="border-t border-elevated">
                              <td className="py-3">{pkg.durationMinutes} min</td>
                              <td className="py-3 text-text-secondary">{pkg.includes}</td>
                              <td className="py-3">{formatNairaFromKobo(pkg.priceKobo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button
                        to={`/book?package=${encodeURIComponent(service.packages[0]?.id ?? "")}`}
                        className="mt-4"
                      >
                        Book {service.name}
                      </Button>
                    </div>
                  </article>
                  );
                })}
              </div>
            </Container>
          </Section>
        );
      })}

      <Section>
        <Container>
          {anyProvisional || source === "fallback" ? (
            <p className="mb-stack-lg text-xs text-text-muted">
              {source === "fallback"
                ? "Showing provisional catalogue while the services API is offline. Subject to owner confirmation."
                : "Some prices are marked provisional until the owner confirms the production list."}
            </p>
          ) : null}
          <Button to="/book">Book Your Session</Button>
        </Container>
      </Section>
    </>
  );
}
