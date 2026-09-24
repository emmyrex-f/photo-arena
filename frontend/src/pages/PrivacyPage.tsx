import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Seo } from "../lib/seo";
import { useSiteInfo } from "../lib/settings";
import { site } from "../lib/site";

export function PrivacyPage() {
  const info = useSiteInfo();

  return (
    <>
      <Seo
        title="Privacy"
        description="How Photo Arena collects and uses personal data under Nigeria’s NDPR."
        path="/privacy"
      />
      <PageHeader
        eyebrow="Legal"
        title="Privacy notice"
        description="Photo Arena respects your privacy. This notice explains what we collect when you visit photoarenang.com or book a session in Port Harcourt."
      />
      <Section>
        <Container className="prose-pa max-w-2xl">
          <h2>Who we are</h2>
          <p>
            {info.name} (“we”, “us”) operates a portrait studio at {info.address}, and this website at{" "}
            {site.domain}. Contact:{" "}
            <a href={info.emailHref}>{info.email}</a> · <a href={info.phoneHref}>{info.phone}</a>.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Booking details</strong> — name, email, phone, session package, and preferred
              appointment time when you book online.
            </li>
            <li>
              <strong>Enquiries & newsletter</strong> — name, email, phone (optional), session interest,
              and message content you submit.
            </li>
            <li>
              <strong>Payment references</strong> — processed by our payment provider; we store booking
              and payment status, not full card numbers.
            </li>
            <li>
              <strong>Technical data</strong> — cookies and similar technologies as described in our{" "}
              <Link to="/cookies">Cookie policy</Link>.
            </li>
          </ul>

          <h2>Why we use it (NDPR lawful bases)</h2>
          <p>
            Under the Nigeria Data Protection Regulation (NDPR), we process personal data to perform a
            contract (your booking), to pursue legitimate interests in running the studio and improving
            the website, and — for optional analytics/marketing cookies — with your consent.
          </p>

          <h2>Sharing</h2>
          <p>
            We share data with service providers who help us operate (hosting, email, payment). We do
            not sell your personal data. Studio photographs may be used for promotional purposes unless
            you purchase an exclusive-use package or ask us in writing not to.
          </p>

          <h2>Retention</h2>
          <p>
            Booking and customer records are kept as long as needed for studio operations, accounting,
            and dispute resolution. Enquiry messages are retained until resolved and for a reasonable
            follow-up period.
          </p>

          <h2>Your rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data, or withdraw cookie
            consent, by emailing {info.email}. To exercise other NDPR rights, use the same address.
          </p>

          <h2>Security</h2>
          <p>
            We use reasonable technical and organisational measures to protect personal data. No method
            of transmission over the internet is completely secure.
          </p>

          <p className="text-sm text-text-muted">Last updated: September 2026.</p>
        </Container>
      </Section>
    </>
  );
}
