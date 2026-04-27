# TrueCost

TrueCost is a full-stack product price intelligence tool. Paste a product URL from Amazon, Shopee, Lazada, or Flipkart and get price history, live cross-retailer comparison, and a verdict on whether to buy now or wait.

## Stack

- Frontend: React, Vite, TypeScript, TailwindCSS, Recharts
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Heroku Postgres
- Providers: Keepa, SerpApi, ScraperAPI, SendGrid
- Deployment: separate Heroku apps for API and frontend

## Project Layout

```text
backend/   Express API, provider integrations, database stores, alert job
frontend/  Vite React app, Tailwind UI, charts, static Heroku config
```

## Required API Keys

Backend config vars:

```bash
DATABASE_URL=...
CLIENT_ORIGIN=http://localhost:5173
DEMO_FALLBACK=true
KEEPA_API_KEY=...
SERPAPI_API_KEY=...
SCRAPERAPI_KEY=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=alerts@example.com
SALE_SEASON_WINDOW_DAYS=10
```

Frontend config vars:

```bash
VITE_API_URL=https://pricelens-api-e6983572b5c4.herokuapp.com
```

`DEMO_FALLBACK=true` keeps the app usable without paid provider keys by returning deterministic demo product history and comparison prices.

## Local Setup

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev:backend
npm run dev:frontend
```

The backend runs on `http://localhost:4000`. The frontend runs on `http://localhost:5173`.

## API Routes

- `POST /api/analyze` with `{ "url": "https://..." }`
- `GET /api/recent`
- `GET /api/products/:id`
- `POST /api/alert` with `{ "productId": "...", "email": "...", "targetPrice": 123.45 }`
- `GET /api/health`

## Validation

```bash
npm run test
npm run build
```

Backend tests cover URL parsing, verdict thresholds, alert matching, and the analyze/recent/detail/alert API flow with demo fallback.

## Heroku Deployment

The target apps are:

- Backend: `pricelens-api`
- Frontend: `pricelens-app`

Add remotes:

```bash
heroku git:remote -a pricelens-api -r heroku-api
heroku git:remote -a pricelens-app -r heroku-frontend
```

Backend setup:

```bash
heroku buildpacks:set heroku/nodejs -a pricelens-api
heroku addons:create heroku-postgresql:essential-0 -a pricelens-api
heroku addons:create scheduler:standard -a pricelens-api
heroku config:set \
  CLIENT_ORIGIN=https://pricelens-app-3af8f2d41865.herokuapp.com \
  DEMO_FALLBACK=true \
  KEEPA_API_KEY=replace-me \
  SERPAPI_API_KEY=replace-me \
  SCRAPERAPI_KEY=replace-me \
  SENDGRID_API_KEY=replace-me \
  SENDGRID_FROM_EMAIL=alerts@example.com \
  SALE_SEASON_WINDOW_DAYS=10 \
  -a pricelens-api
git subtree push --prefix backend heroku-api main
```

Frontend setup:

```bash
heroku stack:set heroku-24 -a pricelens-app
heroku buildpacks:clear -a pricelens-app
heroku buildpacks:add heroku/nodejs -a pricelens-app
heroku config:set VITE_API_URL=https://pricelens-api-e6983572b5c4.herokuapp.com -a pricelens-app
git subtree push --prefix frontend heroku-frontend main
```

The frontend still builds to static Vite assets in `dist/`. Heroku's deprecated `heroku-community/static` buildpack currently rejects the available `heroku-22` and `heroku-24` stacks, so the deployed app uses the official Node buildpack with `serve` to host the static build.

Heroku Scheduler:

```bash
heroku run npm run alerts:check -a pricelens-api
heroku addons:open scheduler -a pricelens-api
```

Add a daily job with this command:

```bash
npm run alerts:check
```

## Notes

- Amazon history uses Keepa when `KEEPA_API_KEY` is configured.
- Shopee, Lazada, and Flipkart store real snapshots over time via ScraperAPI.
- SerpApi powers Google Shopping comparison offers.
- SendGrid sends alerts once a product drops to or below the saved target price.
- Heroku Procfiles and buildpacks follow Heroku Dev Center Procfile/buildpack guidance and the Vite static deployment pattern.
