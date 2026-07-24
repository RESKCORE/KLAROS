/**
 * @file market-metrics.worker.ts
 * @description Web Worker for off-main-thread KPI computation.
 *
 * Why a Web Worker?
 *   buildMetrics on a 50 MB CSV (≥500 000 sales rows) performs ~6 full O(n)
 *   passes over the data set.  On a mid-range mobile device this takes
 *   800 ms–3 s of synchronous main-thread time, during which React cannot
 *   process input events, animations stutter, and Safari may show the
 *   "Unresponsive Script" dialog.
 *
 *   Running the computation in a dedicated worker thread keeps the UI
 *   completely responsive.  The worker receives raw arrays via structured
 *   clone (zero-copy for ArrayBuffers) and posts back the finished
 *   MarketMetrics object.
 *
 * Message protocol:
 *   → { type: 'BUILD_METRICS', payload: MarketDataset }
 *   ← { type: 'METRICS_RESULT', payload: MarketMetrics }
 *   ← { type: 'METRICS_ERROR', payload: string }
 *
 *   → { type: 'BUILD_HISTORY', payload: { dataset: Pick<MarketDataset, ...>, months: number } }
 *   ← { type: 'HISTORY_RESULT', payload: MarketHistory }
 *   ← { type: 'HISTORY_ERROR', payload: string }
 */

import { buildMetrics, buildHistory } from './market-metrics-core';
import type { MarketDataset } from './market-metrics-core';

type IncomingMessage =
  | { type: 'BUILD_METRICS'; payload: MarketDataset }
  | { type: 'BUILD_HISTORY'; payload: { dataset: Pick<MarketDataset, 'sales' | 'products' | 'stock'>; months: number } };

self.addEventListener('message', (event: MessageEvent<IncomingMessage>) => {
  const { type, payload } = event.data;

  try {
    if (type === 'BUILD_METRICS') {
      const result = buildMetrics(payload);
      self.postMessage({ type: 'METRICS_RESULT', payload: result });
    } else if (type === 'BUILD_HISTORY') {
      const result = buildHistory(payload.dataset, payload.months);
      self.postMessage({ type: 'HISTORY_RESULT', payload: result });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorType = type === 'BUILD_METRICS' ? 'METRICS_ERROR' : 'HISTORY_ERROR';
    self.postMessage({ type: errorType, payload: message });
  }
});
