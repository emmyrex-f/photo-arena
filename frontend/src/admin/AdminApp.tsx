import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { AdminThemeProvider } from "./lib/theme";
import { AdminLayout } from "../components/admin/AdminLayout";
import { AdminLoginPage } from "../pages/admin/AdminLoginPage";
import { AdminForgotPasswordPage } from "../pages/admin/AdminForgotPasswordPage";
import { AdminResetPasswordPage } from "../pages/admin/AdminResetPasswordPage";
import { AdminAuditPage } from "../pages/admin/AdminAuditPage";
import { AdminBlogEditorPage } from "../pages/admin/AdminBlogEditorPage";
import { AdminBlogPage } from "../pages/admin/AdminBlogPage";
import { AdminBookingsPage } from "../pages/admin/AdminBookingsPage";
import { AdminContentPage } from "../pages/admin/AdminContentPage";
import { AdminCustomersPage } from "../pages/admin/AdminCustomersPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminEnquiriesPage } from "../pages/admin/AdminEnquiriesPage";
import { AdminGalleryPage } from "../pages/admin/AdminGalleryPage";
import { AdminNotificationsPage } from "../pages/admin/AdminNotificationsPage";
import { AdminPaymentsPage } from "../pages/admin/AdminPaymentsPage";
import { AdminPortfolioPage } from "../pages/admin/AdminPortfolioPage";
import { AdminServicesPage } from "../pages/admin/AdminServicesPage";
import { AdminSettingsPage } from "../pages/admin/AdminSettingsPage";
import { AdminTestimonialsPage } from "../pages/admin/AdminTestimonialsPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import "./admin.css";

function CustomerIdRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/admin/customers?id=${id}` : "/admin/customers"} replace />;
}

/**
 * Admin portal — new build series.
 * All desk modules are live; blank stubs retired.
 */
export function AdminApp() {
  return (
    <AdminThemeProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route path="forgot-password" element={<AdminForgotPasswordPage />} />
        <Route path="reset-password" element={<AdminResetPasswordPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="calendar" element={<Navigate to="/admin/bookings" replace />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="customers/:id" element={<CustomerIdRedirect />} />
          <Route path="enquiries" element={<AdminEnquiriesPage />} />
          <Route path="messages" element={<Navigate to="/admin/enquiries" replace />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="packages" element={<Navigate to="/admin/services" replace />} />
          <Route path="gallery" element={<AdminGalleryPage />} />
          <Route path="portfolio" element={<AdminPortfolioPage />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="testimonials" element={<AdminTestimonialsPage />} />
          <Route path="blog" element={<AdminBlogPage />} />
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
