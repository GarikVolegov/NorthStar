import { useEffect } from "react";

const SITE_URL = "https://northstar.app";
const DEFAULT_IMAGE = `${SITE_URL}/opengraph.jpg`;

export interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  jsonLd?: object;
  noIndex?: boolean;
}

function setMeta(attr: "property" | "name", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(id: string, data: object) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify(data);
  document.head.appendChild(script);
  return () => { script.remove(); };
}

export function usePageMeta({
  title,
  description,
  path,
  type = "website",
  image,
  imageAlt,
  jsonLd,
  noIndex = false,
}: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} | NorthStar`;
    const fullUrl = path ? `${SITE_URL}${path}` : SITE_URL;
    const imgUrl = image ?? DEFAULT_IMAGE;
    const imgAlt = imageAlt ?? title;

    document.title = fullTitle;

    setMeta("name", "description", description);
    setMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    setCanonical(fullUrl);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", fullUrl);
    setMeta("property", "og:type", type);
    setMeta("property", "og:image", imgUrl);
    setMeta("property", "og:image:alt", imgAlt);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:locale", "it_IT");
    setMeta("property", "og:site_name", "NorthStar");

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imgUrl);
    setMeta("name", "twitter:image:alt", imgAlt);

    let cleanup: (() => void) | undefined;
    if (jsonLd) {
      cleanup = setJsonLd("json-ld-page", jsonLd);
    }

    return () => { cleanup?.(); };
  }, [title, description, path, type, image, imageAlt, noIndex]);
}

export function buildSectorMeta(sector: {
  id: number;
  name: string;
  description: string;
  trend: string;
  growthRate: number;
  automationRisk: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  riasecTypes: string[];
}): PageMetaOptions {
  const trendLabel: Record<string, string> = {
    booming: "in forte crescita",
    growing: "in crescita",
    stable: "stabile",
    declining: "in calo",
  };

  const riskLabel: Record<string, string> = {
    low: "basso rischio automazione",
    medium: "rischio automazione medio",
    high: "alto rischio automazione",
  };

  const salaryMin = Math.round(sector.avgSalaryMin / 1000);
  const salaryMax = Math.round(sector.avgSalaryMax / 1000);

  const description =
    `${sector.description.slice(0, 120).replace(/\.$/, "")}. ` +
    `Stipendio medio €${salaryMin}k–${salaryMax}k, crescita annua +${sector.growthRate}%, ` +
    `${trendLabel[sector.trend] ?? sector.trend}, ${riskLabel[sector.automationRisk] ?? ""}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Occupation",
    "@id": `https://northstar.app/settore/${sector.id}`,
    name: sector.name,
    description: sector.description,
    occupationLocation: {
      "@type": "Country",
      name: "Italy",
    },
    estimatedSalary: {
      "@type": "MonetaryAmountDistribution",
      name: "Stipendio annuale (Italia)",
      currency: "EUR",
      duration: "P1Y",
      minValue: sector.avgSalaryMin,
      maxValue: sector.avgSalaryMax,
    },
    skills: sector.riasecTypes.join(", "),
  };

  return {
    title: `${sector.name} — Settore professionale`,
    description,
    path: `/settore/${sector.id}`,
    type: "article",
    jsonLd,
  };
}
