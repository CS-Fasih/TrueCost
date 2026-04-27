import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { config as defaultConfig, type AppConfig } from "./config";
import { createStore, type Store } from "./db";
import { AppError, isAppError } from "./errors";
import { Analyzer } from "./services/analyzer";
import { computeVerdict } from "./services/verdict";

const analyzeSchema = z.object({
  url: z.string().url()
});

const alertSchema = z.object({
  productId: z.string().min(4),
  email: z.string().email(),
  targetPrice: z.coerce.number().positive()
});

const corsOrigin = (originSetting: string) => {
  if (originSetting === "*") return true;
  return originSetting.split(",").map((origin) => origin.trim());
};

export function createApp(options: { appConfig?: AppConfig; store?: Store } = {}) {
  const appConfig = options.appConfig ?? defaultConfig;
  const store = options.store ?? createStore(appConfig);
  const analyzer = new Analyzer(store, appConfig);
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigin(appConfig.clientOrigin), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(appConfig.nodeEnv === "test" ? "tiny" : "combined"));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "truecost-api" });
  });

  app.post("/api/analyze", async (request, response, next) => {
    try {
      const { url } = analyzeSchema.parse(request.body);
      response.json(await analyzer.analyze(url));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/recent", async (_request, response, next) => {
    try {
      response.json({ products: await store.getRecent(6) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/products/:id", async (request, response, next) => {
    try {
      const bundle = await store.getProductBundle(request.params.id);
      if (!bundle) throw new AppError(404, "PRODUCT_NOT_FOUND", "This product has not been analyzed yet.");
      response.json({
        ...bundle,
        verdict: computeVerdict(bundle.product.currentPrice, bundle.history, appConfig.saleSeasonWindowDays),
        supportedSite: bundle.product.site,
        dataQuality: {
          isDemo: bundle.product.isDemo,
          historyQuality: bundle.product.isDemo ? "demo" : bundle.history.length < 4 ? "sparse" : "rich",
          messages: bundle.history.length < 4 ? ["History is limited until TrueCost collects more snapshots."] : []
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/alert", async (request, response, next) => {
    try {
      const input = alertSchema.parse(request.body);
      const bundle = await store.getProductBundle(input.productId);
      if (!bundle) throw new AppError(404, "PRODUCT_NOT_FOUND", "Analyze this product before creating an alert.");
      const alert = await store.saveAlert({
        ...input,
        currency: bundle.product.currency
      });
      response.status(201).json({ alert });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the submitted fields and try again.",
          details: error.flatten()
        }
      });
      return;
    }

    if (isAppError(error)) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "TrueCost hit a snag while analyzing this product."
      }
    });
  });

  return { app, store };
}
