import type { PrismaClient } from "@prisma/client";
import type { Express } from "express";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const ACCEPTED_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

type UploadFiles = {
  products: Express.Multer.File;
  sales: Express.Multer.File;
  stock: Express.Multer.File;
  investments: Express.Multer.File;
};

type ProductRow = {
  sku?: string;
  name?: string;
  category?: string;
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
  sku?: string;
  date?: string;
  quantity?: string | number;
  revenue?: string | number;
  discount?: string | number;
  payment_method?: string;
  store_city?: string;
};

type StockRow = {
  sku?: string;
  date?: string;
  quantity?: string | number;
  beginning_stock?: string | number;
  units_sold?: string | number;
  reorder_point?: string | number;
  supplier_lead_time?: string | number;
};

type InvestmentRow = {
  date?: string;
  amount?: string | number;
  category?: string;
  description?: string;
  expected_roi?: string | number;
  actual_roi?: string | number;
};

type UploadPayload = {
  datasetName: string;
  userId: string;
  files: UploadFiles;
};

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

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeKey(key)] = value;
    });
    return normalized;
  });
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function parseCsvBuffer<T>(buffer: Buffer): T[] {
  const parsed = Papa.parse<T>(buffer.toString("utf-8"), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message);
  }
  return parsed.data;
}

function parseXlsxBuffer<T>(buffer: Buffer): T[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<T>(sheet, { defval: "" });
}

function parseUploadFile<T>(file: Express.Multer.File): T[] {
  const ext = getExtension(file.originalname);
  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type: ${file.originalname}`);
  }
  const rows = ext === ".csv" ? parseCsvBuffer<T>(file.buffer) : parseXlsxBuffer<T>(file.buffer);
  return normalizeRows(rows as Record<string, unknown>[]) as T[];
}

export async function storeUploadedDataset(prisma: PrismaClient, payload: UploadPayload) {
  const { datasetName, userId, files } = payload;

  const products = parseUploadFile<ProductRow>(files.products);
  const sales = parseUploadFile<SalesRow>(files.sales);
  const stock = parseUploadFile<StockRow>(files.stock);
  const investments = parseUploadFile<InvestmentRow>(files.investments);

  const dataSource = await prisma.dataSource.create({
    data: {
      userId,
      name: datasetName,
      type: "csv",
      status: "connected",
      connectionDetails: {
        source: "upload",
        files: {
          products: files.products.originalname,
          sales: files.sales.originalname,
          stock: files.stock.originalname,
          investments: files.investments.originalname,
        },
      },
    },
  });

  await prisma.supermarketProduct.createMany({
    data: products.map((row) => ({
      dataSourceId: dataSource.id,
      productId: row.sku ?? "",
      name: row.name ?? row.sku ?? "",
      category: row.category ?? "Uncategorized",
      subcategory: row.subcategory || null,
      brand: row.brand || null,
      price: toNumber(row.price) ?? 0,
      costPrice: toNumber(row.cost) ?? null,
      unit: toNumber(row.weight_kg) ? "kg" : "unit",
      description: row.supplier ? `Supplier: ${row.supplier}` : null,
    })),
  });

  const productRows = await prisma.supermarketProduct.findMany({
    where: { dataSourceId: dataSource.id },
    select: { id: true, productId: true },
  });

  const productBySku = new Map(productRows.map((row) => [row.productId, row]));

  await prisma.salesHistory.createMany({
    data: sales
      .map((row) => {
        const saleDate = toDate(row.date ?? "");
        if (!saleDate) return null;
        const product = row.sku ? productBySku.get(row.sku) : null;
        return {
          dataSourceId: dataSource.id,
          productId: product?.id ?? null,
          externalProductId: row.sku ?? null,
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
      .map((row) => {
        const lastUpdated = toDate(row.date ?? "");
        const product = row.sku ? productBySku.get(row.sku) : null;
        if (!lastUpdated || !product) return null;
        const currentStock = toNumber(row.quantity) ?? toNumber(row.beginning_stock) ?? 0;
        return {
          dataSourceId: dataSource.id,
          productId: product.id,
          currentStock,
          lastUpdated,
          minStockThreshold: toNumber(row.reorder_point) ?? null,
          movementType: "snapshot",
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  });

  await prisma.investment.createMany({
    data: investments
      .map((row) => {
        const date = toDate(row.date ?? "");
        if (!date) return null;
        return {
          dataSourceId: dataSource.id,
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

  return { dataSourceId: dataSource.id };
}
