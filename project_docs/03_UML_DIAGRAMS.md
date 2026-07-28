# 03 — UML Diagrams & Domain Specifications

> **Domain Types**: [`src/features/decisions/types/decision.ts`](file:///e:/KLAROS/src/features/decisions/types/decision.ts)  
> **Market Metrics Core**: [`src/features/market/utils/market-metrics-core.ts`](file:///e:/KLAROS/src/features/market/utils/market-metrics-core.ts)  
> **Zod Schemas**: [`src/features/decisions/core/analysis-schema.ts`](file:///e:/KLAROS/src/features/decisions/core/analysis-schema.ts)

---

## 1. Domain & Class UML Diagram

The diagram below outlines the core domain entities, data structures, and utility modules powering KLAROS:

```mermaid
classDiagram
    class MarketDataset {
        +SalesRow[] sales
        +ProductRow[] products
        +StockRow[] stock
        +InvestmentRow[] investments
    }

    class MarketMetrics {
        +number totalRevenue
        +number totalCost
        +number grossProfit
        +number grossProfitMargin
        +number lowStockItemsCount
        +CategoryMetrics[] categories
        +TopProduct[] topProducts
    }

    class DecisionRecord {
        +string id
        +string userId
        +string title
        +string datasetId
        +string status
        +StrategicOption[] options
        +CriteriaWeights criteriaWeights
        +ComparisonTriple comparisonTriple
        +number consistencyRatio
        +string createdAt
    }

    class StrategicOption {
        +string id
        +string title
        +string description
        +number score
        +string impactLevel
        +string[] pros
        +string[] cons
    }

    class CriteriaWeights {
        +number marginOptimization
        +number inventoryVelocity
        +number capitalRisk
    }

    class AHPMathEngine {
        +buildPairwiseMatrix(comparisons) number[][]
        +calculatePriorityVector(matrix) number[]
        +calculateLambdaMax(matrix, priorityVector) number
        +calculateConsistencyRatio(matrix) number
        -clampSaaty(val) number
    }

    class LLMProxyClient {
        +dispatchMCDAAnalysis(payload) Promise~DecisionRecord~
        -verifyClerkJwt(token) Promise~void~
        -executeFallbackChain(prompt) Promise~string~
    }

    class MarketMetricsWorker {
        +buildMetrics(dataset) MarketMetrics
        +buildHistory(dataset, months) MarketHistory
        -schwartzianSort(array) Array
        -deduplicateSales(sales) SalesRow[]
    }

    MarketDataset --> MarketMetricsWorker : Processed by
    MarketMetricsWorker --> MarketMetrics : Produces
    MarketMetrics --> LLMProxyClient : Input compiled into
    LLMProxyClient --> AHPMathEngine : Validates pairwise values with
    LLMProxyClient --> DecisionRecord : Generates
    DecisionRecord *-- StrategicOption : Contains 3
    DecisionRecord *-- CriteriaWeights : Contains calculated weights
```

---

## 2. Sequence Diagram: Data Ingestion & Web Worker Processing

This sequence diagram illustrates how a user uploads CSV/XLSX files, processes raw data in a background Web Worker, computes financial KPIs, and caches the result:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant ConnectPage as ConnectData.tsx
    participant Papa as PapaParse / SheetJS
    participant Worker as market-metrics.worker.ts
    participant BI as bi-api.ts
    participant Supabase as Supabase Database

    User->>ConnectPage: Drag & Drop CSV / Excel File
    ConnectPage->>Papa: Parse file to JSON rows
    Papa-->>ConnectPage: Raw rows (sales, products, stock)
    
    ConnectPage->>Worker: postMessage({ type: 'BUILD_METRICS', payload: dataset })
    Note over Worker: Off main thread (60 FPS UI preserved)
    Worker->>Worker: Deduplicate sales rows O(N)
    Worker->>Worker: Perform Schwartzian sort on dates
    Worker->>Worker: Calculate revenue, profit margins & low stock
    Worker-->>ConnectPage: postMessage({ type: 'METRICS_RESULT', payload: metrics })
    
    ConnectPage->>BI: saveDataSource(name, metrics, rawData)
    BI->>Supabase: INSERT INTO data_sources (user_id, name, record_count, metadata)
    Supabase-->>BI: 201 Created (data_source_id)
    BI-->>ConnectPage: DataSource Saved Successfully
    ConnectPage->>User: Display Success Toast & Navigate to Dashboard
```

---

## 3. Sequence Diagram: AI Decision Execution & AHP Math Validation

This sequence diagram details the execution of an MCDA analysis request from the user interface down through the serverless proxy, AI fallback, AHP matrix validation, and database storage:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Dashboard as Dashboard.tsx
    participant Store as decision-store.ts
    participant Proxy as Vercel /api/llm Proxy
    participant AI as AI Engine (Groq / OpenRouter / Gemini)
    participant AHP as ahp-math.ts
    participant Supabase as Supabase Database

    User->>Dashboard: Click "Run AI Decision Analysis"
    Dashboard->>Store: createDecision(datasetId, metrics)
    Store->>Proxy: POST /api/llm (Clerk Bearer JWT + Compiled Payload)
    
    Proxy->>Proxy: Authenticate via Web Crypto RS256 JWT
    Proxy->>AI: Dispatch prompt request
    AI-->>Proxy: Return JSON response (Options + Pairwise Comparison Triple [3, 5, 2])
    
    Proxy->>AHP: buildPairwiseMatrix([3, 5, 2])
    AHP->>AHP: clampSaaty() guard check
    AHP-->>Proxy: $3 \times 3$ positive reciprocal matrix
    
    Proxy->>AHP: calculatePriorityVector(matrix)
    AHP-->>Proxy: Priority Vector w = [0.648, 0.230, 0.122]
    
    Proxy->>AHP: calculateConsistencyRatio(matrix)
    AHP-->>Proxy: CR = 0.00319 (CR < 0.10 Verified)
    
    Proxy-->>Store: 200 OK (Validated Decision Payload)
    Store->>Supabase: INSERT INTO decisions (user_id, title, options, weights, cr)
    Supabase-->>Store: 201 Created
    Store-->>Dashboard: Update React state via TanStack Query
    Dashboard->>User: Render Decision Summary Dashboard & Options
```

---

## 4. Entity-Relationship (ER) Diagram (Supabase Schema)

```mermaid
erDiagram
    USERS ||--o{ DATA_SOURCES : "owns"
    USERS ||--o{ DECISIONS : "creates"
    DATA_SOURCES ||--o{ DECISIONS : "analyzed in"

    USERS {
        string clerk_id PK
        string email
        timestamp created_at
    }

    DATA_SOURCES {
        uuid id PK
        string user_id FK "References Clerk ID"
        string name
        int4 record_count
        jsonb metadata "Contains total_revenue, margin, low_stock"
        timestamp created_at
    }

    DECISIONS {
        uuid id PK
        string user_id FK "References Clerk ID"
        uuid data_source_id FK "References DATA_SOURCES.id"
        string title
        string status
        jsonb options "Array of 3 Strategic Options"
        jsonb criteria_weights "Object: {margin, velocity, risk}"
        jsonb comparison_triple "Array of 3 comparison numbers"
        float8 consistency_ratio "CR numeric score"
        timestamp created_at
    }
```

---

## 5. Use Case Diagram

```mermaid
usecaseDiagram
    actor RetailUser as "Retail Executive / Manager"
    actor AIProvider as "LLM Provider (Groq/Gemini)"
    actor AuthProvider as "Clerk Auth"

    package KLAROS_Platform {
        usecase UC1 as "Upload & Process Retail Dataset"
        usecase UC2 as "Calculate Financial KPIs & Low-Stock Alerts"
        usecase UC3 as "Run AHP-MCDA Strategic Decision Analysis"
        usecase UC4 as "View AI 3-Month Revenue Forecast"
        usecase UC5 as "Compare Historical Decision Reports"
        usecase UC6 as "Delete Data Sources & Decisions"
    }

    RetailUser --> UC1
    RetailUser --> UC2
    RetailUser --> UC3
    RetailUser --> UC4
    RetailUser --> UC5
    RetailUser --> UC6

    UC1 ..> AuthProvider : <<requires auth>>
    UC3 ..> AIProvider : <<dispatches prompt>>
    UC3 ..> AuthProvider : <<verifies JWT>>
```

---

## 6. Component Topology Diagram

```mermaid
graph TD
    subgraph Client App ["Client SPA Topology"]
        C1["Pages Layer\n(Index, Dashboard, DecisionResult, ConnectData, History)"]
        C2["UI Components Layer\n(DashboardSidebar, KPI Cards, Recharts Analytics)"]
        C3["State Management Layer\n(TanStack Query, DecisionStore)"]
        C4["Worker Thread Engine\n(market-metrics.worker.ts)"]
    end

    subgraph Serverless Endpoints ["Vercel Edge & Node API"]
        E1["/api/llm Proxy"]
        E2["/api/keep-alive Ping"]
    end

    subgraph External Infrastructure ["External Cloud Infrastructure"]
        X1["Clerk Identity Provider"]
        X2["Supabase PostgreSQL Cloud"]
        X3["Groq / OpenRouter / Gemini Cloud"]
    end

    C1 --> C2 --> C3
    C3 --> C4
    C1 -->|Authenticate| X1
    C3 -->|Proxy AI Calls| E1
    C3 -->|Data Persistence| X2
    E1 -->|RS256 Validation| X1
    E1 -->|Multi-Provider Fallback| X3
    E2 -->|Database Ping| X2
```
