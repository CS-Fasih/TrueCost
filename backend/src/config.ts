import "dotenv/config";

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface AppConfig {
  port: number;
  nodeEnv: string;
  clientOrigin: string;
  databaseUrl?: string;
  demoFallback: boolean;
  keepaApiKey?: string;
  serpApiKey?: string;
  scraperApiKey?: string;
  sendgridApiKey?: string;
  sendgridFromEmail?: string;
  saleSeasonWindowDays: number;
}

export const config: AppConfig = {
  port: parseInteger(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  demoFallback: parseBoolean(process.env.DEMO_FALLBACK, process.env.NODE_ENV !== "production"),
  keepaApiKey: process.env.KEEPA_API_KEY,
  serpApiKey: process.env.SERPAPI_API_KEY,
  scraperApiKey: process.env.SCRAPERAPI_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
  saleSeasonWindowDays: parseInteger(process.env.SALE_SEASON_WINDOW_DAYS, 10)
};
