/**
 * @file index.ts
 * @description Metrics factory and registry for all supported business domains in KLAROS.
 */

import type { DatasetDomain } from '@/services/llm/domain/dataset-classifier';
import type { MetricsModule } from './types';
import { RetailMetricsModule } from './retail-metrics';
import { SecuritiesMetricsModule } from './securities-metrics';
import { InventoryMetricsModule } from './inventory-metrics';
import { LedgerMetricsModule } from './ledger-metrics';
import { SubscriptionMetricsModule } from './subscription-metrics';
import { GenericMetricsModule } from './generic-metrics';

export * from './types';
export { RetailMetricsModule } from './retail-metrics';
export { SecuritiesMetricsModule } from './securities-metrics';
export { InventoryMetricsModule } from './inventory-metrics';
export { LedgerMetricsModule } from './ledger-metrics';
export { SubscriptionMetricsModule } from './subscription-metrics';
export { GenericMetricsModule } from './generic-metrics';

const modules: Record<DatasetDomain, MetricsModule> = {
  retail_transactions: new RetailMetricsModule(),
  market_securities: new SecuritiesMetricsModule(),
  inventory_stock: new InventoryMetricsModule(),
  financial_ledger: new LedgerMetricsModule(),
  subscription_saas: new SubscriptionMetricsModule(),
  generic_tabular: new GenericMetricsModule(),
};

/**
 * Returns the appropriate MetricsModule instance for a given business domain.
 * Defaults safely to RetailMetricsModule if unspecified or GenericMetricsModule if unrecognized.
 */
export function getMetricsModule(domain?: DatasetDomain): MetricsModule {
  if (!domain) return modules.retail_transactions;
  return modules[domain] || modules.generic_tabular;
}
