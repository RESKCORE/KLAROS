import React from 'react';
import { Card } from '@/components/ui/card';
import { IndianRupee, Package, Tag, Activity, TrendingUp } from 'lucide-react';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';

interface DecisionKpiCardsProps {
  kpis: MarketMetrics['kpis'];
  currencyFormatter: Intl.NumberFormat;
  numberFormatter: Intl.NumberFormat;
}

export const DecisionKpiCards: React.FC<DecisionKpiCardsProps> = ({
  kpis,
  currencyFormatter,
  numberFormatter,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Card 1: Total Revenue */}
      <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <IndianRupee className="h-5 w-5" />
          </div>
          <TrendingUp className="h-4 w-4 text-slate-300" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Total Revenue</p>
          <h2 className="text-2xl font-semibold text-slate-800 mt-1 tracking-tight">
            {currencyFormatter.format(kpis.totalRevenue)}
          </h2>
          <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
            +{kpis.profitMarginPct.toFixed(1)}% <span className="text-slate-400 font-medium">margin</span>
          </p>
        </div>
      </Card>

      {/* Card 2: Total Units Sold */}
      <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Package className="h-5 w-5" />
          </div>
          <TrendingUp className="h-4 w-4 text-slate-300" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Total Units Sold</p>
          <h2 className="text-2xl font-semibold text-slate-800 mt-1 tracking-tight">
            {numberFormatter.format(kpis.totalUnits)} <span className="text-sm font-medium text-slate-500">items</span>
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-1">
            {kpis.skuCount} SKUs <span className="text-slate-400 font-medium">active</span>
          </p>
        </div>
      </Card>

      {/* Card 3: Low Stock SKUs */}
      <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Tag className="h-5 w-5" />
          </div>
          <TrendingUp className="h-4 w-4 text-slate-300" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Low Stock SKUs</p>
          <h2 className="text-2xl font-semibold text-slate-800 mt-1 tracking-tight">
            {kpis.lowStockCount} <span className="text-sm font-medium text-slate-500">items</span>
          </h2>
          <p className="text-xs font-medium text-rose-500 mt-1">
            {kpis.avgDiscount.toFixed(2)}% <span className="text-slate-400 font-medium">avg discount</span>
          </p>
        </div>
      </Card>

      {/* Card 4: Net Profit */}
      <Card className="rounded-3xl border border-slate-100/60 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Activity className="h-5 w-5" />
          </div>
          <TrendingUp className="h-4 w-4 text-slate-300" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Net Profit</p>
          <h2 className="text-2xl font-semibold text-slate-800 mt-1 tracking-tight">
            {currencyFormatter.format(kpis.totalProfit)}
          </h2>
          <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-0.5">
            +{kpis.profitMarginPct.toFixed(1)}% <span className="text-slate-400 font-medium">margin</span>
          </p>
        </div>
      </Card>
    </div>
  );
};
