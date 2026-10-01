import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminApp } from "./admin/AdminApp";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { SiteLayout } from "./components/layout/SiteLayout";
import { ModalProvider } from "./components/ui/ModalProvider";
import { AuthProvider } from "./lib/auth";
import { AboutPage } from "./pages/AboutPage";
import { BlogPage } from "./pages/BlogPage";
import { BlogPostPage } from "./pages/BlogPostPage";
import { BookConfirmationPage } from "./pages/BookConfirmationPage";
import { BookingLookupPage } from "./pages/BookingLookupPage";
import { BookPage } from "./pages/BookPage";
import { ContactPage } from "./pages/ContactPage";
import { CookiesPage } from "./pages/CookiesPage";
import { FaqPage } from "./pages/FaqPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ServicesPage } from "./pages/ServicesPage";
import { TermsPage } from "./pages/TermsPage";

export function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <BrowserRouter>
          <ScrollToTop />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-text-on-accent focus-visible:not-sr-only"
          >
            Skip to content
          </a>
          <Routes>
            {/* Public site — owned by the public-site build */}
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="gallery" element={<Navigate to="/portfolio" replace />} />
              <Route path="book" element={<BookPage />} />
              <Route path="book/confirmation" element={<BookConfirmationPage />} />
              <Route path="booking/lookup" element={<BookingLookupPage />} />
              <Route path="bookings/lookup" element={<Navigate to="/booking/lookup" replace />} />
              <Route path="bookings" element={<Navigate to="/book" replace />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="faq" element={<FaqPage />} />
              <Route path="blog" element={<BlogPage />} />
              <Route path="blog/:slug" element={<BlogPostPage />} />
              <Route path="policies" element={<PoliciesPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="cookies" element={<CookiesPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Admin portal — all admin routes live inside AdminApp */}
            <Route path="admin/*" element={<AdminApp />} />
          </Routes>
        </BrowserRouter>
      </ModalProvider>
    </AuthProvider>
  );
}
