import type { AlertRecord, PricePoint, ProductBundle, ProductRecord, RetailerOffer } from "../types";
import type { SaveAlertInput, Store } from "./store";

const byObservedAt = (a: PricePoint, b: PricePoint) =>
  new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime();

function mergeHistory(existing: PricePoint[], incoming: PricePoint[]) {
  const merged = new Map<string, PricePoint>();
  [...existing, ...incoming].forEach((point) => {
    merged.set(`${point.source}:${point.observedAt}`, point);
  });
  return [...merged.values()].sort(byObservedAt);
}

export class MemoryStore implements Store {
  private products = new Map<string, ProductRecord>();
  private history = new Map<string, PricePoint[]>();
  private offers = new Map<string, RetailerOffer[]>();
  private alerts = new Map<number, AlertRecord>();
  private nextAlertId = 1;

  async ready() {
    return undefined;
  }

  async close() {
    return undefined;
  }

  async saveAnalysis(product: ProductRecord, history: PricePoint[], offers: RetailerOffer[]) {
    const now = new Date().toISOString();
    const existing = this.products.get(product.id);
    const saved = {
      ...product,
      createdAt: existing?.createdAt ?? product.createdAt ?? now,
      updatedAt: now
    };
    this.products.set(product.id, saved);
    this.history.set(product.id, mergeHistory(this.history.get(product.id) ?? [], history));
    this.offers.set(product.id, offers);
    return saved;
  }

  async getRecent(limit: number) {
    return [...this.products.values()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  async getProductBundle(productId: string): Promise<ProductBundle | null> {
    const product = this.products.get(productId);
    if (!product) return null;
    return {
      product,
      history: this.history.get(productId) ?? [],
      offers: this.offers.get(productId) ?? []
    };
  }

  async saveAlert(input: SaveAlertInput): Promise<AlertRecord> {
    const alert: AlertRecord = {
      id: this.nextAlertId++,
      productId: input.productId,
      email: input.email,
      targetPrice: input.targetPrice,
      currency: input.currency,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastNotifiedAt: null
    };
    this.alerts.set(alert.id, alert);
    return alert;
  }

  async listActiveAlerts() {
    return [...this.alerts.values()].filter((alert) => alert.isActive);
  }

  async markAlertTriggered(alertId: number) {
    const alert = this.alerts.get(alertId);
    if (!alert) return;
    this.alerts.set(alertId, {
      ...alert,
      isActive: false,
      lastNotifiedAt: new Date().toISOString()
    });
  }
}
