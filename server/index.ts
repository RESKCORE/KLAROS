import "./env";
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "./auth";
import { prisma } from "./db";
import {
  createDecision,
  getDecisionWithDetails,
  listUserDecisions,
} from "./decision-repo";
import { autoAnalyzeFromSynthetic, seedSyntheticDataset } from "./synthetic";
import { storeUploadedDataset } from "./upload";
import { buildMarketMetrics } from "./metrics";

export const app = express();
const port = Number(process.env.PORT || 4000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "KLAROS API running" });
});

app.get("/api/decisions", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const statuses = Array.isArray(req.query.status)
      ? req.query.status
      : req.query.status
        ? [req.query.status]
        : [];

    const decisions = await listUserDecisions(userId, statuses as string[]);
    res.json(decisions.map(toDecisionResponse));
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/decisions", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { title, context } = req.body as { title?: string; context?: string };
    if (!title?.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const decision = await createDecision({
      userId,
      title: title.trim(),
      context: context?.trim() || undefined,
    });

    res.status(201).json(toDecisionResponse(decision));
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/decisions/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const decision = await getDecisionWithDetails(req.params.id);
    if (!decision || decision.userId !== userId) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    res.json(toDecisionResponse(decision));
  } catch (error) {
    handleError(res, error);
  }
});

app.patch("/api/decisions/:id/status", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { status } = req.body as { status?: string };
    const decision = await prisma.decision.findUnique({
      where: { id: req.params.id },
    });

    if (!decision || decision.userId !== userId) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    const updated = await prisma.decision.update({
      where: { id: decision.id },
      data: { status },
      include: { options: true, criteria: true, constraints: true },
    });

    res.json(toDecisionResponse(updated));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete("/api/decisions/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const decision = await prisma.decision.findUnique({
      where: { id: req.params.id },
    });

    if (!decision || decision.userId !== userId) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    await prisma.decision.delete({ where: { id: decision.id } });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/data-sources", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const dataSources = await prisma.dataSource.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            products: true,
            salesHistory: true,
            stockMovements: true,
            investments: true,
          },
        },
      },
    });

    if (dataSources.length === 0) {
      res.json([
        {
          id: "synthetic",
          name: "Synthetic Supermarket Data",
          type: "csv",
          status: "connected",
          lastSyncedAt: null,
          createdAt: null,
          updatedAt: null,
          isSynthetic: true,
          counts: null,
        },
      ]);
      return;
    }

    res.json(
      dataSources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type,
        status: source.status,
        lastSyncedAt: source.lastSyncedAt,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        counts: {
          products: source._count.products,
          salesHistory: source._count.salesHistory,
          stockMovements: source._count.stockMovements,
          investments: source._count.investments,
        },
      }))
    );
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/market-metrics/:dataSourceId", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const dataSource = await prisma.dataSource.findFirst({
      where: { id: req.params.dataSourceId, userId },
    });

    if (!dataSource) {
      res.status(404).json({ error: "Data source not found" });
      return;
    }

    const metrics = await buildMarketMetrics(prisma, dataSource.id);
    res.json(metrics);
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/connect-data", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const existing = await prisma.dataSource.findFirst({
      where: {
        userId,
        name: "Synthetic Supermarket Data",
      },
    });

    if (existing) {
      res.json({ ok: true, dataSourceId: existing.id });
      return;
    }

    const dataSource = await prisma.dataSource.create({
      data: {
        userId,
        name: "Synthetic Supermarket Data",
        type: "csv",
        status: "connected",
      },
    });

    res.json({ ok: true, dataSourceId: dataSource.id });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/connect-data", (_req, res) => {
  res.status(405).json({ error: "method_not_allowed", message: "Use POST /api/connect-data" });
});

app.post(
  "/api/upload-dataset",
  requireAuth,
  upload.fields([
    { name: "products", maxCount: 1 },
    { name: "sales", maxCount: 1 },
    { name: "stock", maxCount: 1 },
    { name: "investments", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const datasetName = String(req.body?.datasetName || "Custom Dataset").trim();

      if (!files?.products?.[0] || !files?.sales?.[0] || !files?.stock?.[0] || !files?.investments?.[0]) {
        res.status(400).json({ error: "Missing required files" });
        return;
      }

      const result = await storeUploadedDataset(prisma, {
        datasetName: datasetName || "Custom Dataset",
        userId,
        files: {
          products: files.products[0],
          sales: files.sales[0],
          stock: files.stock[0],
          investments: files.investments[0],
        },
      });

      res.status(201).json({ ok: true, dataSourceId: result.dataSourceId });
    } catch (error) {
      handleError(res, error);
    }
  },
);

app.post("/api/auto-analyze", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { dataSourceId } = req.body as { dataSourceId?: string };
    let dataSource = dataSourceId
      ? await prisma.dataSource.findFirst({ where: { id: dataSourceId, userId } })
      : await prisma.dataSource.findFirst({
          where: { userId, name: "Synthetic Supermarket Data" },
          orderBy: { createdAt: "desc" },
        });

    if (!dataSource) {
      dataSource = await prisma.dataSource.create({
        data: {
          userId,
          name: "Synthetic Supermarket Data",
          type: "csv",
          status: "connected",
        },
      });
    }

    const seedCount = await prisma.supermarketProduct.count({
      where: { dataSourceId: dataSource.id },
    });

    if (seedCount === 0 && dataSource.name === "Synthetic Supermarket Data") {
      await seedSyntheticDataset(prisma, dataSource.id);
    }

    const result = await autoAnalyzeFromSynthetic(prisma, userId, dataSource.id);
    res.json({ ok: true, decisionId: result.decisionId });
  } catch (error) {
    handleError(res, error);
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`API server running on http://localhost:${port}`);
    void checkDatabaseConnection();
  });
}

export default app;

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("API error:", error);
  if (isDatabaseConnectionError(message)) {
    res.status(503).json({
      error: "database_unavailable",
      message: "Database connection unavailable. Check Neon status or DATABASE_URL.",
    });
    return;
  }
  res.status(500).json({ error: message });
}

async function checkDatabaseConnection(retries = 5, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("Database connection: ok");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Database connection attempt ${attempt} failed: ${message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error("Database connection failed after retries. Verify Neon and DATABASE_URL.");
}

function isDatabaseConnectionError(message: string) {
  return (
    message.includes("Closed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection terminated") ||
    message.includes("database_unavailable")
  );
}

function toDecisionResponse(decision: {
  id: string;
  title: string;
  context: string | null;
  status: string;
  dataSourceId: string | null;
  decisionType: string | null;
  resultJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  options?: Array<{ id: string; label: string; notes: string | null; description: string | null }>;
  criteria?: Array<{ id: string; name: string; weight: number; description: string | null }>;
  constraints?: Array<{
    id: string;
    type: string;
    value: string;
    priority: number | null;
    description: string | null;
  }>;
}) {
  return {
    id: decision.id,
    title: decision.title,
    context: decision.context ?? undefined,
    status: decision.status,
    data_source_id: decision.dataSourceId ?? null,
    decision_type: decision.decisionType ?? null,
    result_json: decision.resultJson ?? undefined,
    created_at: decision.createdAt.toISOString(),
    updated_at: decision.updatedAt.toISOString(),
    user_id: decision.userId ?? undefined,
    options: (decision.options ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      notes: item.notes ?? undefined,
      description: item.description ?? undefined,
    })),
    criteria: (decision.criteria ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      weight: item.weight,
      description: item.description ?? undefined,
    })),
    constraints: (decision.constraints ?? []).map((item) => ({
      id: item.id,
      type: item.type,
      value: item.value,
      priority: item.priority ?? undefined,
      description: item.description ?? undefined,
    })),
  };
}
