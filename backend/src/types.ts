export type SupportedSite = "amazon" | "shopee" | "lazada" | "flipkart";

export interface ParsedProductUrl {
  site: SupportedSite;
  originalUrl: string;
  canonicalUrl: string;
  externalId: string | null;
  host: string;
}

export interface PricePoint {
  observedAt: string;
  price: number;
  currency: string;
  source: string;
}

export interface RetailerOffer {
  retailer: string;
  title: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string | null;
  fetchedAt: string;
}

export interface ProductRecord {
  id: string;
  site: SupportedSite;
  url: string;
  externalId?: string | null;
  name: string;
  imageUrl?: string | null;
  currentPrice: number;
  currency: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Verdict {
  label: "🟢 Great Deal" | "🟡 Fair Price" | "🔴 Overpriced" | "⏳ Wait — Price Usually Drops";
  tone: "great" | "fair" | "overpriced" | "wait";
  reason: string;
  currentPrice: number;
  averagePrice: number;
  rangeLow: number;
  rangeHigh: number;
}

export interface DataQuality {
  isDemo: boolean;
  historyQuality: "demo" | "sparse" | "rich";
  messages: string[];
}

export interface AnalyzeResponse {
  product: ProductRecord;
  history: PricePoint[];
  offers: RetailerOffer[];
  verdict: Verdict;
  supportedSite: SupportedSite;
  dataQuality: DataQuality;
}

export interface AlertRecord {
  id: number;
  productId: string;
  email: string;
  targetPrice: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  lastNotifiedAt?: string | null;
}

export interface ProductBundle {
  product: ProductRecord;
  history: PricePoint[];
  offers: RetailerOffer[];
}

export interface ProviderProductResult {
  name: string;
  imageUrl?: string | null;
  currentPrice: number;
  currency: string;
  history: PricePoint[];
  source: string;
  messages: string[];
}
