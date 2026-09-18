import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { AdminThemeProvider } from "./lib/theme";
import { AdminLayout } from "../components/admin/AdminLayout";
import { AdminLoginPage } from "../pages/admin/AdminLoginPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminBookingsPage } from "../pages/admin/AdminBookingsPage";
import { AdminCustomersPage } from "../pages/admin/AdminCustomersPage";
import { AdminCustomerDetailPage } from "../pages/admin/AdminCustomerDetailPage";
import { AdminEnquiriesPage } from "../pages/admin/AdminEnquiriesPage";
import { AdminServicesPage } from "../pages/admin/AdminServicesPage";
import { AdminGalleryPage } from "../pages/admin/AdminGalleryPage";
import { AdminContentPage } from "../pages/admin/AdminContentPage";
import { AdminBlogEditorPage } from "../pages/admin/AdminBlogEditorPage";
import { AdminPaymentsPage } from "../pages/admin/AdminPaymentsPage";
import { AdminNotificationsPage } from "../pages/admin/AdminNotificationsPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { AdminAuditPage } from "../pages/admin/AdminAuditPage";
import { AdminSettingsPage } from "../pages/admin/AdminSettingsPage";
import "./admin.css";

/**
 * Admin portal entry. Mounted at `/admin/*` from App.tsx.
 * Everything under src/admin, src/components/admin and src/pages/admin belongs to the admin build.
 */
export function AdminApp() {
  return (
    <AdminThemeProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="calendar" element={<Navigate to="/admin/bookings" replace />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
          <Route path="enquiries" element={<AdminEnquiriesPage />} />
          <Route path="messages" element={<Navigate to="/admin/enquiries" replace />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="packages" element={<Navigate to="/admin/services" replace />} />
          <Route path="gallery" element={<AdminGalleryPage />} />
          <Route path="portfolio" element={<AdminGalleryPage purpose="portfolio" />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="testimonials" element={<AdminContentPage />} />
          <Route path="blog/new" element={<AdminBlogEditorPage />} />
          <Route path="blog/:id" element={<AdminBlogEditorPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      <Toaster />
    </AdminThemeProvider>
  );
}
