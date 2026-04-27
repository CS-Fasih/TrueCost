import * as cheerio from "cheerio";
import { AppError } from "../errors";
import type { ParsedProductUrl, ProviderProductResult } from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function firstText($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const element = $(selector).first();
    const value = element.attr("content") ?? element.attr("data-price") ?? element.text();
    if (value?.trim()) return value.trim();
  }
  return null;
}

function parseJsonLdProduct($: cheerio.CheerioAPI) {
  const scripts = $('script[type="application/ld+json"]')
    .map((_, element) => $(element).contents().text())
    .get();

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script);
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] ?? [])];
      const product = candidates.find((item: any) => {
        const type = item?.["@type"];
        return type === "Product" || (Array.isArray(type) && type.includes("Product"));
      });
      if (product) return product;
    } catch {
      continue;
    }
  }

  return null;
}

function parsePrice(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function detectCurrency(raw: string | null | undefined, site: ParsedProductUrl["site"]) {
  if (raw?.includes("₹") || site === "flipkart") return "INR";
  if (raw?.includes("£")) return "GBP";
  if (raw?.includes("€")) return "EUR";
  if (raw?.match(/\bSGD\b/i)) return "SGD";
  if (raw?.match(/\bPHP\b/i)) return "PHP";
  if (raw?.match(/\bMYR\b/i)) return "MYR";
  return "USD";
}

function cleanTitle(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/\s*[:|-]\s*(Amazon|Shopee|Lazada|Flipkart).*$/i, "")
    .trim();
}

export async function fetchFreeProductSnapshot(parsed: ParsedProductUrl): Promise<ProviderProductResult> {
  const response = await fetch(parsed.canonicalUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new AppError(
      502,
      "FREE_FETCH_FAILED",
      "The free page fetch could not load this product page. Some retailers block direct requests."
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const jsonLdProduct = parseJsonLdProduct($);
  const jsonLdOffer = Array.isArray(jsonLdProduct?.offers) ? jsonLdProduct.offers[0] : jsonLdProduct?.offers;
  const title =
    jsonLdProduct?.name ??
    firstText($, ['meta[property="og:title"]', 'meta[name="title"]', "#productTitle", "h1", "title"]) ??
    "Product";
  const image =
    (Array.isArray(jsonLdProduct?.image) ? jsonLdProduct.image[0] : jsonLdProduct?.image) ??
    firstText($, ['meta[property="og:image"]', 'meta[name="twitter:image"]', "#landingImage", 'img[itemprop="image"]']);
  const priceText =
    jsonLdOffer?.price ??
    firstText($, [
      'meta[property="product:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="price"]',
      ".a-price .a-offscreen",
      "[data-price]",
      '[class*="price"]'
    ]);
  const currentPrice = parsePrice(priceText);

  if (!currentPrice) {
    throw new AppError(
      502,
      "PRICE_UNAVAILABLE",
      "The free page fetch loaded the product, but no usable price was detected."
    );
  }

  const currency = jsonLdOffer?.priceCurrency ?? detectCurrency(typeof priceText === "string" ? priceText : null, parsed.site);
  const observedAt = new Date().toISOString();

  return {
    name: cleanTitle(String(title)),
    imageUrl: image ? String(image) : null,
    currentPrice,
    currency,
    history: [
      {
        observedAt,
        price: currentPrice,
        currency,
        source: "free-page-snapshot"
      }
    ],
    source: "free-page-snapshot",
    messages: [
      "Using free direct page fetching. Price history grows from saved snapshots as the product is checked over time."
    ]
  };
}
