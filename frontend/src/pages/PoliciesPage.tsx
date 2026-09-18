import { PageHeader } from "../components/layout/PageHeader";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { formatExtraImageNaira, usePolicyValues } from "../lib/policies";
import { Seo } from "../lib/seo";

export function PoliciesPage() {
  const policies = usePolicyValues();

  const sections = [
    {
      title: "Payment",
      body: `Online bookings are paid in full through our payment provider and receive a ${policies.onlineDiscountPercent}% discount. Walk-in and staff reservations can be paid at the studio.`,
    },
    {
      title: "Refunds and cancellation",
      body: "Bookings are non-refundable. Customers cannot cancel online. The studio may handle exceptions manually.",
    },
    {
      title: "Rescheduling",
      body: `Rescheduling attracts a ${policies.reschedulePercent}% additional charge.`,
    },
    {
      title: "No-show",
      body: `If a customer does not attend, the booking is marked as a no-show. They may contact the studio afterwards. A reschedule still attracts the ${policies.reschedulePercent}% charge.`,
    },
    {
      title: "Delivery",
      body: `Edited photographs are typically ready within ${policies.deliveryDays}. Express delivery (within 24 hours, max ${policies.expressMaxPhotos} photos) attracts +${policies.expressPercent}%.`,
    },
    {
      title: "Extras & VAT",
      body: `Additional selected images are ${formatExtraImageNaira(policies.extraImageKobo)} each. VAT of ${policies.vatPercent}% may apply where required. Up to ${policies.accompanyingMax} accompanying ${Number(policies.accompanyingMax) === 1 ? "guest" : "guests"} unless otherwise agreed.`,
    },
    {
      title: "Image use",
      body: "Photo Arena may use session photographs for promotional purposes unless an exclusive-use package is purchased or you ask us in writing not to.",
    },
  ];

  return (
    <>
      <Seo
        title="Studio policies"
        description="Booking, payment, delivery and studio rules at Photo Arena."
        path="/policies"
      />
      <PageHeader
        eyebrow="Policies"
        title="Booking terms"
        description="These rules are confirmed by the studio owner and may be updated in studio settings."
      />
      <Section>
        <Container className="max-w-2xl space-y-stack-lg leading-relaxed text-text-secondary">
          {sections.map((item) => (
            <div key={item.title}>
              <h2 className="font-display text-2xl text-text">{item.title}</h2>
              <p className="mt-stack">{item.body}</p>
            </div>
          ))}
        </Container>
      </Section>
    </>
  );
}
