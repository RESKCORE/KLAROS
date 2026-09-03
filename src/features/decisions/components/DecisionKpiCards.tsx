import React from 'react';
import { Card } from '@/components/ui/card';
import { IndianRupee, PoundSterling, DollarSign, Euro, Package, AlertOctagon, TrendingUp, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';

function CurrencyIcon({ currency, className }: { currency?: string; className?: string }) {
  switch (currency) {
    case 'GBP':
      return <PoundSterling className={className} />;
    case 'USD':
      return <DollarSign className={className} />;
    case 'EUR':
      return <Euro className={className} />;
    case 'INR':
    default:
      return <IndianRupee className={className} />;
  }
}

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
  const dk = kpis.domainKpis;

  // Card 1: Primary Value / Turnover / Inflow
  const card1Title = dk?.primaryMetric.label || 'Total Revenue';
  const card1Value = dk?.primaryMetric.formatted || currencyFormatter.format(kpis.totalRevenue);
  const card1Subtext = dk?.primaryMetric.subtext || 'Gross retail turnover';

  // Card 2: Volume / Units / Records / Outflows
  const card2Title = dk?.secondaryMetric.label || 'Total Units Sold';
  const card2Value = dk?.secondaryMetric.formatted || `${numberFormatter.format(kpis.totalUnits)} units`;
  const card2Badge = dk?.secondaryMetric.badgeText || `${numberFormatter.format(kpis.skuCount)} active SKUs`;
  const card2Subtext = dk ? `${card2Title} aggregate` : 'Aggregated sales volume';

  // Card 3: Risk / Volatility / Churn / Inventory Health
  const isInventoryUntracked = kpis.hasStockData === false;
  const card3Title = isInventoryUntracked
    ? 'Inventory Status'
    : dk?.riskAlertMetric.label || 'Inventory Status';
  const card3Value = isInventoryUntracked
    ? 'Not Tracked'
    : dk?.riskAlertMetric.value !== undefined
    ? String(dk.riskAlertMetric.value)
    : kpis.lowStockCount > 0
    ? `${kpis.lowStockCount} Low`
    : 'Healthy';
  const card3Badge = isInventoryUntracked
    ? 'No Stock Data'
    : dk?.riskAlertMetric.statusText || (kpis.lowStockCount > 0 ? `${kpis.lowStockCount} Reorder Alerts` : 'Optimal Inventory');
  const card3IsHealthy = isInventoryUntracked ? undefined : dk ? dk.riskAlertMetric.isHealthy : kpis.lowStockCount === 0;

  // Card 4: Performance / Net Cash / Return / Net Profit
  const card4Title = dk?.performanceMetric.label || (kpis.isCostEstimated ? 'Net Profit (Est.)' : 'Net Profit');
  const card4Value = dk?.performanceMetric.formatted || currencyFormatter.format(kpis.totalProfit);
  const card4Margin = dk?.performanceMetric.marginPct !== undefined ? dk.performanceMetric.marginPct : kpis.profitMarginPct;
  const card4Subtext = dk?.performanceMetric.subtext || (kpis.isCostEstimated ? 'Est. COGS (65% benchmark)' : 'Revenue minus operational COGS');
  const isHealthyMargin = card4Margin >= 20 || card4Margin > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Card 1: Primary Metric */}
      <Card className="group relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgba(59,130,246,0.08)] transition-all duration-300 overflow-hidden flex flex-col justify-between h-[152px]">
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100/60 flex items-center justify-center text-blue-600 shadow-sm">
            <CurrencyIcon currency={kpis.currency} className="h-5 w-5" />
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/80 px-2.5 py-0.5 rounded-full" title={kpis.isCostEstimated ? 'Estimated margin' : 'Measured performance'}>
            <ArrowUpRight className="h-3 w-3" />
            {card4Margin.toFixed(1)}% {kpis.domain === 'market_securities' ? 'return' : 'margin'} {kpis.isCostEstimated ? '(est.)' : ''}
          </span>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{card1Title}</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">
            {card1Value}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 mt-1">
            {card1Subtext}
          </p>
        </div>
      </Card>

      {/* Card 2: Secondary / Volume Metric */}
      <Card className="group relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgba(16,185,129,0.08)] transition-all duration-300 overflow-hidden flex flex-col justify-between h-[152px]">
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-100/60 flex items-center justify-center text-emerald-600 shadow-sm">
            <Package className="h-5 w-5" />
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100/80 px-2.5 py-0.5 rounded-full">
            {card2Badge}
          </span>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{card2Title}</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">
            {card2Value}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 mt-1">
            {card2Subtext}
          </p>
        </div>
      </Card>

      {/* Card 3: Risk / Alert Status */}
      <Card className="group relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgba(245,158,11,0.08)] transition-all duration-300 overflow-hidden flex flex-col justify-between h-[152px]">
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
        <div className="flex items-start justify-between">
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-sm border ${
            isInventoryUntracked
              ? 'bg-slate-100 border-slate-200 text-slate-500'
              : !card3IsHealthy
              ? 'bg-rose-50 border-rose-100/60 text-rose-600'
              : 'bg-emerald-50 border-emerald-100/60 text-emerald-600'
          }`}>
            {isInventoryUntracked ? (
              <Package className="h-5 w-5" />
            ) : !card3IsHealthy ? (
              <AlertOctagon className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            isInventoryUntracked
              ? 'bg-slate-100 text-slate-600 border-slate-200'
              : !card3IsHealthy
              ? 'bg-rose-50 text-rose-700 border-rose-200/60'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
          }`}>
            {card3Badge}
          </span>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{card3Title}</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">
            {card3Value}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 mt-1">
            {isInventoryUntracked ? 'No stock levels detected in dataset' : card3IsHealthy ? 'Optimal health' : 'Requires monitoring'}
          </p>
        </div>
      </Card>

      {/* Card 4: Net Performance / Profit */}
      <Card className="group relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgba(147,51,234,0.08)] transition-all duration-300 overflow-hidden flex flex-col justify-between h-[152px]">
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors pointer-events-none" />
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-2xl bg-purple-50 border border-purple-100/60 flex items-center justify-center text-purple-600 shadow-sm">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            isHealthyMargin
              ? 'bg-purple-50 text-purple-700 border-purple-100/80'
              : 'bg-slate-50 text-slate-700 border-slate-200'
          }`} title={kpis.isCostEstimated ? 'Estimated benchmark' : 'Measured from records'}>
            {card4Margin.toFixed(1)}% {kpis.domain === 'market_securities' ? 'Return' : 'Net Margin'} {kpis.isCostEstimated ? '(Est.)' : ''}
          </span>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{card4Title}</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">
            {card4Value}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 mt-1" title={card4Subtext}>
            {card4Subtext}
          </p>
        </div>
      </Card>
    </div>
  );
};
