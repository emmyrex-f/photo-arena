import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Eyebrow, Heading } from "../components/ui/Heading";
import { Section } from "../components/ui/Section";
import {
  fetchServices,
  formatNairaFromKobo,
  formatOutfitCount,
  formatPackageDeliverables,
  groupServicesByKind,
  SERVICE_KIND_LABELS,
  sortPublicPackages,
  type PublicPackage,
  type PublicService,
} from "../lib/publicApi";
import { serviceHeroSrc, servicesHeroImage } from "../data/serviceMedia";
import { usePolicyValues } from "../lib/policies";
import { Seo } from "../lib/seo";
import { usePublicData } from "../lib/usePublicData";

function packageOptionLabel(pkg: PublicPackage): string {
  return pkg.outfitCount != null ? formatOutfitCount(pkg.outfitCount) : `${pkg.durationMinutes} min`;
}

function PackageCards({ service }: { service: PublicService }) {
  const packages = sortPublicPackages(service.packages);
  if (packages.length === 0) {
    return (
      <div className="sm:hidden">
        <Button to={`/book?service=${encodeURIComponent(service.slug)}`} className="w-full">
          Book {service.name}
        </Button>
      </div>
    );
  }
  return (
    <ul className="space-y-control sm:hidden" aria-label={`${service.name} packages`}>
      {packages.map((pkg: PublicPackage) => {
        const label = packageOptionLabel(pkg);
        const deliverables = formatPackageDeliverables(pkg);
        return (
          <li key={pkg.id} className="border border-elevated bg-surface p-stack">
            <p className="text-xs uppercase tracking-[0.14em] text-accent">{service.name}</p>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <p className="font-display text-xl text-text">{label}</p>
              <p className="shrink-0 text-base font-medium text-accent">{formatNairaFromKobo(pkg.priceKobo)}</p>
            </div>
            {pkg.outfitCount != null ? (
              <p className="mt-1 text-sm text-text-secondary">{pkg.durationMinutes} min</p>
            ) : null}
            {deliverables ? (
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{deliverables}</p>
            ) : null}
            {pkg.includes ? (
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{pkg.includes}</p>
            ) : null}
            <Button
              to={`/book?package=${encodeURIComponent(pkg.id)}`}
              className="mt-3 w-full"
            >
              Book {label}
              <span className="sr-only">, {service.name}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function ServicePackageTable({ service }: { service: PublicService }) {
  const usesOutfits = service.packages.some((pkg) => pkg.outfitCount != null);
  return (
    <table className="w-full min-w-[32rem] text-left text-sm">
      <thead className="text-text-muted">
        <tr>
          <th className="py-3 font-medium">{usesOutfits ? "Outfit" : "Duration"}</th>
          {usesOutfits ? <th className="py-3 font-medium">Duration</th> : null}
          <th className="py-3 font-medium">Includes</th>
          <th className="py-3 font-medium">Studio price</th>
        </tr>
      </thead>
      <tbody>
        {sortPublicPackages(service.packages).map((pkg) => {
          const deliverables = formatPackageDeliverables(pkg);
          return (
            <tr key={pkg.id} className="border-t border-elevated">
              <td className="py-3">{packageOptionLabel(pkg)}</td>
              {usesOutfits ? <td className="py-3">{pkg.durationMinutes} min</td> : null}
              <td className="py-3 text-text-secondary">{deliverables ?? pkg.includes}</td>
              <td className="py-3">{formatNairaFromKobo(pkg.priceKobo)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ServicesPage() {
  const policies = usePolicyValues();
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
        description={`Choose a package online for ${policies.onlineDiscountPercent}% off. The final amount is confirmed by the booking system at checkout.`}
        image={servicesHeroImage}
        objectPosition="58% 30%"
      />

      {loading && groups.length === 0 ? (
        <Section>
          <Container>
            <CameraSpinner label="Loading services" caption="Loading services…" />
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
                      <ServicePackageTable service={service} />
                      {service.packages[0]?.id ? (
                        <Button
                          to={`/book?package=${encodeURIComponent(service.packages[0].id)}`}
                          className="mt-4"
                        >
                          Book {service.name}
                        </Button>
                      ) : (
                        <Button to={`/book?service=${encodeURIComponent(service.slug)}`} className="mt-4">
                          Book {service.name}
                        </Button>
                      )}
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
