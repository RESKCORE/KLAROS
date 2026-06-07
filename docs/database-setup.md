# 🗄️ Database Setup & Migration Guide

This guide details the PostgreSQL database schema for KLAROS and outlines the steps to initialize or update your database in Supabase.

---

## 🛠️ Supabase Initialization

To set up a fresh database instance for KLAROS:

1. Create a project on the [Supabase Dashboard](https://supabase.com).
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New Query**, paste the contents of [scripts/supabase-schema.sql](file:///e:/KLAROS/scripts/supabase-schema.sql), and click **Run**.
4. Copy the API keys from **Settings → API** and add them to your `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 🔄 Database Migrations

### Adding `csv_data` to `data_sources`
If your database schema was created before the CSV Upload feature was implemented, you must run the following migration to avoid errors during uploads:

```sql
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;
```

> [!NOTE]
> This migration can be run manually in the Supabase SQL Editor, or by running the script:
> ```bash
> node scripts/run-migration.js
> ```

---

## 📊 Database Schema Reference

KLAROS relies on two main tables: `data_sources` and `decisions`.

### 1. `data_sources` Table
Stores metadata and parsed row data for connected CSV/XLSX datasets.

| Column | PostgreSQL Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier |
| `user_id` | `TEXT` | Clerk user ID |
| `name` | `TEXT` | Human-readable name of the dataset |
| `type` | `TEXT` | `csv` \| `supermarket_products` (synthetic) |
| `status` | `TEXT` | `connected` \| `syncing` \| `error` |
| `is_synthetic` | `BOOLEAN` | True if using default pre-packaged demo datasets |
| `counts` | `JSONB` | Row counts for products, sales, stock, and investments |
| `csv_data` | `JSONB` | Complete parsed CSV rows stored as structured JSON |
| `last_synced_at` | `TIMESTAMPTZ` | Timestamp of last sync |
| `created_at` | `TIMESTAMPTZ` | Record creation timestamp |

### 2. `decisions` Table
Stores MCDA analysis configurations, options, criteria, and AI results.

| Column | PostgreSQL Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier |
| `user_id` | `TEXT` | Clerk user ID |
| `title` | `TEXT` | Title of the decision analysis |
| `context` | `TEXT` | Brief overview context of the analysis |
| `status` | `TEXT` | `draft` \| `analyzing` \| `done` \| `archived` |
| `data_source_id` | `UUID` (Foreign Key) | Reference to `data_sources.id` |
| `decision_type` | `TEXT` | Decision category (e.g., `business_intelligence`) |
| `options` | `JSONB` | List of options evaluated: `[{ id, label, description }]` |
| `criteria` | `JSONB` | List of criteria: `[{ id, name, weight }]` |
| `constraints` | `JSONB` | List of constraint criteria |
| `result_json` | `JSONB` | Full results: recommendations, option scores, AI reasoning |
| `created_at` | `TIMESTAMPTZ` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Last updated timestamp |

---

## 🔒 Security: Clerk + Supabase RLS

KLAROS isolates tenant data by checking the Clerk authenticated user ID.

```
                  ┌────────────────────────┐
                  │   User Logs in Clerk   │
                  └───────────┬────────────┘
                              │
                    Issues session JWT
                              │
                              ▼
                  ┌────────────────────────┐
                  │   getSupabaseClient()   │
                  └───────────┬────────────┘
                              │
                 Constructs authorization header
                              │
                              ▼
        ┌──────────────────────────────────────────────┐
        │ Supabase RLS: USING (auth.uid() = user_id)  │
        └──────────────────────────────────────────────┘
```

### Row-Level Security (RLS) Policy
For production deployments, configure a Clerk JWT integration template named `supabase` and enforce the following RLS policy on both tables:
```sql
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User isolation" ON data_sources
  FOR ALL TO authenticated USING (auth.uid()::text = user_id);

CREATE POLICY "User isolation" ON decisions
  FOR ALL TO authenticated USING (auth.uid()::text = user_id);
```
