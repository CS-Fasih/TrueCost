import crypto from "node:crypto";
import type { ParsedProductUrl, PricePoint, ProviderProductResult, RetailerOffer } from "../types";
import { siteLabel } from "../utils/urlParser";

const productImages = [
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80"
];

function seedNumber(key: string) {
  return crypto.createHash("sha256").update(key).digest().readUInt32BE(0);
}

function seededNoise(seed: number, index: number) {
  const x = Math.sin(seed + index * 99.37) * 10000;
  return x - Math.floor(x);
}

function currencyForSite(site: ParsedProductUrl["site"]) {
  if (site === "flipkart") return "INR";
  if (site === "shopee" || site === "lazada") return "USD";
  return "USD";
}

export function buildDemoProductResult(parsed: ParsedProductUrl): ProviderProductResult {
  const seed = seedNumber(parsed.canonicalUrl);
  const currency = currencyForSite(parsed.site);
  const basePrice = parsed.site === "flipkart" ? 8500 + (seed % 50000) : 89 + (seed % 700);
  const today = new Date();
  const history: PricePoint[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - index), 1));
    const wave = Math.sin(index / 1.8) * 0.11;
    const noise = (seededNoise(seed, index) - 0.5) * 0.12;
    const price = Math.max(5, basePrice * (1 + wave + noise));
    return {
      observedAt: date.toISOString(),
      price: Math.round(price * 100) / 100,
      currency,
      source: "demo"
    };
  });
  const currentPrice = history.at(-1)?.price ?? basePrice;

  return {
    name: `${siteLabel(parsed.site)} Smart Product ${parsed.externalId?.slice(-6) ?? seed.toString().slice(-6)}`,
    imageUrl: productImages[seed % productImages.length],
    currentPrice,
    currency,
    history,
    source: "demo",
    messages: ["Using deterministic demo data because live product fetching could not return current retailer data."]
  };
}

export function buildDemoOffers(productName: string, currency: string, currentPrice: number): RetailerOffer[] {
  const retailers = ["Amazon", "Shopee", "Lazada", "Flipkart"];
  const seed = seedNumber(productName);
  return retailers.map((retailer, index) => {
    const adjustment = 0.9 + seededNoise(seed, index) * 0.25;
    const price = Math.round(currentPrice * adjustment * 100) / 100;
    return {
      retailer,
      title: productName,
      price,
      currency,
      url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(productName)}`,
      imageUrl: productImages[(seed + index) % productImages.length],
      fetchedAt: new Date().toISOString()
    };
  });
}
