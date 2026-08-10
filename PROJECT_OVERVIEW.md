# KLAROS — Retail Analytics & Decision Intelligence Platform

KLAROS is an industry-grade, enterprise-ready retail intelligence software. It acts as a bridge between massive raw transactional spreadsheets and executive planning sessions by pairing local high-performance financial data modeling with multi-provider LLM-driven Decision Analysis.

---

## 🚀 Key Value Propositions

- **Actionable Strategic Options**: Uses a multi-criteria decision analysis (MCDA) model, powered by an advanced LLM fallback mechanism, to synthesize three optimized business pathways.
- **Frictionless Cold Starts**: Instantly initialize and explore the product's interface using built-in high-fidelity synthetic retail datasets.
- **Unified Local Analytics**: Aggregates margins, inventory velocities, investment ROIs, and low-stock alerts entirely client-side via safe and highly-optimized local JS engines.
- **Enterprise-Grade Security Proxy**: Implements Clerk JWT validation and an API middleware layer to secure secret API keys (Groq, OpenRouter, Gemini), protecting your digital boundaries.

---

## 🛠️ Architectural Breakdown

### 1. High-Performance Client-Side KPI Engine
To prevent unnecessary database latency and backend bills, the raw log transactional ingest (CSV/XLSX logs spanning catalog items, sales, reorder targets, and marketing budgets) is processed in the client’s browser using streamlined web worker adapters. This client-side processing extracts key business KPIs such as:
- Cumulative margins & revenue velocity.
- Low-stock warnings and inventory depletion metrics.
- Investment metrics like expected ROI vs actual ROI.

### 2. Multi-Provider LLM Fallback Engine
The core of KLAROS's intelligence is its robust resilience. A unified LLM Dispatcher ensures 100% uptime by attempting execution across three premier inference layers:
1. **Groq Core**: The main ultra-fast engine (utilizing models like `llama-3.3-70b-versatile` and `mixtral-8x7b-32768`).
2. **OpenRouter**: The primary alternative fallback, enabling lightweight execution of open-source models like `qwen-3-32b` or `deepseek-v4-flash`.
3. **Google Gemini**: The multimodal endpoint fallback (utilizing `gemini-2.5-flash` or `gemini-2.0-flash`).

### 3. Serverless Integration & RLS Authorization
The web platform operates serverless. In production, row-level security (RLS) is applied across all database tables. It reads and verifies Clerk user sessions securely via public-key cryptography on Vercel Edge.

### 4. Deterministic Caching Architecture
- **In-Memory Cache & Deduping**: Identical, in-flight data or API queries are deduplicated globally.
- **Redis & Local Cache Integration**: Leverages Upstash Redis caches and local browser-based cached objects with custom version-prefixes (e.g. `klaros:data-sources:v3`), minimizing costs and maximizing dashboard speed.

---

## ⚡ Setup Guide & Verification

Refer to [README.md](./README.md) for detailed onboarding configurations. You can run all verification sweeps using:
```bash
npm install
npm run check
```
