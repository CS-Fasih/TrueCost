import crypto from "node:crypto";
import { AppError } from "../errors";
import type { ParsedProductUrl, SupportedSite } from "../types";

const AMAZON_ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})(?:[/?]|$)/i;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function parseProductUrl(input: string): ParsedProductUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AppError(400, "INVALID_URL", "Paste a full product URL, including https://.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError(400, "INVALID_URL", "Only http and https product links are supported.");
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;
  const originalUrl = url.toString();

  if (host.includes("amazon.")) {
    const asin = path.match(AMAZON_ASIN_RE)?.[1]?.toUpperCase() ?? null;
    const canonicalUrl = asin ? `https://${host}/dp/${asin}` : stripTrailingSlash(`${url.origin}${path}`);
    return { site: "amazon", originalUrl, canonicalUrl, externalId: asin, host };
  }

  if (host.includes("shopee.")) {
    const match = path.match(/i\.(\d+)\.(\d+)/) ?? path.match(/-i\.(\d+)\.(\d+)/);
    const externalId = match ? `${match[1]}:${match[2]}` : url.searchParams.get("sp_atk");
    return {
      site: "shopee",
      originalUrl,
      canonicalUrl: stripTrailingSlash(`${url.origin}${path}`),
      externalId,
      host
    };
  }

  if (host.includes("lazada.")) {
    const externalId = path.match(/i(\d+)-s(\d+)/i)?.slice(1).join(":") ?? null;
    return {
      site: "lazada",
      originalUrl,
      canonicalUrl: stripTrailingSlash(`${url.origin}${path}`),
      externalId,
      host
    };
  }

  if (host.includes("flipkart.")) {
    const externalId = url.searchParams.get("pid") ?? path.split("/").filter(Boolean).at(-1) ?? null;
    return {
      site: "flipkart",
      originalUrl,
      canonicalUrl: stripTrailingSlash(`${url.origin}${path}`),
      externalId,
      host
    };
  }

  throw new AppError(400, "UNSUPPORTED_URL", "TrueCost currently supports Amazon, Shopee, Lazada, and Flipkart product links.");
}

export function productIdFromParsed(parsed: ParsedProductUrl): string {
  const stableKey = `${parsed.site}:${parsed.externalId ?? parsed.canonicalUrl}`;
  const digest = crypto.createHash("sha256").update(stableKey).digest("hex").slice(0, 16);
  return `prd_${digest}`;
}

export const siteLabel = (site: SupportedSite) => {
  const labels: Record<SupportedSite, string> = {
    amazon: "Amazon",
    shopee: "Shopee",
    lazada: "Lazada",
    flipkart: "Flipkart"
  };
  return labels[site];
};
