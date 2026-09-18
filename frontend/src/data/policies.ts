/**
 * Studio policy lines ported from the old Bookings page.
 * Rendered from settings `policies.*` with these hardcoded fallbacks.
 */
export const policyDefaults = {
  deliveryDays: "3–4 working days",
  expressPercent: "30",
  expressMaxPhotos: "8",
  extraImageKobo: "300000",
  vatPercent: "7.5",
  accompanyingMax: "1",
  reschedulePercent: "15",
  onlineDiscountPercent: "5",
} as const;

export type PolicyValues = Record<keyof typeof policyDefaults, string>;
