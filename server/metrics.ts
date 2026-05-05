import type { PrismaClient } from "@prisma/client";

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function buildMarketMetrics(prisma: PrismaClient, dataSourceId: string) {
  const [products, sales, stock, investments] = await Promise.all([
    prisma.supermarketProduct.findMany({ where: { dataSourceId } }),
    prisma.salesHistory.findMany({ where: { dataSourceId } }),
    prisma.stockMovement.findMany({ where: { dataSourceId } }),
    prisma.investment.findMany({ where: { dataSourceId } }),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));

  const revenueByDate = new Map<string, { revenue: number; units: number }>();
  const categoryMap = new Map<
    string,
    { revenue: number; units: number; cost: number; discountTotal: number; count: number }
  >();
  const paymentMap = new Map<string, number>();
  const productSalesMap = new Map<
    string,
    { id: string; name: string; revenue: number; units: number; cost: number }
  >();

  let totalRevenue = 0;
  let totalUnits = 0;
  let totalDiscount = 0;
  let totalCost = 0;

  sales.forEach((sale) => {
    const revenue = sale.revenue || 0;
    const quantity = sale.quantitySold || 0;
    const discount = sale.discount || 0;

    totalRevenue += revenue;
    totalUnits += quantity;
    totalDiscount += discount;

    const product = sale.productId ? productById.get(sale.productId) : undefined;
    const productCost = product?.costPrice ?? 0;
    const cost = quantity * productCost;
    totalCost += cost;

    const dateKey = formatDate(sale.saleDate);
    const dateEntry = revenueByDate.get(dateKey) || { revenue: 0, units: 0 };
    dateEntry.revenue += revenue;
    dateEntry.units += quantity;
    revenueByDate.set(dateKey, dateEntry);

    const category = product?.category || "Other";
    const categoryEntry = categoryMap.get(category) || {
      revenue: 0,
      units: 0,
      cost: 0,
      discountTotal: 0,
      count: 0,
    };
    categoryEntry.revenue += revenue;
    categoryEntry.units += quantity;
    categoryEntry.cost += cost;
    categoryEntry.discountTotal += discount;
    categoryEntry.count += 1;
    categoryMap.set(category, categoryEntry);

    const payment = sale.customerSegment || "Unknown";
    paymentMap.set(payment, (paymentMap.get(payment) || 0) + revenue);

    if (product) {
      const productEntry = productSalesMap.get(product.id) || {
        id: product.id,
        name: product.name,
        revenue: 0,
        units: 0,
        cost: 0,
      };
      productEntry.revenue += revenue;
      productEntry.units += quantity;
      productEntry.cost += cost;
      productSalesMap.set(product.id, productEntry);
    }
  });

  const revenueByDateArray = Array.from(revenueByDate.entries())
    .map(([date, data]) => ({ date, revenue: round(data.revenue, 2), units: round(data.units, 2) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const revenueByCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: round(data.revenue, 2),
      units: round(data.units, 2),
      marginPct: data.revenue > 0 ? round(((data.revenue - data.cost) / data.revenue) * 100, 1) : 0,
      avgDiscount: data.count > 0 ? round(data.discountTotal / data.count, 2) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const paymentMethodShare = Array.from(paymentMap.entries())
    .map(([method, revenue]) => ({ method, revenue: round(revenue, 2) }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProducts = Array.from(productSalesMap.values())
    .map((product) => ({
      sku: product.id,
      name: product.name,
      revenue: round(product.revenue, 2),
      units: round(product.units, 2),
      marginPct: product.revenue > 0 ? round(((product.revenue - product.cost) / product.revenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const latestStockByProduct = new Map<string, { current: number; threshold: number | null; updated: Date }>();
  stock.forEach((row) => {
    const existing = latestStockByProduct.get(row.productId);
    if (!existing || row.lastUpdated > existing.updated) {
      latestStockByProduct.set(row.productId, {
        current: row.currentStock,
        threshold: row.minStockThreshold,
        updated: row.lastUpdated,
      });
    }
  });

  const inventory = Array.from(latestStockByProduct.entries())
    .map(([productId, info]) => {
      const product = productById.get(productId);
      const reorderPoint = info.threshold ?? 0;
      const stockRatio = reorderPoint > 0 ? round(info.current / reorderPoint, 2) : 0;
      return {
        sku: productId,
        name: product?.name || productId,
        beginningStock: round(info.current, 2),
        unitsSold: 0,
        reorderPoint: round(reorderPoint, 2),
        stockRatio,
        leadTime: 0,
      };
    })
    .sort((a, b) => a.stockRatio - b.stockRatio)
    .slice(0, 8);

  const lowStockCount = Array.from(latestStockByProduct.values()).filter((info) => {
    if (!info.threshold || info.threshold <= 0) return false;
    return info.current <= info.threshold;
  }).length;

  const avgStockRatio = latestStockByProduct.size
    ? round(
        Array.from(latestStockByProduct.values()).reduce((sum, info) => {
          if (!info.threshold || info.threshold <= 0) return sum;
          return sum + info.current / info.threshold;
        }, 0) / latestStockByProduct.size,
        2,
      )
    : 0;

  const investmentRoi = investments
    .map((row) => ({
      date: row.date ? formatDate(row.date) : "",
      expected: row.expectedRoi ?? 0,
      actual: row.actualRoi ?? 0,
      amount: row.amount,
      category: row.category || "",
    }))
    .filter((row) => row.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const topCategories = revenueByCategory.slice(0, 3);
  const categoryNames = topCategories.map((item) => item.category);

  const maxRevenue = Math.max(...topCategories.map((item) => item.revenue), 1);
  const maxUnits = Math.max(...topCategories.map((item) => item.units), 1);
  const maxMargin = Math.max(...topCategories.map((item) => item.marginPct), 1);
  const maxDiscount = Math.max(...topCategories.map((item) => item.avgDiscount), 1);

  const normalizeToTen = (value: number, max: number) => round((value / max) * 10, 1);

  const categoryRadar = [
    {
      metric: "Revenue",
      ...Object.fromEntries(
        topCategories.map((category) => [category.category, normalizeToTen(category.revenue, maxRevenue)]),
      ),
    },
    {
      metric: "Units",
      ...Object.fromEntries(
        topCategories.map((category) => [category.category, normalizeToTen(category.units, maxUnits)]),
      ),
    },
    {
      metric: "Margin %",
      ...Object.fromEntries(
        topCategories.map((category) => [category.category, normalizeToTen(category.marginPct, maxMargin)]),
      ),
    },
    {
      metric: "Avg Discount",
      ...Object.fromEntries(
        topCategories.map((category) => [category.category, normalizeToTen(category.avgDiscount, maxDiscount)]),
      ),
    },
  ];

  return {
    kpis: {
      totalRevenue: round(totalRevenue, 2),
      totalCost: round(totalCost, 2),
      totalProfit: round(totalRevenue - totalCost, 2),
      profitMarginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : 0,
      totalUnits: round(totalUnits, 0),
      avgDiscount: sales.length > 0 ? round(totalDiscount / sales.length, 2) : 0,
      grossMarginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100, 1) : 0,
      skuCount: new Set(sales.map((sale) => sale.productId)).size,
      citiesCount: new Set(sales.map((sale) => sale.customerSegment || "Unknown")).size,
      lowStockCount,
    },
    revenueByDate: revenueByDateArray,
    revenueByCategory,
    paymentMethodShare,
    paymentLabel: "Store City Mix",
    topProducts,
    investmentRoi,
    inventory,
    inventorySummary: {
      belowReorder: lowStockCount,
      avgStockRatio,
    },
    categoryRadar,
    categoryNames,
  };
}
