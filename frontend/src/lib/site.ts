export const site = {
  name: "Photo Arena",
  tagline: "Port Harcourt's premier walk-in portrait studio.",
  phone: "09059813823",
  phoneHref: "tel:+2349059813823",
  email: "photoarenang@gmail.com",
  emailHref: "mailto:photoarenang@gmail.com",
  whatsapp: "https://api.whatsapp.com/send/?phone=2349059813823",
  instagram: "https://www.instagram.com/photoarenang",
  instagramHandle: "@photoarenang",
  facebook: "https://www.facebook.com/share/1DKYw3rfJK/",
  tiktok: "https://www.tiktok.com/@photoarenang",
  domain: "photoarenang.com",
  url: "https://photoarenang.com",
  address: {
    line1: "10 Prof Okujagu Street",
    line2: "off Peter Odili Road",
    city: "Port Harcourt",
    state: "Rivers State",
    country: "Nigeria",
    full: "10 Prof Okujagu Street, off Peter Odili Road, Port Harcourt",
  },
  geo: { lat: 4.808, lng: 7.023 },
  hours: [
    { days: "Monday – Saturday", time: "8:00 AM – 6:00 PM" },
    { days: "Sunday", time: "12:00 PM – 6:00 PM" },
  ],
  hoursWeekday: "8:00 AM – 6:00 PM",
  hoursSunday: "12:00 PM – 6:00 PM",
  mapEmbed:
    "https://www.openstreetmap.org/export/embed.html?bbox=7.013%2C4.798%2C7.033%2C4.818&layer=mapnik&marker=4.808%2C7.023",
  mapLink: "https://www.openstreetmap.org/?mlat=4.808&mlon=7.023#map=17/4.808/7.023",
  onlineDiscountPercent: 5,
  pricesProvisional: true,
  hero: {
    headline: "Where every shot becomes a masterpiece",
    subheadline:
      "Professional lighting, considered sets, and a calm studio on Peter Odili Road. Walk in, or book online and save 5%.",
    videoUrl: "/LANDSCAPE.mp4",
  },
  tour: {
    heading: "Behind the lens — take a tour of our studio",
    body:
      "Before you walk in, walk through. See the backdrops, the lighting and the space — and imagine yourself in the frame.",
    videoUrl: "",
  },
  cta: {
    heading: "Ready to book your session?",
    body:
      "Reserve a studio session online and receive 5% off. Walk-ins are welcome Monday–Saturday 8:00 AM – 6:00 PM and Sunday 12:00 PM – 6:00 PM.",
    buttonLabel: "Book a Session",
    buttonHref: "/book",
  },
  about: {
    headline: "Welcome",
    body: "Photo Arena is a walk-in portrait studio in Port Harcourt. The room, the lights, and the sets are ready. You bring the occasion.",
    imageUrl: "/media/about.jpg",
    ctaLabel: "Read More",
    ctaHref: "/about",
  },
  seo: {
    defaultTitle: "Photo Arena — Port Harcourt Portrait Studio",
    defaultDescription:
      "Photo Arena is a premium walk-in portrait studio in Port Harcourt. Birthdays, portraits, corporate headshots, kids and pre-wedding sessions. Book online and receive 5% off.",
    ogImage: "/og-image.jpg",
  },
} as const;

export const navLinks = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/book", label: "Book Now" },
  { to: "/contact", label: "Contact" },
] as const;

export const exploreLinks = [
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/book", label: "Book Now" },
  { to: "/blog", label: "Journal" },
  { to: "/contact", label: "Contact" },
  { to: "/faq", label: "FAQ" },
] as const;

export const legalLinks = [
  { to: "/policies", label: "Studio policies" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/cookies", label: "Cookies" },
] as const;

/** Legacy alias kept for any consumer that still imports it. */
export const footerLinks = [...navLinks, { to: "/faq", label: "FAQ" }, { to: "/policies", label: "Policies" }] as const;

/** Static list of public routes for sitemap / SEO. */
export const publicRoutes = [
  "/",
  "/about",
  "/services",
  "/portfolio",
  "/book",
  "/contact",
  "/faq",
  "/blog",
  "/policies",
  "/terms",
  "/privacy",
  "/cookies",
] as const;
