import type { AppConfig } from "../config";
import { AppError } from "../errors";
import { createStore, type Store } from "../db";
import { buildDemoOffers, buildDemoProductResult } from "./demoData";
import { computeVerdict } from "./verdict";
import { fetchAmazonProduct } from "../providers/keepa";
import { fetchMarketplaceProduct } from "../providers/scraper";
import { fetchShoppingOffers } from "../providers/serpapi";
import type { AnalyzeResponse, PricePoint, ProductRecord, ProviderProductResult } from "../types";
import { parseProductUrl, productIdFromParsed } from "../utils/urlParser";

const byObservedAt = (a: PricePoint, b: PricePoint) =>
  new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime();

function mergeHistory(existing: PricePoint[], incoming: PricePoint[]) {
  const merged = new Map<string, PricePoint>();
  [...existing, ...incoming].forEach((point) => {
    merged.set(`${point.source}:${point.observedAt}`, point);
  });
  return [...merged.values()].sort(byObservedAt);
}

export class Analyzer {
  private store: Store;
  private appConfig: AppConfig;

  constructor(store: Store, appConfig: AppConfig) {
    this.store = store;
    this.appConfig = appConfig;
  }

  async analyze(url: string): Promise<AnalyzeResponse> {
    const parsed = parseProductUrl(url);
    const productId = productIdFromParsed(parsed);
    const existing = await this.store.getProductBundle(productId);
    const messages: string[] = [];
    let isDemo = false;
    let productResult: ProviderProductResult;

    try {
      productResult =
        parsed.site === "amazon"
          ? await fetchAmazonProduct(parsed, this.appConfig)
          : await fetchMarketplaceProduct(parsed, this.appConfig);
    } catch (error) {
      if (!this.appConfig.demoFallback) throw error;
      productResult = buildDemoProductResult(parsed);
      isDemo = true;
      messages.push(error instanceof Error ? error.message : "Live provider failed; using demo data.");
    }

    let offers = [];
    try {
      offers = await fetchShoppingOffers(productResult.name, productResult.currency, this.appConfig);
    } catch (error) {
      if (!this.appConfig.demoFallback) {
        messages.push(error instanceof Error ? error.message : "Comparison prices are unavailable.");
      }
      offers = buildDemoOffers(productResult.name, productResult.currency, productResult.currentPrice);
      if (this.appConfig.demoFallback) {
        messages.push("Using demo comparison offers because SerpApi is not configured or failed.");
      }
    }

    const now = new Date().toISOString();
    const product: ProductRecord = {
      id: productId,
      site: parsed.site,
      url: parsed.canonicalUrl,
      externalId: parsed.externalId,
      name: productResult.name,
      imageUrl: productResult.imageUrl,
      currentPrice: productResult.currentPrice,
      currency: productResult.currency,
      isDemo,
      createdAt: existing?.product.createdAt ?? now,
      updatedAt: now
    };

    const incomingHistory =
      parsed.site === "amazon" && productResult.history.length > 1
        ? productResult.history
        : mergeHistory(existing?.history ?? [], productResult.history);

    await this.store.saveAnalysis(product, incomingHistory, offers);
    const saved = await this.store.getProductBundle(productId);
    if (!saved) {
      throw new AppError(500, "SAVE_FAILED", "TrueCost could not save the analyzed product.");
    }

    const verdict = computeVerdict(
      saved.product.currentPrice,
      saved.history,
      this.appConfig.saleSeasonWindowDays
    );
    const isHistorySparse = saved.history.length < 4;

    return {
      product: saved.product,
      history: saved.history,
      offers: saved.offers,
      verdict,
      supportedSite: parsed.site,
      dataQuality: {
        isDemo: saved.product.isDemo || saved.history.some((point) => point.source === "demo"),
        historyQuality: saved.product.isDemo ? "demo" : isHistorySparse ? "sparse" : "rich",
        messages: [...productResult.messages, ...messages]
      }
    };
  }
}

export function createAnalyzer(appConfig: AppConfig, store = createStore(appConfig)) {
  return new Analyzer(store, appConfig);
}
