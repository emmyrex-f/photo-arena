import { Link } from "react-router-dom";
import { VideoReelsRateCard } from "../components/booking/VideoReelsRateCard";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { readServicePageCards, servicePageCardHref } from "../data/servicePageCards";
import { servicesHeroImage } from "../data/serviceMedia";
import { fetchServices } from "../lib/publicApi";
import { Seo } from "../lib/seo";
import { useSetting, useSiteInfo } from "../lib/settings";
import { usePublicData } from "../lib/usePublicData";

export function ServicesPage() {
  const info = useSiteInfo();
  const cards = readServicePageCards(useSetting("services.cards", ""));
  const { data } = usePublicData(() => fetchServices(), []);
  const videoReels = (data ?? []).find((service) => service.slug === "video-reels");

  return (
    <>
      <Seo
        title="Services"
        description="Birthday, children, pre-wedding, portraits, passport and corporate photography at Photo Arena."
        path="/services"
      />
      <PageHeader
        eyebrow="What We Offer"
        title="Our Services"
        description="From your most intimate moments to formal professional shots — we've built every service around your specific need."
        image={servicesHeroImage}
        objectPosition="58% 30%"
      />

      <Section>
        <Container>
          <ul className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, index) => (
              <li key={`${card.title}-${index}`}>
                <Link
                  to={servicePageCardHref(card)}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:-translate-y-1.5 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <div className="relative h-[420px] shrink-0 overflow-hidden bg-ink">
                    <img
                      src={card.image}
                      alt=""
                      className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-b from-ink/10 to-ink/55"
                    />
                    <span className="absolute right-4 top-3.5 rounded-full border border-accent bg-ink px-2.5 py-1 font-display text-xs font-semibold tracking-[0.12em] text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col px-7 pb-8 pt-6">
                    <h2 className="font-display text-xl text-text">{card.title}</h2>
                    <p className="mt-2.5 flex-1 text-sm leading-relaxed text-text-secondary">{card.description}</p>
                    <span className="mt-4 inline-flex w-fit rounded-full border border-accent bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-on-accent">
                      {card.tag}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {videoReels ? (
            <div className="mt-16 border-t border-border pt-14">
              <VideoReelsRateCard service={videoReels} mode="display" />
            </div>
          ) : null}

          <div className="tone-accent mt-16 rounded-2xl px-6 py-14 text-center sm:px-12">
            <h2 className="font-display text-3xl text-text">Not sure which service you need?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
              Just walk in and talk to us. We'll help you find the right shoot for the occasion.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href={info.phoneHref}
                className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-text-on-accent"
              >
                Call {info.phone}
              </a>
              <a
                href={info.emailHref}
                className="inline-flex min-h-11 items-center rounded-full border border-accent px-5 text-sm font-semibold text-text"
              >
                Email us
              </a>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
