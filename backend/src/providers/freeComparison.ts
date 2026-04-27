import type { RetailerOffer } from "../types";

const retailerSearchUrls = [
  ["Amazon", "https://www.amazon.com/s?k="],
  ["Shopee", "https://shopee.com/search?keyword="],
  ["Lazada", "https://www.lazada.com/catalog/?q="],
  ["Flipkart", "https://www.flipkart.com/search?q="]
] as const;

export function buildFreeSearchOffers(query: string): RetailerOffer[] {
  const fetchedAt = new Date().toISOString();
  return retailerSearchUrls.map(([retailer, baseUrl]) => ({
    retailer,
    title: `Search ${retailer} for ${query}`,
    price: null,
    currency: null,
    url: `${baseUrl}${encodeURIComponent(query)}`,
    imageUrl: null,
    fetchedAt
  }));
}
