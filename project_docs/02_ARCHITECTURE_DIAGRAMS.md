# 02 — Architecture Diagrams & System Overview

> **Serverless Function Entrypoint**: [`api/llm.ts`](file:///e:/KLAROS/api/llm.ts)  
> **LLM Dispatcher Service**: [`src/services/llm/llm-service.ts`](file:///e:/KLAROS/src/services/llm/llm-service.ts)  
> **Web Worker KPI Engine**: [`src/features/market/utils/market-metrics.worker.ts`](file:///e:/KLAROS/src/features/market/utils/market-metrics.worker.ts)  
> **Database Sync Layer**: [`src/features/market/api/bi-api.ts`](file:///e:/KLAROS/src/features/market/api/bi-api.ts)

---

## High-Level System Architecture

KLAROS follows a **Client-Heavy Serverless Architecture**. The React 18 single-page application (SPA) handles data parsing, UI rendering, chart generation, and financial metric aggregation. Heavy dataset calculations run on a dedicated **Web Worker thread**, keeping the main UI thread running at 60 FPS. API keys and external AI communications are securely proxied via a **Vercel Serverless Function** (`/api/llm`).

```mermaid
graph TB
    subgraph Client Layer ["Client Browser (React 18 + Vite)"]
        UI["React SPA UI Components\n(shadcn/ui + Recharts + Framer Motion)"]
        TQ["TanStack Query Cache Layer\n(Authoritative State & Reactivity)"]
        WW["Web Worker Thread\n(PapaParse / XLSX / Financial Metric Engine)"]
    end

    subgraph Auth Layer ["Identity Management"]
        CLERK["Clerk Auth SDK\n(Session token & RS256 JWT Generation)"]
    end

    subgraph Serverless Backend ["Vercel Serverless Infrastructure"]
        PROXY["/api/llm Vercel Function\n(RS256 Web Crypto JWT Verification)"]
        CRON["/api/keep-alive Vercel Function\n(Database Cold-Pause Prevention)"]
    end

    subgraph Database Layer ["Database & Storage"]
        SUPA[("Supabase PostgreSQL DB\n(Row Level Security / Tables: data_sources, decisions)")]
    end

    subgraph AI Provider Hierarchy ["Multi-Provider LLM Fallback Engine"]
        GROQ["1. Groq API\n(Llama 3 70B — ~250ms ultra-fast inference)"]
        OR["2. OpenRouter API\n(DeepSeek / Llama 3 — secondary fallback)"]
        GEM["3. Google Gemini API\n(Gemini 1.5 Flash — tertiary fallback)"]
    end

    UI --> TQ
    UI --> WW
    UI --> CLERK
    CLERK -->|Attach Bearer JWT| PROXY
    PROXY -->|Masked GROQ_API_KEY| GROQ
    GROQ -->|Rate Limit / Timeout Failover| OR
    OR -->|Failover| GEM
    GEM -->|JSON Payload| PROXY
    PROXY -->|Validated Decision Object| UI
    UI -->|Persist Metadata & Decision| SUPA
    CRON -->|Ping query| SUPA
```

---

## Detailed Component Architecture Breakdown

### 1. Client Layer (Frontend & Web Worker)
- **Vite 5 + React 18 + TypeScript 5**: Type-safe single-page application.
- **Web Worker KPI Engine**: Parses CSV and Excel files up to 50 MB off the main thread. Performs financial metric aggregation, low-stock calculation, category grouping, and Schwartzian sorting.
- **TanStack Query v5**: Handles client state caching, background refetching, and optimistic updates.

### 2. Authentication & Authorization Layer
- **Clerk SDK**: Manages user authentication, sign-ups, login state, and issues short-lived RS256 JWTs.
- **JWT Verification**: The Vercel proxy verifies JWT signatures natively using Node 20's `crypto.subtle` API, enforcing authentication before proxying AI requests.

### 3. Serverless API Layer
- **`/api/llm` Proxy Endpoint**: Enforces JWT verification, extracts request parameters, attaches secret environment variables (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`), and manages request timeout and backoff logic.
- **`/api/keep-alive` Endpoint**: Periodically pings the Supabase database to prevent instance pauses on free-tier hosting.

### 4. Database & Storage Layer
- **Supabase (PostgreSQL)**: Stores user data sources and historical decisions.
- **Row Level Security (RLS)**: Restricts database access so users can only read, write, and delete their own records based on `clerk_user_id`.

---

## Multi-Provider LLM Fallback Engine

High availability is guaranteed through an **automatic three-tier provider fallback hierarchy**:

```mermaid
sequenceDiagram
    autonumber
    participant UI as React UI (Client)
    participant Proxy as Vercel /api/llm Proxy
    participant Groq as Tier 1: Groq API
    participant OR as Tier 2: OpenRouter API
    participant Gem as Tier 3: Gemini API

    UI->>Proxy: POST /api/llm (Prompt + Bearer JWT)
    Proxy->>Proxy: Verify Clerk JWT (RS256 via Web Crypto)
    
    rect rgb(240, 248, 255)
        Note over Proxy, Groq: Primary Provider Attempt
        Proxy->>Groq: Dispatch Request (Llama 3 70B)
        alt Groq Success (HTTP 200)
            Groq-->>Proxy: Return Structured JSON Response
            Proxy-->>UI: 200 OK (Decision JSON)
        else Groq Fails / Rate Limited / Timeout
            Groq-->>Proxy: 429 Rate Limit / 5xx / Timeout
            Note over Proxy, OR: Instant Automatic Failover
            Proxy->>OR: Dispatch Request (Llama 3 / DeepSeek)
            alt OpenRouter Success
                OR-->>Proxy: Return Structured JSON Response
                Proxy-->>UI: 200 OK (Decision JSON)
            else OpenRouter Fails
                OR-->>Proxy: Error / Failure
                Note over Proxy, Gem: Final Fallback Provider
                Proxy->>Gem: Dispatch Request (Gemini 1.5 Flash)
                Gem-->>Proxy: Return Structured JSON Response
                Proxy-->>UI: 200 OK (Decision JSON)
            end
        end
    end
```

---

## Data Pipeline Architecture

```mermaid
flowchart LR
    A[Raw Retail CSV / XLSX] -->|PapaParse / XLSX| B[Web Worker Thread]
    B -->|Calculate Metrics| C[Local Financial Engine]
    C -->|Aggregate JSON| D[Clerk Authenticated Request]
    D -->|Post to /api/llm| E[Vercel Serverless Function]
    E -->|MCDA Prompting| F[Multi-Provider LLM Engine]
    F -->|Return Raw Text| G[JSON Extractor & Schema Validator]
    G -->|Sanitise Pairwise Matrix| H[AHP Math Engine]
    H -->|Calculate Priority Vector & CR| I[Save Decision Record to Supabase]
    I -->|Render| J[Interactive Dashboard]
```

---

## Security Architecture

```mermaid
graph TD
    subgraph Browser Context ["Client Browser (Insecure Context)"]
        B1["User Session & Token Storage"]
        B2["Client Code (JS Bundle)"]
        B3["No Secret API Keys in JS Bundle"]
    end

    subgraph Security Gate ["Serverless Gatekeeper (/api/llm)"]
        S1["Extract Bearer JWT Token"]
        S2["Decode Header & Payload"]
        S3["Verify RS256 Signature with Clerk Public PEM"]
        S4["Validate Expiration (exp > now)"]
    end

    subgraph Enclave ["Vercel Encrypted Environment"]
        E1["GROQ_API_KEY"]
        E2["OPENROUTER_API_KEY"]
        E3["GEMINI_API_KEY"]
    end

    B1 -->|Authorization Header| S1
    S1 --> S2 --> S3 --> S4
    S4 -->|Authorized| E1
    S4 -->|Authorized| E2
    S4 -->|Authorized| E3
```

- **Zero Client Leakage**: Neither `GROQ_API_KEY`, `OPENROUTER_API_KEY`, nor `GEMINI_API_KEY` are exposed to the client.
- **Cryptographic Authorization**: Every API call is verified against Clerk's public key using RS256 signature verification.
- **Isolated User State**: Database operations are protected using Supabase PostgreSQL RLS policies tied to the user's Clerk ID.
