import { homePreviewImages } from "./serviceMedia";

export type Service = {
  id: string;
  name: string;
  summary: string;
  startingFromLabel: string;
  startingFromKobo: number;
  image?: string;
};

/** Provisional prices from the old website. Not production pricing. */
export const services: Service[] = [
  {
    id: "personal-birthday-corporate",
    name: "Personal / Birthday / Corporate",
    summary:
      "A versatile studio session for individuals — birthdays, portraits, and corporate headshots.",
    startingFromLabel: "From ₦25,000",
    startingFromKobo: 2_500_000,
    image: homePreviewImages["personal-birthday-corporate"],
  },
  {
    id: "bundle-of-joy",
    name: "Bundle of Joy",
    summary: "Kids and baby sessions designed to feel playful, safe, and unhurried.",
    startingFromLabel: "From ₦45,000",
    startingFromKobo: 4_500_000,
    image: homePreviewImages["bundle-of-joy"],
  },
  {
    id: "pre-wedding",
    name: "Pre-Wedding Photoshoots",
    summary: "An intimate couples session before the wedding day.",
    startingFromLabel: "From ₦40,000",
    startingFromKobo: 4_000_000,
    image: homePreviewImages["pre-wedding"],
  },
  {
    id: "space-rental",
    name: "Studio Space Rental",
    summary: "Hourly hire of the studio, lighting, and backdrops for photographers and brands.",
    startingFromLabel: "From ₦40,000/hr",
    startingFromKobo: 4_000_000,
    image: homePreviewImages["space-rental"],
  },
];

export const serviceCategories = [
  {
    id: "birthday",
    name: "Birthday Photography",
    summary:
      "Celebrate the day with studio portraits that hold the energy of the moment.",
  },
  {
    id: "children",
    name: "Children Photography",
    summary: "Natural expressions in a playful, well-lit studio environment.",
  },
  {
    id: "pre-wedding",
    name: "Pre-Wedding Photos",
    summary: "A quieter session for couples before the wedding day.",
  },
  {
    id: "portraits",
    name: "Professional Indoor Portraits",
    summary: "Studio-lit portraits for personal brand, profiles, and portfolios.",
  },
  {
    id: "passport",
    name: "Passport / Visa Photos",
    summary: "Compliant passport and visa photographs, typically printed the same day.",
  },
  {
    id: "corporate",
    name: "Corporate Headshots",
    summary: "Sharp, confident headshots for LinkedIn, websites, and teams.",
  },
] as const;
