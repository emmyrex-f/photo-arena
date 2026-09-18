import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { formatExtraImageNaira, usePolicyValues } from "../lib/policies";
import { Seo } from "../lib/seo";
import { useSiteInfo } from "../lib/settings";

export function TermsPage() {
  const policies = usePolicyValues();
  const info = useSiteInfo();

  return (
    <>
      <Seo
        title="Terms"
        description="Booking terms and studio policies for Photo Arena, Port Harcourt."
        path="/terms"
      />
      <PageHeader
        eyebrow="Legal"
        title="Terms of use & booking"
        description="These terms cover use of this website and online bookings at Photo Arena."
      />
      <Section>
        <Container className="prose-pa max-w-2xl">
          <h2>Studio</h2>
          <p>
            {info.name} is located at {info.address}. Opening hours: Monday–Saturday{" "}
            {info.hoursWeekday}; Sunday {info.hoursSunday}.
          </p>

          <h2>Online booking</h2>
          <ul>
            <li>
              Selecting a slot places a temporary hold (typically 15 minutes) while you complete
              payment. Unpaid holds expire and the slot returns to the calendar.
            </li>
            <li>
              Online bookings paid in full receive a {policies.onlineDiscountPercent}% discount. The
              charged amount is calculated by the studio booking system at hold/checkout — display
              estimates on this site are not final.
            </li>
            <li>Times are shown in Africa/Lagos (West Africa Time).</li>
            <li>
              Walk-ins are welcome during opening hours subject to availability; reserved future slots
              should be booked online or by calling the studio.
            </li>
          </ul>

          <h2>Payment, refunds & rescheduling</h2>
          <ul>
            <li>Online bookings are paid in full through our payment provider.</li>
            <li>Bookings are non-refundable. Customers cannot cancel online.</li>
            <li>
              Rescheduling attracts an additional {policies.reschedulePercent}% charge, handled by the
              studio.
            </li>
            <li>
              No-shows are marked accordingly; contacting the studio afterwards may allow a reschedule
              subject to the reschedule fee.
            </li>
          </ul>

          <h2>Session policies</h2>
          <ul>
            <li>Edited photographs are typically delivered within {policies.deliveryDays}.</li>
            <li>
              Express delivery (within 24 hours, max {policies.expressMaxPhotos} photos) attracts +
              {policies.expressPercent}%.
            </li>
            <li>Extra selected images: {formatExtraImageNaira(policies.extraImageKobo)} each.</li>
            <li>VAT of {policies.vatPercent}% may apply where required.</li>
            <li>
              Up to {policies.accompanyingMax} accompanying{" "}
              {Number(policies.accompanyingMax) === 1 ? "guest" : "guests"} in the studio unless
              otherwise agreed.
            </li>
            <li>
              Photo Arena may use session photographs for promotional purposes unless an exclusive-use
              package is purchased or you ask us in writing not to.
            </li>
          </ul>

          <h2>Website</h2>
          <p>
            Content on this site is for information about the studio. Pricing marked provisional may
            change. See also our <Link to="/policies">studio policies</Link>,{" "}
            <Link to="/privacy">privacy notice</Link>, and <Link to="/cookies">cookie policy</Link>.
          </p>

          <p className="text-sm text-text-muted">Last updated: September 2026.</p>
        </Container>
      </Section>
    </>
  );
}
