import * as cheerio from "cheerio";
import { AppError } from "../errors";
import type { AppConfig } from "../config";
import type { ParsedProductUrl, ProviderProductResult } from "../types";

function firstText($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).first().attr("content") ?? $(selector).first().text();
    if (value?.trim()) return value.trim();
  }
  return null;
}

function parsePrice(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function detectCurrency(raw: string | null, site: ParsedProductUrl["site"]) {
  if (raw?.includes("₹") || site === "flipkart") return "INR";
  if (raw?.includes("£")) return "GBP";
  if (raw?.includes("€")) return "EUR";
  if (raw?.match(/\bSGD\b/i)) return "SGD";
  if (raw?.match(/\bPHP\b/i)) return "PHP";
  return "USD";
}

export async function fetchMarketplaceProduct(
  parsed: ParsedProductUrl,
  appConfig: AppConfig
): Promise<ProviderProductResult> {
  if (!appConfig.scraperApiKey) {
    throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "ScraperAPI key is not configured.");
  }

  const params = new URLSearchParams({
    api_key: appConfig.scraperApiKey,
    url: parsed.canonicalUrl,
    render: "true"
  });
  const response = await fetch(`https://api.scraperapi.com?${params.toString()}`);

  if (!response.ok) {
    throw new AppError(502, "SCRAPER_FAILED", "ScraperAPI could not fetch this product page.");
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const title =
    firstText($, [
      'meta[property="og:title"]',
      'meta[name="title"]',
      "h1",
      "title"
    ]) ?? "Marketplace product";
  const imageUrl =
    firstText($, ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'img[itemprop="image"]']) ?? null;
  const priceText = firstText($, [
    'meta[property="product:price:amount"]',
    '[itemprop="price"]',
    '[class*="price"]',
    '[data-price]'
  ]);
  const currentPrice = parsePrice(priceText);

  if (!currentPrice) {
    throw new AppError(502, "PRICE_UNAVAILABLE", "The product page loaded, but no price could be detected.");
  }

  const currency = detectCurrency(priceText, parsed.site);
  return {
    name: title.replace(/\s+/g, " ").trim(),
    imageUrl,
    currentPrice,
    currency,
    history: [
      {
        observedAt: new Date().toISOString(),
        price: currentPrice,
        currency,
        source: "scraperapi"
      }
    ],
    source: "scraperapi",
    messages: ["Only stored TrueCost snapshots are available for this marketplace product."]
  };
}
