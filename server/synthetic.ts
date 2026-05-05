import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type { PrismaClient } from "@prisma/client";

const DATASET_DIR = path.resolve(process.cwd(), "public", "market_Dataset", "dataset1");

type ProductRow = {
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  price?: string | number;
  cost?: string | number;
  supplier?: string;
  shelf_life_days?: string | number;
  weight_kg?: string | number;
  launch_date?: string;
};

type SalesRow = {
  sku: string;
  date: string;
  quantity?: string | number;
  revenue?: string | number;
  discount?: string | number;
  payment_method?: string;
  store_city?: string;
};

type StockRow = {
  sku: string;
  date: string;
  quantity?: string | number;
  beginning_stock?: string | number;
  units_sold?: string | number;
  reorder_point?: string | number;
  supplier_lead_time?: string | number;
};

type InvestmentRow = {
  date: string;
  amount?: string | number;
  category?: string;
  description?: string;
  expected_roi?: string | number;
  actual_roi?: string | number;
};

type ProductRowRecord = {
  id: string;
  productId: string;
  price: number;
  costPrice: number | null;
  name: string;
  category: string;
};

type ProductMetric = {
  product: ProductRowRecord;
  revenue: number;
  units: number;
  margin: number;
  stockLevel: number;
};

type Range = { min: number; max: number };

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function parseCsv<T>(fileName: string): Promise<T[]> {
  const filePath = path.join(DATASET_DIR, fileName);
  const content = await readFile(filePath, "utf-8");
  const parsed = Papa.parse<T>(content, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse failed for ${fileName}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

export async function seedSyntheticDataset(prisma: PrismaClient, dataSourceId: string) {
  const [products, sales, stock, investments] = await Promise.all([
    parseCsv<ProductRow>("products.csv"),
    parseCsv<SalesRow>("sales.csv"),
    parseCsv<StockRow>("stock.csv"),
    parseCsv<InvestmentRow>("investments.csv"),
  ]);

  await prisma.$transaction([
    prisma.salesHistory.deleteMany({ where: { dataSourceId } }),
    prisma.stockMovement.deleteMany({ where: { dataSourceId } }),
    prisma.investment.deleteMany({ where: { dataSourceId } }),
    prisma.purchase.deleteMany({ where: { dataSourceId } }),
    prisma.supermarketProduct.deleteMany({ where: { dataSourceId } }),
  ]);

  await prisma.supermarketProduct.createMany({
    data: products.map((row: ProductRow) => ({
      dataSourceId,
      productId: row.sku,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory || null,
      brand: row.brand || null,
      price: toNumber(row.price) ?? 0,
      costPrice: toNumber(row.cost) ?? null,
      unit: toNumber(row.weight_kg) ? "kg" : "unit",
      description: row.supplier ? `Supplier: ${row.supplier}` : null,
    })),
  });

  const productRows = (await prisma.supermarketProduct.findMany({
    where: { dataSourceId },
    select: { id: true, productId: true, price: true, costPrice: true, name: true, category: true },
  })) as ProductRowRecord[];

  const productBySku = new Map(productRows.map((row) => [row.productId, row]));

  await prisma.salesHistory.createMany({
    data: sales
      .map((row: SalesRow) => {
        const product = productBySku.get(row.sku);
        const saleDate = toDate(row.date);
        if (!product || !saleDate) return null;
        return {
          dataSourceId,
          productId: product.id,
          externalProductId: row.sku,
          saleDate,
          quantitySold: toNumber(row.quantity) ?? 0,
          revenue: toNumber(row.revenue) ?? 0,
          discount: toNumber(row.discount) ?? null,
          customerSegment: row.store_city || null,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  });

  await prisma.stockMovement.createMany({
    data: stock
      .map((row: StockRow) => {
        const product = productBySku.get(row.sku);
        const lastUpdated = toDate(row.date);
        if (!product || !lastUpdated) return null;
        return {
          dataSourceId,
          productId: product.id,
          currentStock: toNumber(row.quantity) ?? 0,
          lastUpdated,
          minStockThreshold: toNumber(row.reorder_point) ?? null,
          movementType: "snapshot",
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  });

  await prisma.investment.createMany({
    data: investments
      .map((row: InvestmentRow) => {
        const date = toDate(row.date);
        if (!date) return null;
        return {
          dataSourceId,
          date,
          amount: toNumber(row.amount) ?? 0,
          category: row.category || null,
          description: row.description || null,
          expectedRoi: toNumber(row.expected_roi) ?? null,
          actualRoi: toNumber(row.actual_roi) ?? null,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  });

  return {
    productCount: productRows.length,
    salesCount: sales.length,
    stockCount: stock.length,
    investmentCount: investments.length,
  };
}

export async function autoAnalyzeFromSynthetic(prisma: PrismaClient, userId: string, dataSourceId: string) {
  const existingCount = await prisma.supermarketProduct.count({ where: { dataSourceId } });
  if (existingCount === 0) {
    await seedSyntheticDataset(prisma, dataSourceId);
  }

  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
    select: { name: true },
  });
  const datasetName = dataSource?.name || "Synthetic Supermarket Data";

  const [products, sales, stock] = await Promise.all([
    prisma.supermarketProduct.findMany({ where: { dataSourceId } }),
    prisma.salesHistory.findMany({ where: { dataSourceId } }),
    prisma.stockMovement.findMany({ where: { dataSourceId } }),
  ]);

  const revenueByProduct = new Map<string, number>();
  const unitsByProduct = new Map<string, number>();

  for (const row of sales) {
    revenueByProduct.set(row.productId ?? "", (revenueByProduct.get(row.productId ?? "") ?? 0) + row.revenue);
    unitsByProduct.set(row.productId ?? "", (unitsByProduct.get(row.productId ?? "") ?? 0) + row.quantitySold);
  }

  const stockByProduct = new Map<string, number>();
  for (const row of stock) {
    stockByProduct.set(row.productId, row.currentStock);
  }

  const productMetrics: ProductMetric[] = products
    .map((product) => {
      const revenue = revenueByProduct.get(product.id) ?? 0;
      const units = unitsByProduct.get(product.id) ?? 0;
      const margin = (product.price ?? 0) - (product.costPrice ?? 0);
      const stockLevel = stockByProduct.get(product.id) ?? 0;
      return { product: product as ProductRowRecord, revenue, units, margin, stockLevel };
    })
    .sort((a: ProductMetric, b: ProductMetric) => b.revenue - a.revenue);

  const topProducts = productMetrics.slice(0, 3);

  const options = topProducts.map((item) => ({
    title: `Expand ${item.product.name}`,
    description: `Increase merchandising and availability for ${item.product.name} (category: ${item.product.category}).`,
  }));

  const criteria = [
    { name: "Revenue Impact", weight: 9, description: "Projected sales uplift." },
    { name: "Margin Potential", weight: 8, description: "Gross margin contribution." },
    { name: "Demand Velocity", weight: 7, description: "Sales volume consistency." },
    { name: "Inventory Risk", weight: 6, description: "Stock pressure and replenishment risk." },
  ];

  const revenueValues = topProducts.map((item) => item.revenue);
  const marginValues = topProducts.map((item) => item.margin);
  const unitsValues = topProducts.map((item) => item.units);
  const stockValues = topProducts.map((item) => item.stockLevel);

  const maxMin = (values: number[]): Range => ({
    min: Math.min(...values, 0),
    max: Math.max(...values, 1),
  });

  const revenueRange = maxMin(revenueValues);
  const marginRange = maxMin(marginValues);
  const unitsRange = maxMin(unitsValues);
  const stockRange = maxMin(stockValues);

  const scale = (value: number, range: Range) => {
    if (range.max === range.min) return 5;
    const normalized = (value - range.min) / (range.max - range.min);
    return Math.max(1, Math.min(10, Math.round(normalized * 9 + 1)));
  };

  const decision = await prisma.decision.create({
    data: {
      userId,
      dataSourceId,
      title: `${datasetName} BI Analysis`,
      context: `Prototype auto-analysis based on ${datasetName}.`,
      status: "done",
      decisionType: "business_intelligence",
      resultJson: {
        recommendation: {
          optionId: "",
          optionLabel: topProducts[0]?.product.name ?? "",
          confidence: 0.72,
          summary: "Top revenue products were prioritized based on demand and margin signals.",
        },
      },
    },
  });

  const createdCriteria = await Promise.all(
    criteria.map((item) =>
      prisma.criterion.create({
        data: {
          decisionId: decision.id,
          name: item.name,
          weight: item.weight,
          description: item.description,
        },
      }),
    ),
  );

  const createdOptions = await Promise.all(
    options.map((item) =>
      prisma.option.create({
        data: {
          decisionId: decision.id,
          label: item.title,
          description: item.description,
        },
      }),
    ),
  );

  const scoresPayload = createdOptions.flatMap((option, index) => {
    const metric = topProducts[index];
    if (!metric) return [];

    return createdCriteria.map((criterion) => {
      let score = 5;
      if (criterion.name === "Revenue Impact") {
        score = scale(metric.revenue, revenueRange);
      } else if (criterion.name === "Margin Potential") {
        score = scale(metric.margin, marginRange);
      } else if (criterion.name === "Demand Velocity") {
        score = scale(metric.units, unitsRange);
      } else if (criterion.name === "Inventory Risk") {
        score = scale(metric.stockLevel, stockRange);
      }

      return {
        optionId: option.id,
        criterionId: criterion.id,
        score,
        notes: "Synthetic score derived from dataset metrics.",
      };
    });
  });

  if (scoresPayload.length > 0) {
    await prisma.score.createMany({ data: scoresPayload });
  }

  return {
    decisionId: decision.id,
  };
}
