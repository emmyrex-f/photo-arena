import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "../components/contact/ContactForm";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";
import { useSiteInfo } from "../lib/settings";

export function ContactPage() {
  const info = useSiteInfo();

  return (
    <>
      <Seo
        title="Contact"
        description="Visit Photo Arena in Port Harcourt or send a message about your session."
        path="/contact"
      />
      <PageHeader
        eyebrow="Contact"
        title="Visit the studio, or send a message."
        description="Walk-ins are welcome during opening hours. For a reserved future slot, book online or call the studio."
      />
      <Section>
        <Container className="grid gap-grid-lg lg:grid-cols-2">
          <div className="space-y-6 text-sm text-text-secondary">
            <p className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
              <span>{info.address}</span>
            </p>
            <p className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-accent" aria-hidden="true" />
              <a href={info.phoneHref}>{info.phone}</a>
            </p>
            <p className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-accent" aria-hidden="true" />
              <a href={info.emailHref}>{info.email}</a>
            </p>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
              <ul>
                <li>Monday – Saturday: {info.hoursWeekday}</li>
                <li>Sunday: {info.hoursSunday}</li>
              </ul>
            </div>
            <div className="space-y-3">
              <iframe
                title="Photo Arena location map"
                src={info.mapEmbed}
                className="h-64 w-full border border-elevated"
                loading="lazy"
              />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [info.name, info.address].filter(Boolean).join(", "),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent bg-accent px-6 text-sm font-medium text-text-on-accent hover:bg-accent-hover"
              >
                Open in Google Maps
              </a>
            </div>
          </div>
          <ContactForm />
        </Container>
      </Section>
    </>
  );
}
