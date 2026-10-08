/** Portrait cards on /services. Stored as the `services.cards` setting; this list is the fallback. */
export type ServicePageCard = {
  title: string;
  description: string;
  tag: string;
  image: string;
  /** Catalogue slug, or `contact` when the card should open the contact page. */
  link: string;
};

export const DEFAULT_SERVICE_PAGE_CARDS: ServicePageCard[] = [
  {
    title: "Birthday Photography",
    description:
      "Celebrate your special day with stunning, joyful photos that capture the energy, excitement, and pure happiness of your birthday moment.",
    tag: "Walk-In Available",
    image: "/media/services/birthday.jpg",
    link: "personal-birthday",
  },
  {
    title: "Children Photography",
    description:
      "Capture the magic of childhood with fun, vibrant kids' shoots designed to bring out natural smiles and precious expressions in a safe, playful environment.",
    tag: "Family Friendly",
    image: "/media/services/children.jpg",
    link: "bundle-of-joy-0-1",
  },
  {
    title: "Pre-Wedding Photos",
    description:
      "Tell your love story before the big day. Our pre-wedding shoots are intimate, romantic, and beautifully crafted for couples who want something truly special.",
    tag: "Couples",
    image: "/media/services/pre-wedding.jpg",
    link: "pre-wedding",
  },
  {
    title: "Professional Indoor Portraits",
    description:
      "Elevate your personal brand with polished, studio-lit portraits. Perfect for profiles, portfolios, and anyone who wants to look their absolute best.",
    tag: "Studio Quality",
    image: "/media/services/portraits.jpg",
    link: "personal-birthday",
  },
  {
    title: "Passport / Visa Photos",
    description:
      "Get compliant, professional passport and visa photos quickly. We know the requirements so your photos are accepted on the first try — every time.",
    tag: "Same Day Ready",
    image: "/media/services/passport.jpg",
    link: "contact",
  },
  {
    title: "Corporate Headshots",
    description:
      "First impressions matter. Our corporate headshots are sharp, confident, and polished — ideal for LinkedIn, company websites, and executive profiles.",
    tag: "Professional",
    image: "/media/services/corporate.jpg",
    link: "corporate",
  },
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function imagePath(value: unknown): string | null {
  const path = text(value, 500);
  if (!path) return null;
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  if (path.startsWith("https://")) return path;
  return null;
}

export function parseServicePageCards(value: unknown): ServicePageCard[] | null {
  if (!Array.isArray(value)) return null;
  const cards: ServicePageCard[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = text(row.title, 120);
    const description = text(row.description, 600);
    const tag = text(row.tag, 40);
    const image = imagePath(row.image);
    const link = text(row.link, 80);
    if (!title || !description || !tag || !image || !link) continue;
    if (link !== "contact" && !SLUG.test(link)) continue;
    cards.push({ title, description, tag, image, link });
  }
  return cards.length ? cards : null;
}

export function servicePageCardHref(card: ServicePageCard): string {
  return card.link === "contact" ? "/contact" : `/book?service=${card.link}`;
}

export function readServicePageCards(raw: string): ServicePageCard[] {
  if (!raw.trim()) return DEFAULT_SERVICE_PAGE_CARDS;
  try {
    return parseServicePageCards(JSON.parse(raw)) ?? DEFAULT_SERVICE_PAGE_CARDS;
  } catch {
    return DEFAULT_SERVICE_PAGE_CARDS;
  }
}
