/**
 * Typed fetchers for the public API (docs/API-CONTRACT.md §1).
 * Every content fetcher has an offline fallback so the site renders fully with the backend down.
 */
import { faqs as fallbackFaqsData } from "../data/faq";
import { fallbackServices } from "../data/packages";
import { portfolioImages } from "../data/portfolio.generated";
import { testimonials as fallbackTestimonialsData } from "../data/testimonials";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export class PublicApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const body = data as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message)
        ? body.message.join(" ")
        : body?.message || `Request failed (${response.status})`;
      throw new PublicApiError(response.status, message);
    }
    return data as T;
  } finally {
    window.clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type ServiceKind = "SESSION" | "SET" | "BOOTH" | "BACKDROP" | "RENTAL";

export type PublicPackage = {
  id: string;
  name: string;
  durationMinutes: number;
  outfitCount?: number | null;
  backdropCount?: number | null;
  editedPhotoCount?: number | null;
  includes: string;
  priceKobo: number;
  /** Server-calculated online payable. Absent on offline fallback catalogue. */
  onlinePriceKobo?: number;
  discountPercent?: number;
  isProvisional: boolean;
  sortOrder: number;
};

export type PublicMediaRef = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string;
};

export type PublicService = {
  id: string;
  slug: string;
  name: string;
  kind: ServiceKind;
  summary: string | null;
  description: string;
  startingPriceKobo: number;
  isProvisional: boolean;
  sortOrder: number;
  media?: PublicMediaRef | null;
  packages: PublicPackage[];
};

export type GalleryImage = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string;
  category: string;
  featured: boolean;
  width: number | null;
  height: number | null;
  sortOrder: number;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string | null;
  rating: number | null;
  sortOrder: number;
  media?: PublicMediaRef | null;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
};

export type BlogPost = BlogPostSummary & { content: string };

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export type SettingsMap = Record<string, string>;

/* -------------------------------------------------------------------------- */
/* Fallback adapters                                                           */
/* -------------------------------------------------------------------------- */

export const fallbackGallery: GalleryImage[] = portfolioImages.map((image, index) => ({
  id: image.id,
  url: image.src,
  thumbUrl: image.src,
  alt: image.alt,
  category: image.category,
  featured: image.featured,
  width: 640,
  height: 800,
  sortOrder: index,
}));

export const fallbackFaqs: Faq[] = fallbackFaqsData.map((item, index) => ({
  id: `faq-${index}`,
  question: item.question,
  answer: item.answer,
  sortOrder: index,
}));

export const fallbackTestimonials: Testimonial[] = fallbackTestimonialsData
  .filter((item) => item.approved)
  .map((item, index) => ({ id: item.id, quote: item.quote, name: item.name, role: null, rating: null, sortOrder: index }));

/* -------------------------------------------------------------------------- */
/* Content fetchers (with fallback)                                            */
/* -------------------------------------------------------------------------- */

export type WithSource<T> = { data: T; source: "api" | "fallback" };

async function withFallback<T>(fetcher: () => Promise<T>, fallback: T, validate?: (value: T) => boolean): Promise<WithSource<T>> {
  try {
    const data = await fetcher();
    if (validate && !validate(data)) return { data: fallback, source: "fallback" };
    return { data, source: "api" };
  } catch {
    return { data: fallback, source: "fallback" };
  }
}

export function fetchSettings(): Promise<WithSource<SettingsMap>> {
  return withFallback(
    () => request<SettingsMap>("/public/settings"),
    {},
    (value) => value != null && typeof value === "object" && !Array.isArray(value),
  );
}

export function fetchServices(): Promise<WithSource<PublicService[]>> {
  return withFallback(
    () => request<PublicService[]>("/public/services"),
    fallbackServices,
    (value) => Array.isArray(value) && value.length > 0,
  );
}

export function fetchGallery(): Promise<WithSource<GalleryImage[]>> {
  return withFallback(
    () => request<GalleryImage[]>("/public/gallery"),
    fallbackGallery,
    (value) => Array.isArray(value) && value.length > 0,
  );
}

export function fetchTestimonials(): Promise<WithSource<Testimonial[]>> {
  return withFallback(
    () => request<Testimonial[]>("/public/testimonials"),
    fallbackTestimonials,
    (value) => Array.isArray(value),
  );
}

export function fetchFaqs(): Promise<WithSource<Faq[]>> {
  return withFallback(
    () => request<Faq[]>("/public/faqs"),
    fallbackFaqs,
    (value) => Array.isArray(value) && value.length > 0,
  );
}

const emptyBlogPage: Paginated<BlogPostSummary> = { items: [], total: 0, page: 1, pageSize: 9 };

export function fetchBlogList(page = 1, pageSize = 9, tag = ""): Promise<WithSource<Paginated<BlogPostSummary>>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (tag) params.set("tag", tag);
  return withFallback(
    () => request<Paginated<BlogPostSummary>>(`/public/blog?${params.toString()}`),
    emptyBlogPage,
    (value) => value != null && Array.isArray(value.items),
  );
}

/** Throws PublicApiError(404) when the post does not exist; other errors become "offline". */
export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    return await request<BlogPost>(`/public/blog/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Forms                                                                       */
/* -------------------------------------------------------------------------- */

export type EnquiryPayload = {
  name: string;
  email: string;
  phone?: string;
  sessionType?: string;
  message: string;
  botcheck?: string;
};

export function submitEnquiry(payload: EnquiryPayload): Promise<{ id: string }> {
  return request<{ id: string }>("/public/enquiries", { method: "POST", body: JSON.stringify(payload) });
}

export function subscribeNewsletter(email: string, source = "footer"): Promise<{ ok: true }> {
  return request<{ ok: true }>("/public/newsletter", { method: "POST", body: JSON.stringify({ email, source }) });
}

/* -------------------------------------------------------------------------- */
/* Booking flow                                                                */
/* -------------------------------------------------------------------------- */

export type AvailabilityResponse = {
  rules: {
    slotIncrementMinutes: number;
    bufferMinutes: number;
    sameDayMinimumNoticeMinutes: number;
    holdDurationMinutes: number;
    timezone: string;
  };
  date: string;
  durationMinutes: number;
  slots: string[];
};

export function fetchAvailability(date: string, durationMinutes: number): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({ date, durationMinutes: String(durationMinutes) });
  return request<AvailabilityResponse>(`/bookings/availability?${params.toString()}`);
}

export type HoldPayload = {
  packageId: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
};

export type HoldResponse = {
  bookingId: string;
  reference: string;
  status: "TEMPORARY_HOLD";
  holdExpiresAt: string;
  startTime: string;
  endTime: string;
  package: { id: string; name: string; durationMinutes: number };
  pricing: { baseKobo: number; discountKobo: number; payableKobo: number; discountPercent: number };
};

export function createHold(payload: HoldPayload): Promise<HoldResponse> {
  return request<HoldResponse>("/bookings/hold", { method: "POST", body: JSON.stringify(payload) });
}

export type CheckoutResponse = { provider: "mock" | "bachs"; checkoutUrl: string; reference: string };

export function startCheckout(
  bookingId: string,
  reference: string,
  returnUrl: string,
  cancelUrl: string,
): Promise<CheckoutResponse> {
  return request<CheckoutResponse>(`/bookings/${encodeURIComponent(bookingId)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ reference, returnUrl, cancelUrl }),
  });
}

export type BookingStatus = "TEMPORARY_HOLD" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type BookingStatusResponse = {
  id: string;
  reference: string | null;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  holdExpiresAt: string | null;
  package: { name: string; durationMinutes: number };
  /** Public status never includes email/phone — name only after reference gate. */
  customer: { name: string; email?: string | null };
  amountKobo: number | null;
  payment: { status: "PENDING" | "SUCCESS" | "FAILED" | string; method: string; provider: string | null; paidAt: string | null } | null;
};

export function fetchBookingStatus(bookingId: string, reference: string): Promise<BookingStatusResponse> {
  const qs = new URLSearchParams({ reference });
  return request<BookingStatusResponse>(
    `/bookings/${encodeURIComponent(bookingId)}/status?${qs.toString()}`,
  );
}

export function verifyPayment(reference: string): Promise<BookingStatusResponse> {
  return request<BookingStatusResponse>(`/payments/verify?reference=${encodeURIComponent(reference)}`, {}, 15000);
}

export function completeMockPayment(reference: string): Promise<unknown> {
  return request("/payments/mock/complete", { method: "POST", body: JSON.stringify({ reference }) });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export { formatNairaFromKobo } from "../data/packages";

export const SERVICE_KIND_ORDER: ServiceKind[] = ["SESSION", "SET", "BOOTH", "BACKDROP", "RENTAL"];

export const SERVICE_KIND_LABELS: Record<ServiceKind, { title: string; eyebrow: string; blurb: string }> = {
  SESSION: {
    eyebrow: "Photography sessions",
    title: "Sessions",
    blurb: "Directed studio sessions with our photographer. Choose an outfit option; duration and deliverables are shown for each.",
  },
  SET: {
    eyebrow: "Aesthetic backgrounds",
    title: "Signature sets",
    blurb: "Photographed by us on our built sets — sculptural walls, arches and LED shelving.",
  },
  BOOTH: {
    eyebrow: "Space rental",
    title: "Booths",
    blurb: "Hire a themed booth and bring your own photographer or phone. We supply the set.",
  },
  BACKDROP: {
    eyebrow: "Space rental",
    title: "Backdrops",
    blurb: "Hire a premium backdrop for content, brand shoots and events.",
  },
  RENTAL: {
    eyebrow: "Space rental",
    title: "Studio rental",
    blurb: "Hourly hire of the room, lighting and backdrops for photographers and brands.",
  },
};

export function formatOutfitCount(count: number): string {
  return count === 1 ? "1 outfit" : `${count} outfits`;
}

export function formatPackageDeliverables(
  pkg: Pick<PublicPackage, "backdropCount" | "editedPhotoCount">,
): string | null {
  const parts: string[] = [];
  if (pkg.backdropCount != null) {
    parts.push(pkg.backdropCount === 1 ? "1 backdrop" : `${pkg.backdropCount} backdrops`);
  }
  if (pkg.editedPhotoCount != null) {
    parts.push(pkg.editedPhotoCount === 1 ? "1 photo" : `${pkg.editedPhotoCount} photos`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function sortPublicPackages(packages: PublicPackage[]): PublicPackage[] {
  return [...packages].sort((a, b) => {
    const aOutfit = a.outfitCount;
    const bOutfit = b.outfitCount;
    if (aOutfit != null && bOutfit != null && aOutfit !== bOutfit) return aOutfit - bOutfit;
    return a.durationMinutes - b.durationMinutes || a.sortOrder - b.sortOrder;
  });
}

export function groupServicesByKind(services: PublicService[]): { kind: ServiceKind; services: PublicService[] }[] {
  return SERVICE_KIND_ORDER.map((kind) => ({
    kind,
    services: services
      .filter((service) => (service.kind ?? "SESSION") === kind)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  })).filter((group) => group.services.length > 0);
}

/** Absolute or proxy-safe media URL for API-provided paths like /uploads/x.jpg. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  if (path.startsWith("/uploads/") && API_URL.startsWith("http")) {
    return `${API_URL.replace(/\/api\/?$/, "")}${path}`;
  }
  return path;
}
