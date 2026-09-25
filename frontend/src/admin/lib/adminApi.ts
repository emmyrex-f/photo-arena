import { useMemo } from "react";
import { api, apiBlob, ApiError, apiUpload, qs } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type {
  AdminUser,
  AuditLog,
  AvailabilityResponse,
  BlogPost,
  BookingRecord,
  BookingStatus,
  BookingsDeskStats,
  CustomerDetail,
  CustomerListItem,
  CustomersSummary,
  DashboardData,
  Enquiry,
  EnquiryStatus,
  EnquiriesSummary,
  Faq,
  GalleryImage,
  MediaKind,
  NewsletterSubscriber,
  NotificationLog,
  NotificationSettings,
  NotificationTemplate,
  PackageOption,
  Paginated,
  Payment,
  PaymentIntegrationStatus,
  PaymentMethod,
  PaymentsSummary,
  PaymentStatus,
  PricingRule,
  Role,
  Service,
  ServiceKind,
  SettingsMap,
  Testimonial,
  Package,
} from "./types";

type Token = string | null;

type ClientOptions = {
  token: Token;
  onUnauthorized?: () => void;
};

function json(body: unknown): string {
  return JSON.stringify(body);
}

/**
 * Typed client for every admin endpoint in docs/API-CONTRACT.md §2.
 * All functions throw `ApiError`; a 401 also fires `onUnauthorized`.
 */
export function createAdminApi({ token, onUnauthorized }: ClientOptions) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
      return await api<T>(path, { ...init, token });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized?.();
      throw err;
    }
  }
  const get = <T,>(path: string) => call<T>(path);
  const post = <T,>(path: string, body?: unknown) =>
    call<T>(path, { method: "POST", body: body === undefined ? undefined : json(body) });
  const patch = <T,>(path: string, body: unknown) => call<T>(path, { method: "PATCH", body: json(body) });
  const put = <T,>(path: string, body: unknown) => call<T>(path, { method: "PUT", body: json(body) });
  const del = <T,>(path: string) => call<T>(path, { method: "DELETE" });
  const blob = (path: string) => apiBlob(path, token);

  return {
    auth: {
      me: () => get<AdminUser>("/auth/me"),
      changePassword: (body: { currentPassword: string; newPassword: string }) =>
        post<{ ok: true }>("/auth/change-password", body),
      updateAccount: (body: {
        currentPassword: string;
        name?: string;
        email?: string;
        newPassword?: string;
      }) =>
        patch<{ user: AdminUser; token?: string }>("/auth/account", body),
      forgotPassword: (email: string) =>
        post<{ ok: true; message: string }>("/auth/forgot-password", { email }),
      verifyResetToken: (token: string) =>
        get<{ valid: boolean; email?: string; message?: string }>(
          `/auth/verify-reset-token?token=${encodeURIComponent(token)}`,
        ),
      resetPassword: (token: string, newPassword: string) =>
        post<{ ok: true; message: string }>("/auth/reset-password", { token, newPassword }),
      revokeAllSessions: () => post<{ ok: true }>("/auth/revoke-sessions"),
    },

    dashboard: {
      get: (params?: { weekStart?: string }) =>
        get<DashboardData>(`/admin/dashboard${qs(params ?? {})}`),
      revenue: (params?: { weekStart?: string }) =>
        get<DashboardData["weeklyRevenue"]>(`/admin/dashboard/revenue${qs(params ?? {})}`),
    },

    bookings: {
      packages: () => get<PackageOption[]>("/admin/packages"),
      stats: () => get<BookingsDeskStats>("/admin/bookings/stats"),
      availability: (date: string, durationMinutes: number) =>
        get<AvailabilityResponse>(`/admin/availability${qs({ date, durationMinutes })}`),
      byDay: (date: string) => get<BookingRecord[]>(`/admin/bookings${qs({ date })}`),
      range: (params: { from: string; to: string; status?: BookingStatus | ""; q?: string }) =>
        get<BookingRecord[]>(`/admin/bookings/range${qs(params)}`),
      get: (id: string) => get<BookingRecord>(`/admin/bookings/${id}`),
      create: (body: {
        customerName: string;
        customerPhone: string;
        customerEmail: string;
        packageId: string;
        startTime: string;
        source: "WALK_IN" | "ADMIN";
        notes?: string;
      }) => post<BookingRecord>("/admin/bookings", body),
      /** Studio Mark Paid — records cash/POS/transfer payment for outstanding amount or custom deposit. */
      recordPayment: (
        id: string,
        body?: {
          amountKobo?: number;
          channel?: "CASH" | "POS" | "TRANSFER";
          reference?: string;
          note?: string;
        },
      ) => post<BookingRecord>(`/admin/bookings/${id}/payment`, body ?? {}),
      setStatus: (id: string, status: "COMPLETED" | "NO_SHOW" | "CANCELLED") =>
        patch<BookingRecord>(`/admin/bookings/${id}/status`, { status }),
      update: (id: string, body: { notes?: string }) => patch<BookingRecord>(`/admin/bookings/${id}`, body),
      reschedule: (id: string, startTime: string) =>
        post<BookingRecord>(`/admin/bookings/${id}/reschedule`, { startTime }),
    },

    customers: {
      summary: () => get<CustomersSummary>("/admin/customers/summary"),
      list: (params: {
        q?: string;
        page?: number;
        pageSize?: number;
        tag?: string;
        status?: "active" | "inactive" | "";
      }) => get<Paginated<CustomerListItem>>(`/admin/customers${qs(params)}`),
      get: (id: string) => get<CustomerDetail>(`/admin/customers/${id}`),
      update: (id: string, body: { name?: string; email?: string | null; notes?: string; tags?: string[] }) =>
        patch<CustomerDetail>(`/admin/customers/${id}`, body),
      exportCsv: () => blob("/admin/customers/export.csv"),
    },

    enquiries: {
      summary: () => get<EnquiriesSummary>("/admin/enquiries/summary"),
      list: (params: {
        status?: EnquiryStatus | "";
        q?: string;
        page?: number;
        pageSize?: number;
      }) => get<Paginated<Enquiry>>(`/admin/enquiries${qs(params)}`),
      get: (id: string) => get<Enquiry>(`/admin/enquiries/${id}`),
      update: (id: string, body: { status?: EnquiryStatus; internalNote?: string }) =>
        patch<Enquiry>(`/admin/enquiries/${id}`, body),
      reply: (id: string, body: { replyMessage: string; subject?: string }) =>
        post<Enquiry>(`/admin/enquiries/${id}/reply`, body),
      remove: (id: string) => del<{ ok: true }>(`/admin/enquiries/${id}`),
    },

    services: {
      list: () => get<Service[]>("/admin/services"),
      create: (body: {
        slug?: string;
        name: string;
        kind: ServiceKind;
        summary?: string;
        description: string;
        startingPriceKobo: number;
        isActive?: boolean;
        isProvisional?: boolean;
        mediaId?: string | null;
      }) => post<Service>("/admin/services", body),
      update: (id: string, body: Partial<Omit<Service, "id" | "packages" | "media">> & { mediaId?: string | null }) =>
        patch<Service>(`/admin/services/${id}`, body),
      remove: (id: string) => del<{ ok: true }>(`/admin/services/${id}`),
      reorder: (ids: string[]) => post<{ ok: true }>("/admin/services/reorder", { ids }),
      createPackage: (
        serviceId: string,
        body: {
          name: string;
          durationMinutes: number;
          outfitCount?: number | null;
          backdropCount?: number | null;
          editedPhotoCount?: number | null;
          includes?: string;
          priceKobo: number;
          isActive?: boolean;
          isProvisional?: boolean;
        },
      ) => post<Package>(`/admin/services/${serviceId}/packages`, body),
      updatePackage: (id: string, body: Partial<Omit<Package, "id" | "service">>) =>
        patch<Package>(`/admin/packages/${id}`, body),
      removePackage: (id: string) => del<{ ok: true }>(`/admin/packages/${id}`),
      reorderPackages: (ids: string[]) => post<{ ok: true }>("/admin/packages/reorder", { ids }),
      approvePricing: (id: string) => post<Service>(`/admin/services/${id}/approve-pricing`),
      approveAllPricing: () => post<{ ok: true }>("/admin/services/approve-all-pricing"),
    },

    pricingRules: {
      list: () => get<PricingRule[]>("/admin/pricing-rules"),
      update: (key: string, body: { bps?: number; isActive?: boolean }) =>
        patch<PricingRule>(`/admin/pricing-rules/${key}`, body),
    },

    gallery: {
      list: (params?: {
        kind?: MediaKind;
        isActive?: boolean;
        featured?: boolean;
        category?: string;
        q?: string;
        page?: number;
        pageSize?: number;
      }) =>
        get<Paginated<GalleryImage> & { counts?: { active: number; featured: number; inactive: number } }>(
          `/admin/gallery${qs(params)}`,
        ),
      upload: (formData: FormData, onProgress?: (percent: number) => void) =>
        apiUpload<GalleryImage[]>("/admin/gallery/upload", formData, token, onProgress),
      update: (
        id: string,
        body: {
          alt?: string;
          category?: string;
          featured?: boolean;
          isActive?: boolean;
          sortOrder?: number;
          mediaId?: string | null;
        },
      ) => patch<GalleryImage>(`/admin/gallery/${id}`, body),
      remove: (id: string) => del<{ ok: true }>(`/admin/gallery/${id}`),
      reorder: (ids: string[]) => post<{ ok: true }>("/admin/gallery/reorder", { ids }),
    },

    settings: {
      get: () => get<SettingsMap>("/admin/settings"),
      put: (values: SettingsMap) => put<SettingsMap>("/admin/settings", values),
    },

    testimonials: {
      list: () => get<Testimonial[]>("/admin/testimonials"),
      create: (body: Omit<Testimonial, "id" | "media"> & { mediaId?: string | null }) =>
        post<Testimonial>("/admin/testimonials", body),
      update: (id: string, body: Partial<Omit<Testimonial, "id" | "media">> & { mediaId?: string | null }) =>
        patch<Testimonial>(`/admin/testimonials/${id}`, body),
      remove: (id: string) => del<{ ok: true }>(`/admin/testimonials/${id}`),
      reorder: (ids: string[]) => post<{ ok: true }>("/admin/testimonials/reorder", { ids }),
    },

    faqs: {
      list: () => get<Faq[]>("/admin/faqs"),
      create: (body: Omit<Faq, "id">) => post<Faq>("/admin/faqs", body),
      update: (id: string, body: Partial<Omit<Faq, "id">>) => patch<Faq>(`/admin/faqs/${id}`, body),
      remove: (id: string) => del<{ ok: true }>(`/admin/faqs/${id}`),
      reorder: (ids: string[]) => post<{ ok: true }>("/admin/faqs/reorder", { ids }),
    },

    blog: {
      list: (params: { page?: number; pageSize?: number; q?: string }) =>
        get<Paginated<BlogPost>>(`/admin/blog${qs(params)}`),
      get: (id: string) => get<BlogPost>(`/admin/blog/${id}`),
      create: (body: {
        title: string;
        slug?: string;
        excerpt: string;
        content: string;
        coverImageUrl?: string | null;
        metaTitle?: string | null;
        metaDescription?: string | null;
        ogImageUrl?: string | null;
        tags?: string[];
        isPublished?: boolean;
      }) => post<BlogPost>("/admin/blog", body),
      update: (id: string, body: Partial<Omit<BlogPost, "id" | "createdAt" | "updatedAt">>) =>
        patch<BlogPost>(`/admin/blog/${id}`, body),
      remove: (id: string) => del<{ ok: true }>(`/admin/blog/${id}`),
    },

    payments: {
      list: (params: {
        from?: string;
        to?: string;
        status?: PaymentStatus | "";
        method?: PaymentMethod | "";
        q?: string;
        page?: number;
        pageSize?: number;
      }) => get<Paginated<Payment>>(`/admin/payments${qs(params)}`),
      summary: (params: { from?: string; to?: string }) =>
        get<PaymentsSummary>(`/admin/payments/summary${qs(params)}`),
      integration: () => get<PaymentIntegrationStatus>("/admin/payments/integration"),
      exportCsv: (params: { from?: string; to?: string }) => blob(`/admin/payments/export.csv${qs(params)}`),
      refund: (id: string, body: { amountKobo?: number; reason: string }) =>
        post<{ payment: Payment; refundedAmountKobo: number; status: PaymentStatus }>(
          `/admin/payments/${id}/refund`,
          body,
        ),
    },

    notifications: {
      settings: () => get<NotificationSettings>("/admin/notifications/settings"),
      putSettings: (body: { recipients: string[]; reminder24h: boolean; reminder2h: boolean }) =>
        put<NotificationSettings>("/admin/notifications/settings", body),
      logs: (params: { page?: number; pageSize?: number }) =>
        get<Paginated<NotificationLog>>(`/admin/notifications/logs${qs(params)}`),
      test: () => post<{ ok: true; dryRun?: boolean }>("/admin/notifications/test"),
      sendManual: (body: {
        to: string;
        subject: string;
        message: string;
        customerName?: string;
      }) => post<{ ok: true }>("/admin/notifications/send-manual", body),
      templates: () => get<NotificationTemplate[]>("/admin/notifications/templates"),
    },

    users: {
      list: () => get<AdminUser[]>("/admin/users"),
      create: (body: {
        email?: string;
        name: string;
        role: Role;
        password: string;
        fullAccess?: boolean;
        permissions?: string[];
      }) => post<AdminUser>("/admin/users", body),
      update: (
        id: string,
        body: {
          email?: string;
          name?: string;
          role?: Role;
          isActive?: boolean;
          fullAccess?: boolean;
          permissions?: string[];
        },
      ) => patch<AdminUser>(`/admin/users/${id}`, body),
      resetPassword: (id: string, password: string) =>
        post<{ ok: true }>(`/admin/users/${id}/reset-password`, { password }),
      revokeSessions: (id: string) => post<{ ok: true }>(`/admin/users/${id}/revoke-sessions`),
      remove: (id: string) => del<AdminUser>(`/admin/users/${id}`),
    },

    audit: {
      list: (params: { page?: number; pageSize?: number; entity?: string; q?: string }) =>
        get<Paginated<AuditLog>>(`/admin/audit${qs(params)}`),
    },

    newsletter: {
      list: (params: { page?: number; pageSize?: number }) =>
        get<Paginated<NewsletterSubscriber>>(`/admin/newsletter${qs(params)}`),
      remove: (id: string) => del<{ ok: true }>(`/admin/newsletter/${id}`),
      exportCsv: () => blob("/admin/newsletter/export.csv"),
    },
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;

/** Bound client for the signed-in user. A 401 response signs the user out. */
export function useAdminApi(): AdminApi {
  const { token, logout } = useAuth();
  return useMemo(() => createAdminApi({ token, onUnauthorized: logout }), [token, logout]);
}
