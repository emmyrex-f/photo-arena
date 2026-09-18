/**
 * Per-page SEO via react-helmet-async.
 * <Seo title="Services" description="…" path="/services" image="/og.jpg" />
 */
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useSetting } from "./settings";
import { site } from "./site";

type SeoProps = {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  publishedTime?: string;
  children?: ReactNode;
};

function absolute(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${site.url}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function Seo({ title, description, image, path, type = "website", noIndex = false, publishedTime, children }: SeoProps) {
  const defaultTitle = useSetting("seo.defaultTitle");
  const defaultDescription = useSetting("seo.defaultDescription");
  const defaultImage = useSetting("seo.ogImage");
  const siteName = useSetting("site.name");

  const fullTitle = title ? `${title} — ${siteName}` : defaultTitle;
  const desc = description ?? defaultDescription;
  const img = absolute(image ?? defaultImage);
  const canonical = path ? absolute(path) : undefined;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:locale" content="en_NG" />
      {publishedTime ? <meta property="article:published_time" content={publishedTime} /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      {children}
    </Helmet>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}

/** LocalBusiness / PhotographyBusiness structured data for the home page. */
export function useLocalBusinessJsonLd() {
  const name = useSetting("site.name");
  const phone = useSetting("site.phone");
  const email = useSetting("site.email");
  const description = useSetting("seo.defaultDescription");
  const image = useSetting("seo.ogImage");
  const instagram = useSetting("social.instagram");
  const facebook = useSetting("social.facebook");
  const tiktok = useSetting("social.tiktok");

  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `+234${digits.slice(1)}` : `+${digits}`;

  return {
    "@context": "https://schema.org",
    "@type": ["PhotographyBusiness", "LocalBusiness"],
    "@id": `${site.url}/#business`,
    name,
    url: site.url,
    image: absolute(image),
    logo: absolute("/logo-on-light.png"),
    description,
    telephone: intl,
    email,
    priceRange: "₦₦",
    currenciesAccepted: "NGN",
    paymentAccepted: "Cash, Bank transfer, Card",
    address: {
      "@type": "PostalAddress",
      streetAddress: `${site.address.line1}, ${site.address.line2}`,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      addressCountry: "NG",
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "08:00",
        closes: "18:00",
      },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "12:00", closes: "18:00" },
    ],
    sameAs: [instagram, facebook, tiktok].filter(Boolean),
    potentialAction: { "@type": "ReserveAction", target: `${site.url}/book` },
  };
}
