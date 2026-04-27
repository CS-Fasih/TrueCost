import type { AlertRecord, PricePoint, ProductBundle, ProductRecord, RetailerOffer } from "../types";

export interface SaveAlertInput {
  productId: string;
  email: string;
  targetPrice: number;
  currency: string;
}

export interface Store {
  ready(): Promise<void>;
  close(): Promise<void>;
  saveAnalysis(product: ProductRecord, history: PricePoint[], offers: RetailerOffer[]): Promise<ProductRecord>;
  getRecent(limit: number): Promise<ProductRecord[]>;
  getProductBundle(productId: string): Promise<ProductBundle | null>;
  saveAlert(input: SaveAlertInput): Promise<AlertRecord>;
  listActiveAlerts(): Promise<AlertRecord[]>;
  markAlertTriggered(alertId: number): Promise<void>;
}
