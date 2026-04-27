import { AppError } from "../errors";
import type { AppConfig } from "../config";
import type { RetailerOffer } from "../types";

function parsePrice(raw: unknown) {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function detectCurrency(raw: unknown, fallback: string) {
  if (typeof raw !== "string") return fallback;
  if (raw.includes("₹")) return "INR";
  if (raw.includes("£")) return "GBP";
  if (raw.includes("€")) return "EUR";
  if (raw.match(/\bCAD\b/i)) return "CAD";
  return fallback;
}

export async function fetchShoppingOffers(
  query: string,
  fallbackCurrency: string,
  appConfig: AppConfig
): Promise<RetailerOffer[]> {
  if (!appConfig.serpApiKey) {
    throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "SerpApi key is not configured.");
  }

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: appConfig.serpApiKey,
    gl: "us",
    hl: "en"
  });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) {
    throw new AppError(502, "SERPAPI_FAILED", "SerpApi could not fetch comparison prices.");
  }

  const payload = (await response.json()) as any;
  const results = Array.isArray(payload.shopping_results) ? payload.shopping_results : [];
  return results
    .map((result: any) => {
      const price = parsePrice(result.extracted_price ?? result.price);
      if (!price) return null;
      return {
        retailer: result.source ?? result.seller ?? "Google Shopping",
        title: result.title ?? query,
        price,
        currency: detectCurrency(result.price, fallbackCurrency),
        url: result.link ?? result.product_link ?? `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
        imageUrl: result.thumbnail ?? null,
        fetchedAt: new Date().toISOString()
      } satisfies RetailerOffer;
    })
    .filter((offer: RetailerOffer | null): offer is RetailerOffer => Boolean(offer))
    .slice(0, 8);
}
