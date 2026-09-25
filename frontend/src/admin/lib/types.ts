/**
 * TypeScript mirrors of docs/API-CONTRACT.md (§0 models, §2 admin endpoints).
 * Money is integer kobo. Times are ISO-8601 UTC strings.
 */

export type Role = "OWNER" | "ADMIN" | "STAFF";
export type BookingStatus = "TEMPORARY_HOLD" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type BookingSource = "ONLINE" | "WALK_IN" | "ADMIN";
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type PaymentMethod = "ONLINE_BACHS" | "STUDIO";
export type ServiceKind = "SESSION" | "SET" | "BOOTH" | "BACKDROP" | "RENTAL";
export type EnquiryStatus = "NEW" | "REPLIED" | "CLOSED";
export type MediaKind = "GALLERY" | "BLOG" | "CONTENT";

export const BOOKING_STATUSES: BookingStatus[] = [
  "TEMPORARY_HOLD",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];
export const SERVICE_KINDS: ServiceKind[] = ["SESSION", "SET", "BOOTH", "BACKDROP", "RENTAL"];
export const ENQUIRY_STATUSES: EnquiryStatus[] = ["NEW", "REPLIED", "CLOSED"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
export const PAYMENT_METHODS: PaymentMethod[] = ["STUDIO", "ONLINE_BACHS"];
export const ROLES: Role[] = ["OWNER", "ADMIN", "STAFF"];

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type CustomerListItem = Customer & {
  bookingCount: number;
  lastBookingAt: string | null;
  nextBookingAt: string | null;
  isActive: boolean;
  totalPaidKobo: number;
};

export type CustomersSummary = {
  total: { count: number; deltaPct: number | null };
  newCustomers: { count: number; deltaPct: number | null };
  upcomingBookings: { count: number; deltaPct: number | null };
};

export type ServiceMedia = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  alt: string;
  filename?: string | null;
  isActive?: boolean;
};

export type Service = {
  id: string;
  slug: string;
  name: string;
  kind: ServiceKind;
  summary?: string | null;
  description: string;
  startingPriceKobo: number;
  isActive: boolean;
  isProvisional: boolean;
  sortOrder: number;
  media?: ServiceMedia | null;
  packages?: Package[];
  createdAt?: string;
  updatedAt?: string;
};

export type Package = {
  id: string;
  serviceId?: string;
  name: string;
  durationMinutes: number;
  outfitCount?: number | null;
  backdropCount?: number | null;
  editedPhotoCount?: number | null;
  includes: string;
  priceKobo: number;
  isActive: boolean;
  isProvisional: boolean;
  sortOrder: number;
  service?: Service;
};

/** `GET /admin/packages` — active packages with their service. */
export type PackageOption = Package & { service: Service };

export type Payment = {
  id: string;
  bookingId: string;
  amountKobo: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: string;
  reference: string;
  transactionId?: string | null;
  paidAt: string | null;
  refundedAmountKobo?: number;
  refundReason?: string | null;
  channel?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  booking?: {
    id: string;
    startTime?: string;
    endTime?: string;
    status?: BookingStatus;
    source?: BookingSource;
    reference?: string | null;
    amountKobo?: number | null;
    customer?: Pick<Customer, "id" | "name" | "phone" | "email">;
    package?: Pick<Package, "id" | "name" | "durationMinutes" | "priceKobo"> & {
      service?: Pick<Service, "id" | "name">;
    };
  };
};

export type BookingRecord = {
  id: string;
  customerId?: string;
  packageId?: string;
  resourceId?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  source: BookingSource;
  holdExpiresAt?: string | null;
  notes: string | null;
  amountKobo?: number | null;
  reference?: string | null;
  rescheduledFromId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  customer: Customer;
  package: Package & { service?: Service };
  payments: Payment[];
};

export type CustomerDetail = Customer & {
  bookings: BookingRecord[];
  bookingCount?: number;
  totalPaidKobo?: number;
  upcomingCount?: number;
  completedCount?: number;
  nextBookingAt?: string | null;
  isActive?: boolean;
};

export type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  sessionType?: string | null;
  message: string;
  status: EnquiryStatus;
  internalNote?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type EnquiriesSummary = {
  total: { count: number; deltaPct: number | null };
  new: { count: number; deltaPct: number | null };
  replied: { count: number; deltaPct: number | null };
  closed: { count: number; deltaPct: number | null };
  tabs: { all: number; new: number; replied: number; closed: number };
};

export type GalleryImage = {
  id: string;
  filename?: string;
  url: string;
  thumbUrl?: string | null;
  alt: string;
  category: string;
  featured: boolean;
  isActive: boolean;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  kind: MediaKind;
  media?: {
    id: string;
    url: string;
    thumbUrl?: string | null;
    alt: string;
    filename?: string | null;
    isActive?: boolean;
  } | null;
  createdAt?: string;
};

export type MediaUsage = {
  id: string;
  mediaId: string;
  usageType: string;
  entityId: string;
  sortOrder: number;
  createdAt: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role?: string | null;
  rating?: number | null;
  isPublished: boolean;
  sortOrder: number;
  media?: ServiceMedia | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  tags: string[];
  isPublished: boolean;
  publishedAt?: string | null;
  authorId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  userId?: string | null;
  userEmail: string;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: unknown;
  createdAt: string;
};

export type NewsletterSubscriber = {
  id: string;
  email: string;
  isActive: boolean;
  source?: string | null;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type PricingRule = {
  id?: string;
  key: string;
  bps: number;
  isActive: boolean;
};

export type NotificationSettings = {
  recipients: string[];
  reminder24h: boolean;
  reminder2h: boolean;
  smtpConfigured: boolean;
  emailConfigured?: boolean;
  provider?: "resend" | "smtp" | "dry-run";
  fromAddress?: string | null;
};


export type NotificationLog = {
  id: string;
  event: string;
  channel: string;
  to: string;
  payload: string;
  createdAt: string;
};

export type NotificationTemplate = {
  event: string;
  subject: string;
  bodyPreview: string;
};

export type BookingsDeskStats = {
  /** All-time floor bookings (PENDING + CONFIRMED + COMPLETED). */
  totalAll?: { count: number };
  totalLast30: { count: number; deltaPct: number | null };
  today: { count: number; delta: number };
  todayRevenue: { totalKobo: number; deltaPct: number | null; deltaKobo: number };
  unpaid: { count: number };
};

export type DashboardPaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

export type DashboardTodayBooking = {
  id: string;
  startTime: string;
  customerName: string;
  serviceName: string;
  status: BookingStatus;
  paymentStatus: DashboardPaymentStatus;
  reference: string | null;
};

export type DashboardAttentionItem = {
  bookingId: string;
  customerName: string;
  amountDueKobo: number;
  reference: string;
  status: BookingStatus;
  canMarkPaid: boolean;
  startTime: string;
};

export type DashboardTomorrowBooking = {
  id: string;
  startTime: string;
  customerName: string;
  serviceName: string;
};

export type DashboardUpcomingBooking = {
  id: string;
  startTime: string;
  customerName: string;
  serviceName: string;
};

/** GET /admin/dashboard — Lagos day boundaries; money in kobo. */
export type DashboardData = {
  today: {
    date: string;
    bookingsCount: number;
    bookingsDelta: number;
    revenueTotalKobo: number;
    revenueDeltaKobo: number;
    revenueDeltaPct: number | null;
    todos: {
      unpaidBookings: number;
      newEnquiries: number;
      noShowFollowUp: number;
      failedPayments: number;
      total: number;
    };
    upcomingTomorrowCount: number;
  };
  todaysBookings: DashboardTodayBooking[];
  weeklyRevenue: {
    totalKobo: number;
    deltaPct: number | null;
    weekStart: string;
    weekEnd: string;
    earliestWeekStart: string;
    latestWeekStart: string;
    canGoBack: boolean;
    canGoForward: boolean;
    isCurrentWeek: boolean;
    daily: Array<{ date: string; label: string; revenueKobo: number }>;
  };
  needsAttention: DashboardAttentionItem[];
  tomorrowsBookings: DashboardTomorrowBooking[];
  upcomingBookings: DashboardUpcomingBooking[];
};

export type DashboardWeeklyRevenue = DashboardData["weeklyRevenue"];


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

export type PaymentsSummary = {
  totalKobo: number;
  count: number;
  byMethod: Partial<Record<PaymentMethod, number>>;
  range?: {
    from: string;
    to: string;
    priorFrom: string;
    priorTo: string;
  };
  revenue?: {
    totalKobo: number;
    deltaPct: number | null;
    deltaKobo: number;
  };
  successful?: {
    count: number;
    deltaPct: number | null;
  };
  pending?: {
    count: number;
    deltaPct: number | null;
  };
  failed?: {
    count: number;
    deltaPct: number | null;
  };
};

export type PaymentIntegrationStatus = {
  provider: "mock" | "bachs";
  environment: "mock" | "sandbox" | "live";
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  baseUrl: string;
  webhookPath: string;
  webhookUrl: string;
  events: string[];
  mockCheckout: boolean;
  readyForSandboxWebhooks: boolean;
  readyForLive: boolean;
};

export type SettingsMap = Record<string, string>;
