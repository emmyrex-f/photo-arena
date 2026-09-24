import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";
import { useSiteInfo } from "../lib/settings";

export function CookiesPage() {
  const info = useSiteInfo();

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
        description="This site uses cookies and similar technologies. You control optional cookies from the banner on your first visit."
      />
      <Section>
        <Container className="prose-pa max-w-2xl">
          <h2>What cookies are</h2>
          <p>
            Cookies are small text files stored on your device. {info.name} uses them so the site works,
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
            On your first visit you can accept all or reject optional cookies. See our{" "}
            <Link to="/privacy">Privacy notice</Link> for how we handle personal data.
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
