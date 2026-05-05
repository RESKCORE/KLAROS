# KLAROS

KLAROS is a decision intelligence app for BI-style analysis across multiple datasets. It combines a React + Vite frontend with a Node + Prisma backend, Clerk auth, and dataset ingestion for CSV/XLSX files. The UI focuses on clear KPI summaries, interactive charts, and dataset-aware analysis history.

## Product Overview
KLAROS helps teams compare and interpret business datasets with consistent KPIs and analysis workflows.

Key flows:
- Connect or upload datasets.
- Run auto-analysis per dataset.
- View results with KPIs and charts.
- Browse and compare history grouped by dataset.

## Core Features
- Multi-dataset analysis with dataset-specific metrics.
- Upload datasets (products, sales, stock, investments) in CSV/XLSX.
- Results page with KPI tiles and charts (Recharts).
- History view with dataset grouping, filters, and comparison.
- Clerk authentication and Neon Postgres storage.
- Local caching for fast reads on repeat visits.

## Tech Stack
Frontend:
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts for charts

Backend:
- Node (Express)
- Prisma ORM
- Neon Postgres
- Clerk auth

## Repository Layout
- [src/](src/) - React app
- [server/](server/) - API server
- [prisma/](prisma/) - Prisma schema
- [public/](public/) - public assets and sample datasets
- [scripts/](scripts/) - utility scripts
- [tests/](tests/) - end-to-end tests

## Getting Started
1) Install dependencies
```
npm install
```

2) Configure environment variables (see .env.example)
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `VITE_API_BASE_URL` (optional, defaults to http://localhost:4000)

3) Run the full stack
```
npm run dev:full
```

Frontend: http://localhost:8080
API: http://localhost:4000

## Scripts
- `npm run dev` - Vite frontend only
- `npm run dev:server` - API server only
- `npm run dev:full` - frontend + server (concurrently)
- `npm run build` - production build
- `npm run typecheck` - TypeScript checks
- `npm run lint` - ESLint
- `npm run test` - unit tests
- `npm run test:e2e` - Playwright tests

## Authentication
Auth is handled by Clerk:
- Frontend uses `@clerk/react` for UI/session.
- Backend uses `@clerk/backend` with token validation.

If Clerk user fetch fails, the server continues using token payload only (non-blocking for development).

## Data Sources
You can connect the synthetic dataset or upload custom datasets with:
- products.csv
- sales.csv
- stock.csv
- investments.csv

Dataset naming is preserved across the dashboard, results, and history views.

### Required Columns (CSV/XLSX)
The uploader expects headers that mirror the synthetic dataset.

products.csv:
- sku
- name
- category
- subcategory
- brand
- price
- cost
- supplier
- shelf_life_days
- weight_kg
- launch_date

sales.csv:
- sku
- date
- quantity
- revenue
- discount
- payment_method
- store_city

stock.csv:
- sku
- date
- quantity
- beginning_stock
- units_sold
- reorder_point
- supplier_lead_time

investments.csv:
- date
- amount
- category
- description
- expected_roi
- actual_roi

## Metrics and KPIs
Dataset metrics are calculated per data source:
- Revenue, cost, profit, margin
- Units sold, average discount
- SKU count, cities count
- Low stock count

Charts are derived from these metrics (revenue by date/category, payment or location mix, inventory status, ROI trends).

## API Endpoints (Summary)
All endpoints require auth unless noted.

- `GET /api/decisions` - list decisions
- `GET /api/decisions/:id` - get decision details
- `DELETE /api/decisions/:id` - delete decision
- `POST /api/auto-analyze` - run auto analysis for a dataset
- `GET /api/data-sources` - list data sources
- `POST /api/upload-dataset` - upload CSV/XLSX dataset
- `GET /api/market-metrics/:dataSourceId` - dataset-specific metrics

## Caching Behavior
- Data source lists are cached in localStorage.
- Decision lists are cached for quick dashboard loads.
- Metrics use in-memory + localStorage caching where applicable.

## Troubleshooting
Database connection error:
- Check `DATABASE_URL` and Neon status.
- The server performs a health check at startup.

Auth errors:
- Verify Clerk keys in .env.local.
- Ensure frontend and backend use the same Clerk instance.

Vite hot reload errors:
- Stop and re-run `npm run dev:full` after large refactors.

## Deployment Notes
- Vercel hosts both the frontend and API.
- The Express API is exposed as a Vercel Serverless Function in [api/[...path].ts](api/%5B...path%5D.ts).
- For production, set `VITE_API_BASE_URL` to your Vercel URL (or omit if you inject it at build time).
- Set the same environment variables in Vercel as in local (.env.local).
- Ensure the Neon `DATABASE_URL` includes `?sslmode=require`.

## Vercel Deployment Checklist
1. Import the GitHub repo into Vercel.
2. Set the following environment variables:
	- `VITE_CLERK_PUBLISHABLE_KEY`
	- `CLERK_SECRET_KEY`
	- `DATABASE_URL`
	- `VITE_API_BASE_URL` (optional)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy and verify:
	- Frontend loads at the Vercel URL
	- `/api/health` returns `{ "status": "ok" }`

## License
MIT
