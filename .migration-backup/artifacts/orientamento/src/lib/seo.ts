import { useEffect } from "react";
import i18n from "i18next";

const LANG_TO_OG_LOCALE: Record<string, string> = {
  it: "it_IT",
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
};

const SITE_URL = "https://northstar.app";
const DEFAULT_IMAGE = `${SITE_URL}/opengraph.jpg`;

export interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  canonicalPath?: string;
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
  canonicalPath,
  type = "website",
  image,
  imageAlt,
  jsonLd,
  noIndex = false,
}: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} | NorthStar`;
    const resolvedPath = canonicalPath ?? path;
    const fullUrl = resolvedPath ? `${SITE_URL}${resolvedPath}` : SITE_URL;
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
    // Resolve OG locale from current i18n language; default to English for non-IT locales
    setMeta("property", "og:locale", LANG_TO_OG_LOCALE[i18n.language] ?? "en_US");
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
  }, [title, description, path, canonicalPath, type, image, imageAlt, noIndex]);
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
  const salaryMin = Math.round(sector.avgSalaryMin / 1000);
  const salaryMax = Math.round(sector.avgSalaryMax / 1000);

  const trendLabel = i18n.t(`confronta.trend.${sector.trend}`, { defaultValue: sector.trend });
  const riskLabel = i18n.t(`confronta.risk.${sector.automationRisk}`, { defaultValue: "" });

  const description =
    `${sector.description.slice(0, 120).replace(/\.$/, "")}. ` +
    i18n.t("seo.sectorDescSuffix", {
      min: salaryMin, max: salaryMax, rate: sector.growthRate,
      trend: trendLabel, risk: riskLabel,
    });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Occupation",
    "@id": `${SITE_URL}/settore/${sector.id}`,
    name: sector.name,
    description: sector.description,
    // NorthStar serves European users — occupationLocation broadened to Europe
    occupationLocation: {
      "@type": "Continent",
      name: "Europe",
    },
    estimatedSalary: {
      "@type": "MonetaryAmountDistribution",
      name: i18n.t("seo.sectorJsonLdSalary"),
      currency: "EUR",
      duration: "P1Y",
      minValue: sector.avgSalaryMin,
      maxValue: sector.avgSalaryMax,
    },
    skills: sector.riasecTypes.join(", "),
  };

  return {
    title: i18n.t("seo.sectorTitle", { name: sector.name }),
    description,
    path: `/settore/${sector.id}`,
    type: "article",
    image: `${SITE_URL}/api/og-image/settore/${sector.id}`,
    imageAlt: i18n.t("seo.sectorImageAlt", { name: sector.name }),
    jsonLd,
  };
}
