# 04 — System Functionality & Features Guide

> **Core Pages**: [`src/pages/Dashboard.tsx`](file:///e:/KLAROS/src/pages/Dashboard.tsx), [`src/pages/DecisionResult.tsx`](file:///e:/KLAROS/src/pages/DecisionResult.tsx), [`src/pages/ConnectData.tsx`](file:///e:/KLAROS/src/pages/ConnectData.tsx), [`src/pages/History.tsx`](file:///e:/KLAROS/src/pages/History.tsx)  
> **Market Metrics API**: [`src/features/market/utils/market-metrics.ts`](file:///e:/KLAROS/src/features/market/utils/market-metrics.ts)

---

## Overview of KLAROS Functionality

**KLAROS** is an AI-powered retail analytics and executive decision-intelligence platform. It transforms raw transaction logs and spreadsheet data into actionable financial metrics, inventory management signals, and multi-criteria decision reports.

Below is a detailed guide to all major functional modules, feature specifications, user workflows, and computational rules embedded within KLAROS.

---

## 1. Universal Data Connection & Multi-Format AI Parsing Engine

### Universal Input Support
1. **Multi-Format Extraction**: Upload retail datasets in **any format**:
   - `.csv`, `.xlsx`, `.xls` (Spreadsheets)
   - `.json` (Structured JSON arrays or object collections)
   - `.xml` (XML element trees)
   - `.pdf`, `.docx`, `.txt` (Text documents & delimited tables)
2. **Consolidated & Multi-File Support**:
   - **Single-File Mode**: Upload a single multi-sheet Excel workbook or single JSON/PDF containing all retail tables.
   - **Multi-File Mode**: Upload separate files for Products, Sales, Stock, and Investments.
3. **Synthetic Supermarket Prototype**: Pre-loaded supermarket dataset for quick testing and benchmarking.

### AI Dynamic Schema Mapping & Auto-Healing
- **Header Synonym Detection**: Automatically maps raw user headers (e.g. `Item Name`, `Selling Rate`, `Available Stock`, `Txn Date`) to KLAROS's canonical financial model using fuzzy string matching and heuristic dictionary resolution.
- **Interactive Mapping Preview (`MappingPreviewModal.tsx`)**: Displays an interactive modal showcasing auto-detected schema types, confidence scores, and dropdown select boxes for custom user overrides before dataset normalization.
- **Smart Field Auto-Healing**: Fills missing optional fields with context-aware smart defaults (e.g. generating synthetic SKUs if missing, estimating unit costs from average margins) to guarantee zero upload crashes.
- **Web Worker Parsing Thread**: Background parsing via [`document-extractor.ts`](file:///e:/KLAROS/src/features/market/utils/document-extractor.ts) and [`market-metrics.worker.ts`](file:///e:/KLAROS/src/features/market/utils/market-metrics.worker.ts) ensures the UI thread remains responsive at 60 FPS even when parsing large documents.

---

## 2. Retail Financial & Inventory KPI Engine

Once data is loaded, the metric engine computes key retail metrics:

### Core Financial Formulas

| Metric | Formula | Description |
|---|---|---|
| **Total Revenue** | $\sum (\text{Quantity Sold} \times \text{Selling Price})$ | Gross sales volume across all transaction records. |
| **Total Cost** | $\sum (\text{Quantity Sold} \times \text{Cost Price})$ | Total cost of goods sold (COGS). |
| **Gross Profit** | $\text{Total Revenue} - \text{Total Cost}$ | Net operating revenue before overhead expenses. |
| **Gross Margin %** | $\left( \frac{\text{Gross Profit}}{\text{Total Revenue}} \right) \times 100$ | Percentage of top-line revenue retained as profit. |
| **Low-Stock Count** | $\text{Count of items where } \text{Stock Level} \le \text{Reorder Threshold}$ | Inventory count requiring urgent stock replenishment. |
| **Stock Turnover Ratio** | $\frac{\text{COGS}}{\text{Average Inventory Value}}$ | Measures how quickly stock is sold and replaced. |

### Currency & Locale Formatting
Financial metrics are automatically formatted using Indian Rupee standards:
```typescript
new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
}).format(val); // e.g., ₹1,96,687
```

---

## 3. Multi-Provider LLM Fallback Dispatcher

KLAROS includes an automated multi-provider AI dispatcher operating behind a secure Vercel Serverless proxy:

```
[ Client Request ]
       │
       ▼
 ┌───────────┐      Fail / Rate-Limit      ┌──────────────────┐      Fail      ┌────────────────┐
 │ Groq API  │ ──────────────────────────► │  OpenRouter API  │ ─────────────► │   Gemini API   │
 │ (Llama 3) │                             │ (DeepSeek/Llama) │                │ (1.5 Flash)    │
 └───────────┘                             └──────────────────┘                └────────────────┘
```

### Dispatcher Key Features
- **Automatic Fallback**: If Groq returns `429 Rate Limit` or times out after 10 seconds, the request instantly fails over to OpenRouter, and subsequently to Google Gemini.
- **JSON Structure Validation**: Responses are validated via **Zod schemas** ([`src/features/decisions/core/analysis-schema.ts`](file:///e:/KLAROS/src/features/decisions/core/analysis-schema.ts)) to ensure valid MCDA outputs.
- **Robust JSON Extractor**: Handles cases where LLMs wrap outputs in Markdown code blocks (```json ... ```) or prefix responses with conversational text.

---

## 4. Decision Intelligence Hub & AHP Analysis

The AI Decision Engine transforms raw aggregated metrics into **3 Strategic Options** scored across a weighted criteria matrix using **Analytic Hierarchy Process (AHP)** math:

### Strategic Option Structure
Every analysis generates three strategic paths:
1. **Option A — Margin Optimization**: Focused on premium pricing, vendor renegotiation, and high-margin item prioritization.
2. **Option B — Inventory Velocity**: Focused on fast stock turnover, liquidating dead stock, and accelerating order fulfillment cycles.
3. **Option C — Balanced Growth**: A hybrid strategic model balancing profit preservation with market share expansion.

### Criteria Scoring Grid & Consistency Check
- The engine computes pair comparisons between **Margin**, **Velocity**, and **Risk**.
- Derives the exact criteria weight vector $w = [w_1, w_2, w_3]$.
- Validates mathematical consistency using Saaty's Consistency Ratio ($CR < 0.10$).

---

## 5. Interactive Analytics Dashboard

The Decision Results page ([`src/pages/DecisionResult.tsx`](file:///e:/KLAROS/src/pages/DecisionResult.tsx)) presents a complete suite of executive visualization tools:

### Key UI Features

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  KLAROS Dashboard Hub                                                            │
├─────────────────┬────────────────────────────────────────────────────────────────┤
│  Navigation     │  [ KPI Card 1: Total Revenue ]   [ KPI Card 2: Gross Margin % ]  │
│  - Dashboard    │  ₹1,96,687 (+12.4% vs prev)       64.2% (High Margin)          │
│  - Connect Data ├────────────────────────────────────────────────────────────────┤
│  - History      │  [ Category Revenue Chart (Recharts) ]                         │
│  - Settings     │  Beverages: █ blue   Groceries: █ green   Bakery: █ orange      │
│                 ├────────────────────────────────────────────────────────────────┤
│                 │  [ AI Revenue Forecast ]  [ Top Products Panel ]  [ AI Chat ]  │
│                 │  3-Month Trend Line       Searchable SKU list     Ask AI       │
└─────────────────┴────────────────────────────────────────────────────────────────┘
```

1. **Vibrant KPI Cards**: Color-coded cards displaying revenue, cost, margin %, low-stock counts, and stock turnover metrics.
2. **Category Visualizer**: Interactive **Recharts** bar chart with custom category colors (Beverages: blue, Groceries: green, Bakery: orange, Dairy: red, Produce: purple, Snacks: cyan).
3. **Top Products Side Panel**: Searchable panel featuring automatic SKU prefix classification, category badges, and stock level indicators.
4. **AI Revenue Forecast**: 3-month extrapolated trend line comparing historical sales data against predicted future revenue trajectories.
5. **AI Actionable Insights Grid**: Executive narratives, impact-badged opportunities (High/Medium/Low), risk alerts, and anomaly detection highlights.

---

## 6. Decision History & Comparison Manager

The History module ([`src/pages/History.tsx`](file:///e:/KLAROS/src/pages/History.tsx)) allows retail managers to manage past decision reports:

- **Filter & Search**: Search past analyses by title, dataset ID, or date range.
- **Side-by-Side Comparison**: Select any two historical decisions to compare criteria weights, option scores, and consistency ratios side by side.
- **Persistence & Cloud Sync**: Automatically synced to Supabase PostgreSQL with instant offline retrieval via local caching.
