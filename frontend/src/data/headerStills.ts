/**
 * Full-bleed banners — each page uses its photo across the entire header
 * via object-cover (no side panels, no pre-cropped strips).
 */
export type HeaderStill = {
  src: string;
  /** Face / subject placement within the full-bleed cover. */
  objectPosition: string;
};

export const PORTFOLIO_PAGE_HEADER: HeaderStill = {
  src: "/media/portfolio-header-portrait.png?v=11",
  objectPosition: "70% 24%",
};

export const BOOK_PAGE_HEADER: HeaderStill = {
  src: "/gallery/14-corporate.jpg",
  objectPosition: "65% 20%",
};

const BY_PATH: Record<string, HeaderStill> = {
  "/about": { src: "/gallery/09-portraits.jpg", objectPosition: "60% 22%" },
  "/book": BOOK_PAGE_HEADER,
  "/book/confirmation": { src: "/gallery/08-portraits.jpg", objectPosition: "55% 22%" },
  "/contact": { src: "/gallery/07-portraits.jpg", objectPosition: "55% 20%" },
  "/faq": { src: "/gallery/06-portraits.jpg", objectPosition: "52% 20%" },
  "/blog": { src: "/gallery/11-corporate.jpg", objectPosition: "60% 16%" },
  "/policies": { src: "/gallery/03-birthdays.jpg", objectPosition: "55% 12%" },
  "/terms": { src: "/gallery/12-corporate.jpg", objectPosition: "62% 14%" },
  "/privacy": { src: "/gallery/16-kids.jpg", objectPosition: "55% 12%" },
  "/cookies": { src: "/gallery/10-corporate.jpg", objectPosition: "60% 14%" },
  "/portfolio": PORTFOLIO_PAGE_HEADER,
  "/gallery": PORTFOLIO_PAGE_HEADER,
};

const FALLBACK_POOL: HeaderStill[] = [
  { src: "/gallery/04-birthdays.jpg", objectPosition: "center 14%" },
  { src: "/gallery/05-birthdays.jpg", objectPosition: "center 14%" },
  { src: "/gallery/15-kids.jpg", objectPosition: "center 14%" },
  { src: "/gallery/17-kids.jpg", objectPosition: "center 14%" },
  { src: "/gallery/19-kids.jpg", objectPosition: "center 12%" },
  { src: "/gallery/20-kids.jpg", objectPosition: "center 14%" },
  { src: "/gallery/21-kids.jpg", objectPosition: "center 14%" },
  { src: "/gallery/22-kids.jpg", objectPosition: "center 12%" },
];

export function headerStillForPath(pathname: string): HeaderStill {
  const key = (pathname.replace(/\/+$/, "") || "/") as string;
  const exact = BY_PATH[key];
  if (exact) return exact;

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_POOL[hash % FALLBACK_POOL.length];
}
