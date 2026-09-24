import { BookingCtaSection } from "../components/home/BookingCtaSection";
import { HeroSection } from "../components/home/HeroSection";
import { HomeAboutSection } from "../components/home/HomeAboutSection";
import { PortfolioPreviewSection } from "../components/home/PortfolioPreviewSection";
import { ServicesPreviewSection } from "../components/home/ServicesPreviewSection";
import { StudioTourSection } from "../components/home/StudioTourSection";
import { TestimonialsSection } from "../components/home/TestimonialsSection";
import { JsonLd, Seo, useLocalBusinessJsonLd } from "../lib/seo";

export function HomePage() {
  const localBusiness = useLocalBusinessJsonLd();

  return (
    <>
      <Seo path="/" />
      <JsonLd data={localBusiness} />
      <HeroSection />
      <HomeAboutSection />
      <ServicesPreviewSection />
      <PortfolioPreviewSection />
      <StudioTourSection />
      <TestimonialsSection />
      <BookingCtaSection />
    </>
  );
}
