import { AppError } from "../errors";
import type { AppConfig } from "../config";
import type { ParsedProductUrl, PricePoint, ProviderProductResult } from "../types";

const DOMAIN_IDS: Record<string, { id: number; currency: string }> = {
  "amazon.com": { id: 1, currency: "USD" },
  "amazon.co.uk": { id: 2, currency: "GBP" },
  "amazon.de": { id: 3, currency: "EUR" },
  "amazon.fr": { id: 4, currency: "EUR" },
  "amazon.co.jp": { id: 5, currency: "JPY" },
  "amazon.ca": { id: 6, currency: "CAD" },
  "amazon.it": { id: 8, currency: "EUR" },
  "amazon.es": { id: 9, currency: "EUR" },
  "amazon.in": { id: 10, currency: "INR" },
  "amazon.com.mx": { id: 11, currency: "MXN" },
  "amazon.com.br": { id: 12, currency: "BRL" }
};

const keepaTimeToDate = (minutes: number) => new Date((minutes + 21_564_000) * 60_000);

function parseKeepaCsv(csv: unknown, currency: string): PricePoint[] {
  if (!Array.isArray(csv)) return [];
  const points: PricePoint[] = [];
  const cutoff = Date.now() - 365 * 86_400_000;

  for (let i = 0; i < csv.length - 1; i += 2) {
    const keepaMinute = Number(csv[i]);
    const rawPrice = Number(csv[i + 1]);
    if (!Number.isFinite(keepaMinute) || !Number.isFinite(rawPrice) || rawPrice <= 0) continue;

    const observedAt = keepaTimeToDate(keepaMinute);
    if (observedAt.getTime() < cutoff) continue;
    points.push({
      observedAt: observedAt.toISOString(),
      price: Math.round((rawPrice / 100) * 100) / 100,
      currency,
      source: "keepa"
    });
  }

  return points;
}

export async function fetchAmazonProduct(parsed: ParsedProductUrl, appConfig: AppConfig): Promise<ProviderProductResult> {
  if (!appConfig.keepaApiKey) {
    throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Keepa API key is not configured.");
  }
  if (!parsed.externalId) {
    throw new AppError(400, "AMAZON_ASIN_MISSING", "This Amazon link does not include a product ASIN.");
  }

  const domain = DOMAIN_IDS[parsed.host] ?? DOMAIN_IDS["amazon.com"];
  const params = new URLSearchParams({
    key: appConfig.keepaApiKey,
    domain: String(domain.id),
    asin: parsed.externalId,
    history: "1",
    stats: "365"
  });

  const response = await fetch(`https://api.keepa.com/product?${params.toString()}`);
  if (!response.ok) {
    throw new AppError(502, "KEEPA_FAILED", "Keepa could not return price history for this product.");
  }

  const payload = (await response.json()) as any;
  const product = payload.products?.[0];
  if (!product) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "Keepa did not find this Amazon product.");
  }

  const history = parseKeepaCsv(product.csv?.[0], domain.currency);
  const fallbackHistory = history.length ? history : parseKeepaCsv(product.csv?.[1], domain.currency);
  const currentFromStats = Number(product.stats?.current?.[1] ?? product.stats?.current?.[0]);
  const currentPrice =
    fallbackHistory.at(-1)?.price ?? (Number.isFinite(currentFromStats) && currentFromStats > 0 ? currentFromStats / 100 : 0);

  if (!currentPrice) {
    throw new AppError(502, "PRICE_UNAVAILABLE", "Keepa returned product data without a usable current price.");
  }

  const imageFile = typeof product.imagesCSV === "string" ? product.imagesCSV.split(",")[0] : null;
  return {
    name: product.title ?? `Amazon product ${parsed.externalId}`,
    imageUrl: imageFile ? `https://m.media-amazon.com/images/I/${imageFile}` : null,
    currentPrice: Math.round(currentPrice * 100) / 100,
    currency: domain.currency,
    history: fallbackHistory,
    source: "keepa",
    messages: []
  };
}
