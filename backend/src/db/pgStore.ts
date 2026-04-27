import { Pool, PoolClient } from "pg";
import type { AppConfig } from "../config";
import type { AlertRecord, PricePoint, ProductBundle, ProductRecord, RetailerOffer, SupportedSite } from "../types";
import type { SaveAlertInput, Store } from "./store";

const toNumber = (value: unknown) => Number(value);
const toIso = (value: Date | string) => new Date(value).toISOString();

export class PgStore implements Store {
  private pool: Pool;

  constructor(appConfig: AppConfig) {
    if (!appConfig.databaseUrl) throw new Error("DATABASE_URL is required for PgStore.");
    const isLocal = appConfig.databaseUrl.includes("localhost") || appConfig.databaseUrl.includes("127.0.0.1");
    this.pool = new Pool({
      connectionString: appConfig.databaseUrl,
      ssl: isLocal ? undefined : { rejectUnauthorized: false }
    });
  }

  async ready() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        site TEXT NOT NULL,
        source_url TEXT NOT NULL,
        external_id TEXT,
        name TEXT NOT NULL,
        image_url TEXT,
        current_price NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        is_demo BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS price_snapshots (
        id BIGSERIAL PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        price NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        source TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS retailer_offers (
        id BIGSERIAL PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        retailer TEXT NOT NULL,
        title TEXT NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        url TEXT NOT NULL,
        image_url TEXT,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id BIGSERIAL PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        target_price NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_notified_at TIMESTAMPTZ
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS id TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS site TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS current_price NUMERIC(12,2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      CREATE UNIQUE INDEX IF NOT EXISTS products_id_key ON products(id);

      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS id BIGSERIAL;
      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS product_id TEXT;
      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);
      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown';
      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS price_snapshots_product_observed_idx
        ON price_snapshots(product_id, observed_at);

      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS id BIGSERIAL;
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS product_id TEXT;
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS retailer TEXT;
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS title TEXT;
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS url TEXT;
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE retailer_offers ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS id BIGSERIAL;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS product_id TEXT;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS target_price NUMERIC(12,2);
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

      DO $$
      DECLARE column_record record;
      BEGIN
        FOR column_record IN
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('products', 'price_snapshots', 'retailer_offers', 'alerts')
            AND is_nullable = 'NO'
            AND column_name <> 'id'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
            column_record.table_name,
            column_record.column_name
          );
        END LOOP;
      END $$;
    `);
  }

  async close() {
    await this.pool.end();
  }

  async saveAnalysis(product: ProductRecord, history: PricePoint[], offers: RetailerOffer[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const saved = await this.upsertProduct(client, product);
      for (const point of history) {
        await client.query(
          `
          INSERT INTO price_snapshots (product_id, price, currency, source, observed_at)
          SELECT $1, $2, $3, $4, $5
          WHERE NOT EXISTS (
            SELECT 1 FROM price_snapshots
            WHERE product_id = $1 AND source = $4 AND observed_at = $5
          )
          `,
          [product.id, point.price, point.currency, point.source, point.observedAt]
        );
      }
      await client.query("DELETE FROM retailer_offers WHERE product_id = $1", [product.id]);
      for (const offer of offers) {
        await client.query(
          `
          INSERT INTO retailer_offers (product_id, retailer, title, price, currency, url, image_url, fetched_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [product.id, offer.retailer, offer.title, offer.price, offer.currency, offer.url, offer.imageUrl, offer.fetchedAt]
        );
      }
      await client.query("COMMIT");
      return saved;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecent(limit: number) {
    const result = await this.pool.query(
      "SELECT * FROM products ORDER BY updated_at DESC LIMIT $1",
      [limit]
    );
    return result.rows.map(mapProduct);
  }

  async getProductBundle(productId: string): Promise<ProductBundle | null> {
    const productResult = await this.pool.query("SELECT * FROM products WHERE id = $1", [productId]);
    const product = productResult.rows[0] ? mapProduct(productResult.rows[0]) : null;
    if (!product) return null;

    const [historyResult, offersResult] = await Promise.all([
      this.pool.query("SELECT * FROM price_snapshots WHERE product_id = $1 ORDER BY observed_at ASC", [productId]),
      this.pool.query("SELECT * FROM retailer_offers WHERE product_id = $1 ORDER BY price ASC", [productId])
    ]);

    return {
      product,
      history: historyResult.rows.map(mapHistory),
      offers: offersResult.rows.map(mapOffer)
    };
  }

  async saveAlert(input: SaveAlertInput): Promise<AlertRecord> {
    const result = await this.pool.query(
      `
      INSERT INTO alerts (product_id, email, target_price, currency)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [input.productId, input.email, input.targetPrice, input.currency]
    );
    return mapAlert(result.rows[0]);
  }

  async listActiveAlerts() {
    const result = await this.pool.query("SELECT * FROM alerts WHERE is_active = true ORDER BY created_at ASC");
    return result.rows.map(mapAlert);
  }

  async markAlertTriggered(alertId: number) {
    await this.pool.query(
      "UPDATE alerts SET is_active = false, last_notified_at = NOW() WHERE id = $1",
      [alertId]
    );
  }

  private async upsertProduct(client: PoolClient, product: ProductRecord) {
    const result = await client.query(
      `
      INSERT INTO products (id, site, source_url, external_id, name, image_url, current_price, currency, is_demo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id)
      DO UPDATE SET
        site = EXCLUDED.site,
        source_url = EXCLUDED.source_url,
        external_id = EXCLUDED.external_id,
        name = EXCLUDED.name,
        image_url = EXCLUDED.image_url,
        current_price = EXCLUDED.current_price,
        currency = EXCLUDED.currency,
        is_demo = EXCLUDED.is_demo,
        updated_at = NOW()
      RETURNING *
      `,
      [
        product.id,
        product.site,
        product.url,
        product.externalId,
        product.name,
        product.imageUrl,
        product.currentPrice,
        product.currency,
        product.isDemo
      ]
    );
    return mapProduct(result.rows[0]);
  }
}

function mapProduct(row: any): ProductRecord {
  return {
    id: row.id,
    site: row.site as SupportedSite,
    url: row.source_url,
    externalId: row.external_id,
    name: row.name,
    imageUrl: row.image_url,
    currentPrice: toNumber(row.current_price),
    currency: row.currency,
    isDemo: row.is_demo,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapHistory(row: any): PricePoint {
  return {
    observedAt: toIso(row.observed_at),
    price: toNumber(row.price),
    currency: row.currency,
    source: row.source
  };
}

function mapOffer(row: any): RetailerOffer {
  return {
    retailer: row.retailer,
    title: row.title,
    price: toNumber(row.price),
    currency: row.currency,
    url: row.url,
    imageUrl: row.image_url,
    fetchedAt: toIso(row.fetched_at)
  };
}

function mapAlert(row: any): AlertRecord {
  return {
    id: Number(row.id),
    productId: row.product_id,
    email: row.email,
    targetPrice: toNumber(row.target_price),
    currency: row.currency,
    isActive: row.is_active,
    createdAt: toIso(row.created_at),
    lastNotifiedAt: row.last_notified_at ? toIso(row.last_notified_at) : null
  };
}
