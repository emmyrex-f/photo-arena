import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { useConsent } from "../lib/consent";
import { Seo } from "../lib/seo";
import { site } from "../lib/site";

export function CookiesPage() {
  const { openPreferences } = useConsent();

  return (
    <>
      <Seo
        title="Cookies"
        description="How Photo Arena uses necessary, analytics, and marketing cookies."
        path="/cookies"
      />
      <PageHeader
        eyebrow="Legal"
        title="Cookie policy"
        description="This site uses cookies and similar technologies. You control optional cookies from the banner or settings link below."
      />
      <Section>
        <Container className="prose-pa max-w-2xl">
          <h2>What cookies are</h2>
          <p>
            Cookies are small text files stored on your device. {site.name} uses them so the site works,
            to remember your consent choice, and — only if you agree — to measure traffic and run ads.
          </p>

          <h2>Categories we use</h2>
          <ul>
            <li>
              <strong>Necessary</strong> — required for security, consent storage (`pa_cookie_consent`),
              and completing an online booking. These cannot be switched off.
            </li>
            <li>
              <strong>Analytics</strong> — Google Analytics 4 (when configured) loads only after you
              accept analytics cookies.
            </li>
            <li>
              <strong>Marketing</strong> — Meta Pixel (when configured) loads only after you accept
              marketing cookies.
            </li>
          </ul>

          <h2>Your choices</h2>
          <p>
            On your first visit you can accept all, reject non-essential, or manage preferences. Change
            your mind anytime via{" "}
            <button
              type="button"
              onClick={openPreferences}
              className="text-accent-hover underline underline-offset-3"
            >
              Cookie settings
            </button>{" "}
            in the footer, or see our <Link to="/privacy">Privacy notice</Link>.
          </p>

          <h2>NDPR</h2>
          <p>
            Optional cookies that are not strictly necessary rely on consent under the Nigeria Data
            Protection Regulation. Necessary cookies support the service you request.
          </p>

          <p className="text-sm text-text-muted">Last updated: September 2026.</p>
        </Container>
      </Section>
    </>
  );
}
