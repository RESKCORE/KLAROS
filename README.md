# KLAROS

KLAROS is a decision intelligence app for BI-style analysis across multiple datasets. It combines a React + Vite frontend with a Node + Prisma backend, Clerk auth, and dataset ingestion for CSV/XLSX files. The UI focuses on clear KPI summaries, interactive charts, and dataset-aware analysis history.

## Table of Contents
- Overview
- Goals and Non-Goals
- System Architecture
- Key Concepts
- Data Flow
- Repository Layout
- Frontend Architecture
- Backend Architecture
- Database Schema (Detailed)
- API Reference (Detailed)
- Dataset Upload Schema and Validation
- Metrics and KPI Definitions
- Auth Flow and Security
- Environment Variables
- Scripts
- Local Development
- Testing
- Caching Strategy
- Deployment (Vercel)
- Troubleshooting
- Security Checklist
- Roadmap
- License

## Overview
KLAROS helps teams compare and interpret business datasets with consistent KPIs and analysis workflows.

Primary workflows:
- Connect or upload datasets.
- Run auto-analysis per dataset.
- View results with KPIs and charts.
- Browse and compare history grouped by dataset.

## Goals and Non-Goals
Goals:
- Make dataset-specific analysis fast and repeatable.
- Provide consistent KPIs across different datasets.
- Keep history and comparison views readable and actionable.

Non-goals (current scope):
- Real-time streaming ingestion.
- Enterprise multi-tenant admin controls.
- Custom ML model training.

## System Architecture
Client:
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts for charts

Server:
- Express API exposed as a Vercel Serverless Function
- Prisma ORM for database access
- Clerk auth for identity

Database:
- Neon Postgres

## Key Concepts
- Data source: A dataset connected to a user (uploaded CSV/XLSX or synthetic data).
- Decision: A dataset-specific analysis run with options, criteria, and results.
- Metrics: KPI and chart-ready aggregates calculated per dataset.

## Data Flow
1) User uploads or connects a dataset.
2) Server stores data in Postgres and registers a data source.
3) User triggers auto-analysis.
4) Server generates a decision and computed metrics per data source.
5) Frontend loads decision results and metrics for the selected dataset.

## Repository Layout
- [src/](src/) - React app
- [server/](server/) - Express API
- [api/[...path].ts](api/%5B...path%5D.ts) - Vercel serverless entry
- [prisma/](prisma/) - Prisma schema
- [public/](public/) - public assets and sample datasets
- [scripts/](scripts/) - utility scripts
- [tests/](tests/) - end-to-end tests

## Frontend Architecture
Key pages:
- [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) - dataset list, stats, and analysis launcher
- [src/pages/DecisionResult.tsx](src/pages/DecisionResult.tsx) - KPI + chart results per dataset
- [src/pages/History.tsx](src/pages/History.tsx) - dataset-grouped history with filters and compare
- [src/pages/ConnectData.tsx](src/pages/ConnectData.tsx) - upload and connect datasets

Core libraries:
- [src/lib/bi-api.ts](src/lib/bi-api.ts) - authenticated API client
- [src/lib/decision-store.ts](src/lib/decision-store.ts) - decision caching and fetch helpers
- [src/lib/market-metrics.ts](src/lib/market-metrics.ts) - CSV-based metrics for synthetic data

State and caching notes:
- Dashboard and history use cached data sources and decisions for fast UI loads.
- Metrics are cached per dataset to reduce repeated fetches.

## Backend Architecture
Entry:
- [server/index.ts](server/index.ts) - Express app and routes

Key modules:
- [server/auth.ts](server/auth.ts) - Clerk auth and user provisioning
- [server/metrics.ts](server/metrics.ts) - dataset-specific metrics
- [server/synthetic.ts](server/synthetic.ts) - synthetic dataset seeding and analysis
- [server/upload.ts](server/upload.ts) - CSV/XLSX upload pipeline
- [server/decision-repo.ts](server/decision-repo.ts) - decision persistence helpers
- [server/user-repo.ts](server/user-repo.ts) - user persistence helpers

Serverless notes:
- The Express app is exported and not started when running on Vercel.
- The serverless entry is [api/[...path].ts](api/%5B...path%5D.ts).

## Database Schema (Detailed)
Authoritative source: [prisma/schema.prisma](prisma/schema.prisma)

User:
- id (uuid)
- clerkUserId (unique)
- email, fullName (optional)
- createdAt, updatedAt

DataSource:
- id (uuid)
- userId (uuid, FK -> User)
- name
- type (csv, google_sheets, supermarket_products)
- status (connected, syncing, error)
- connectionDetails (json)
- lastSyncedAt
- createdAt, updatedAt

Decision:
- id (uuid)
- title, context
- status (draft, analyzing, done, archived)
- dataSourceId (uuid, FK -> DataSource)
- decisionType
- resultJson (json)
- createdAt, updatedAt
- options, criteria, constraints (relations)

Option:
- id (uuid)
- decisionId (uuid, FK -> Decision)
- label, notes, description

Criterion:
- id (uuid)
- decisionId (uuid, FK -> Decision)
- name, weight, description, rationale

Constraint:
- id (uuid)
- decisionId (uuid, FK -> Decision)
- type (budget, timeline, risk, other)
- value, priority, description

SalesHistory:
- id (uuid)
- dataSourceId (uuid, FK -> DataSource)
- productId (uuid, FK -> SupermarketProduct)
- externalProductId
- saleDate
- quantitySold
- revenue
- discount
- customerSegment (used as location mix)

StockMovement:
- id (uuid)
- dataSourceId (uuid, FK -> DataSource)
- productId (uuid, FK -> SupermarketProduct)
- currentStock
- lastUpdated
- minStockThreshold
- movementType

SupermarketProduct:
- id (uuid)
- dataSourceId (uuid, FK -> DataSource)
- productId (sku)
- name, category, subcategory, brand
- price, costPrice
- unit
- description

Investment:
- id (uuid)
- dataSourceId (uuid, FK -> DataSource)
- date
- amount
- category
- description
- expectedRoi, actualRoi

## API Reference (Detailed)
All endpoints require auth unless noted. Auth is passed as `Authorization: Bearer <clerk_token>`.

Health:
- `GET /api/health`
	Response:
	```json
	{ "status": "ok" }
	```

Decisions:
- `GET /api/decisions?status=done`
	Response: array of decisions with options and criteria.

- `GET /api/decisions/:id`
	Response: a single decision.

- `PATCH /api/decisions/:id/status`
	Body:
	```json
	{ "status": "archived" }
	```

- `DELETE /api/decisions/:id`
	Response: 204 No Content

Data sources:
- `GET /api/data-sources`
	Response:
	```json
	[
		{
			"id": "uuid",
			"name": "Sample 2",
			"type": "csv",
			"status": "connected",
			"lastSyncedAt": null,
			"counts": { "products": 120, "salesHistory": 820, "stockMovements": 120, "investments": 15 }
		}
	]
	```

- `POST /api/connect-data`
	Response:
	```json
	{ "ok": true, "dataSourceId": "uuid" }
	```

Analysis:
- `POST /api/auto-analyze`
	Body:
	```json
	{ "dataSourceId": "uuid" }
	```
	Response:
	```json
	{ "ok": true, "decisionId": "uuid" }
	```

- `GET /api/market-metrics/:dataSourceId`
	Response:
	```json
	{
		"kpis": {
			"totalRevenue": 12345,
			"totalCost": 9000,
			"totalProfit": 3345,
			"profitMarginPct": 27.1,
			"totalUnits": 880,
			"avgDiscount": 2.1,
			"grossMarginPct": 27.1,
			"skuCount": 120,
			"citiesCount": 6,
			"lowStockCount": 9
		},
		"revenueByDate": [ { "date": "2025-05-01", "revenue": 1200, "units": 80 } ],
		"revenueByCategory": [ { "category": "Groceries", "revenue": 4200, "units": 200, "marginPct": 32.7, "avgDiscount": 1.2 } ],
		"paymentMethodShare": [ { "method": "Store City Mix", "revenue": 4200 } ],
		"topProducts": [ { "sku": "SKU-1", "name": "Basmati Rice 5kg", "revenue": 1200, "units": 80, "marginPct": 28.1 } ],
		"inventory": [ { "sku": "SKU-1", "name": "Basmati Rice 5kg", "beginningStock": 12, "unitsSold": 0, "reorderPoint": 20, "stockRatio": 0.6, "leadTime": 0 } ],
		"inventorySummary": { "belowReorder": 9, "avgStockRatio": 1.1 },
		"categoryRadar": [ { "metric": "Revenue", "Groceries": 8.2 } ],
		"categoryNames": [ "Groceries" ]
	}
	```

Upload:
- `POST /api/upload-dataset`
	Content-Type: multipart/form-data
	Fields: datasetName, products, sales, stock, investments
	Response:
	```json
	{ "ok": true, "dataSourceId": "uuid" }
	```

## Dataset Upload Schema and Validation
Accepted file types:
- .csv, .xlsx, .xls

File size limit:
- 12MB per file (multer limit)

Required files:
- products, sales, stock, investments

CSV/XLSX columns (normalized to lower_snake_case):

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

Validation behavior:
- Unsupported file types return `Unsupported file type` errors.
- Missing files return `Missing required files`.
- Invalid dates are skipped per-row during import.

## Metrics and KPI Definitions
KPIs are computed per dataset:
- totalRevenue: sum of revenue
- totalCost: sum of quantitySold * product cost
- totalProfit: totalRevenue - totalCost
- profitMarginPct: totalProfit / totalRevenue
- totalUnits: sum of quantitySold
- avgDiscount: mean discount value
- grossMarginPct: same as profitMarginPct (current implementation)
- skuCount: unique product count
- citiesCount: unique customerSegment count
- lowStockCount: products where currentStock <= minStockThreshold

Charts use these aggregates:
- Revenue by date and category
- Payment or location mix (customerSegment)
- Inventory levels and reorder status
- Investment ROI series

## Auth Flow and Security
Auth is handled by Clerk:
- Frontend uses `@clerk/react` for UI/session.
- Backend uses `@clerk/backend` and verifies tokens.
- If user fetch fails, server continues with token payload.

Client request:
- `Authorization: Bearer <token>`

Server response on auth failure:
- `401 { "error": "unauthorized" }`

## Environment Variables
See [.env.example](.env.example) for all supported values.

Required:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`

Optional:
- `VITE_API_BASE_URL` (defaults to http://localhost:4000)
- `VITE_APP_URL`

## Scripts
- `npm run dev` - Vite frontend only
- `npm run dev:server` - API server only
- `npm run dev:full` - frontend + server (concurrently)
- `npm run build` - production build
- `npm run typecheck` - TypeScript checks
- `npm run lint` - ESLint
- `npm run test` - unit tests
- `npm run test:e2e` - Playwright tests

## Local Development
1) Install dependencies:
```
npm install
```

2) Configure environment variables:
See [.env.example](.env.example)

3) Run the full stack:
```
npm run dev:full
```

Frontend: http://localhost:8080
API: http://localhost:4000

## Testing
- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e`

## Caching Strategy
- Data source lists cached in localStorage for 5 minutes.
- Decision lists cached in localStorage for 5 minutes.
- Metrics cached in memory and localStorage where applicable.

## Deployment (Vercel)
- Vercel hosts both the frontend and API.
- The Express API is exposed as a Vercel Serverless Function in [api/[...path].ts](api/%5B...path%5D.ts).
- Set the same environment variables in Vercel as in local.
- Ensure the Neon `DATABASE_URL` includes `?sslmode=require`.

Checklist:
1) Import the GitHub repo into Vercel.
2) Set env vars: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `VITE_API_BASE_URL` (optional).
3) Build command: `npm run build`
4) Output directory: `dist`
5) Verify `/api/health` returns `{ "status": "ok" }`.

## Troubleshooting
Database connection error:
- Check `DATABASE_URL` and Neon status.
- The server performs a health check at startup.

Auth errors:
- Verify Clerk keys in .env.local.
- Ensure frontend and backend use the same Clerk instance.

Vite hot reload errors:
- Stop and re-run `npm run dev:full` after large refactors.

## Security Checklist
- Never commit secrets. Use `.env.local` for development.
- Use least-privileged DB credentials where possible.
- Validate CSV/XLSX inputs before running production imports.
- Enable Clerk domain restrictions in production.

## Roadmap
- Add dataset-level KPI deltas across analyses.
- Improve comparison view with trend deltas.
- Add export to CSV/PDF for reports.

## License
MIT
