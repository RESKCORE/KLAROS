import { generateMcdaAnalysis } from '../src/services/llm/llm-service';

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   🧮  AHP-Powered MCDA Engine — Live End-to-End    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  console.log('📦  Data Source: scripts/test-data/ (4 CSVs)');
  console.log('');
  console.log('  ⚠️  EXTREMES IN THIS DATASET:');
  console.log('  • SKU002 Cheap Plastic Thing — 10x margin (₹1 cost, ₹10 price), 15K units sold');
  console.log('  • SKU004 Exploding Battery — NEGATIVE margin (₹1,500 cost, ₹1,000 price)');
  console.log('  • SKU001 & SKU004 — ZERO stock (stockouts), reorder points unmet');
  console.log('  • SKU002 — 5,00,000 units in stock (massive overstock)');
  console.log('  • ₹10,00,000 Marketing campaign — NEGATIVE ROI (-0.2, i.e. -20%)');
  console.log('');

  const metricsJson = JSON.stringify({
    topProducts: [
      { sku: 'SKU002', name: 'Cheap Plastic Thing', category: 'Toys', price: 10, cost: 1, marginPct: 900, revenue: 150000, unitsSold: 15000 },
      { sku: 'SKU001', name: 'Premium Golden Widget', category: 'Electronics', price: 50000, cost: 45000, marginPct: 10, revenue: 50000, unitsSold: 1 },
      { sku: 'SKU003', name: 'Standard Cable', category: 'Electronics', price: 500, cost: 250, marginPct: 100, revenue: 10000, unitsSold: 20 },
      { sku: 'SKU004', name: 'Exploding Battery', category: 'Electronics', price: 1000, cost: 1500, marginPct: -50, revenue: 5000, unitsSold: 5 },
    ],
    categories: ['Electronics', 'Toys', 'Power'],
    inventory: {
      totalSKUs: 4,
      lowStockCount: 2,
      lowStockItems: ['SKU001 Premium Golden Widget (0 stock, reorder at 5)', 'SKU004 Exploding Battery (0 stock, reorder at 100)'],
      overstockCount: 1,
      overstockItems: ['SKU002 Cheap Plastic Thing (5,00,000 stock, reorder at 10,000)'],
      totalInventoryValue: 500000 * 1 + 0 * 45000 + 100 * 250 + 0 * 1500,
    },
    investments: [
      { description: 'Mega Campaign for Widgets', amount: 1000000, expectedROI: 1.5, actualROI: -0.2, status: 'disaster' },
      { description: 'Warehouse Brooms', amount: 5000, expectedROI: 1.1, actualROI: 1.1, status: 'success' },
    ],
    totalRevenue: 215000,
  });

  console.log('📦  Metrics JSON sent to AI:');
  console.log(metricsJson);
  console.log('');

  console.log('⏳  Calling AI with pairwise comparison prompt...');
  console.log('');

  const response = await generateMcdaAnalysis(metricsJson);

  console.log('════════════════════════════════════════════════════════');
  console.log('📋  AI-GENERATED STRATEGIC OPTIONS');
  console.log('════════════════════════════════════════════════════════');
  for (const opt of response.options ?? []) {
    console.log(`  • ${opt.label}`);
    if (opt.description) console.log(`    ${opt.description}`);
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('📋  EVALUATION CRITERIA');
  console.log('════════════════════════════════════════════════════════');
  for (const crit of response.criteria ?? []) {
    console.log(`  • ${crit.name}`);
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('⚖️   RAW PAIRWISE COMPARISONS (Saaty 1-9 scale)');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Criteria Comparisons:');
  console.log(`    [C1 vs C2,  C1 vs C3,  C2 vs C3]`);
  console.log(`    [${response.criteriaComparisons?.join(',  ')}]`);
  if (response.criteria?.length === 3 && response.criteriaComparisons) {
    const [c1, c2, c3] = response.criteria;
    const [v12, v13, v23] = response.criteriaComparisons;
    console.log(`    → ${c1.name}:${c2.name} = ${v12},  ${c1.name}:${c3.name} = ${v13},  ${c2.name}:${c3.name} = ${v23}`);
  }

  console.log('');
  console.log('  Option Comparisons (per criterion):');
  for (let ci = 0; ci < (response.optionComparisons ?? []).length; ci++) {
    const critName = response.criteria?.[ci]?.name ?? `c${ci + 1}`;
    const comps = response.optionComparisons![ci] as [number, number, number] | undefined;
    if (comps) {
      console.log(`    ${critName}:  [O1 vs O2: ${comps[0]},  O1 vs O3: ${comps[1]},  O2 vs O3: ${comps[2]}]`);
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('📊  COMPUTED AHP CRITERIA WEIGHTS');
  console.log('════════════════════════════════════════════════════════');
  const critWeightSum = (response.criteria ?? []).reduce((s, c) => s + (c.weight ?? 0), 0);
  for (const crit of response.criteria ?? []) {
    const bar = '█'.repeat(Math.round((crit.weight ?? 0) * 40));
    console.log(`  ${crit.name.padEnd(16)} ${(crit.weight! * 100).toFixed(1).padStart(5)}%  ${bar}`);
  }
  console.log(`  ${'─'.repeat(16)} ${'─'.repeat(7)}`);
  console.log(`  ${'SUM'.padEnd(16)} ${(critWeightSum * 100).toFixed(1).padStart(5)}%  (should be ~100%)`);

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🏆  FINAL NORMALIZED SCORES (0–100)');
  console.log('════════════════════════════════════════════════════════');
  for (const score of response.scores ?? []) {
    const optionId = String(score.optionId ?? '');
    const optionLabel = response.options?.find(o => o.id === optionId)?.label ?? optionId;
    const total = typeof score.total === 'number' ? score.total : 0;
    const bar = '█'.repeat(Math.round(total / 100 * 40));
    const rank = (response.scores ?? [])
      .map((s, i) => ({ idx: i, val: typeof s.total === 'number' ? s.total : 0 }))
      .sort((a, b) => b.val - a.val)
      .findIndex(s => s.val === total) + 1;
    console.log(`  #${rank}  ${optionLabel.padEnd(20)} ${total.toFixed(0).padStart(3)}/100  ${bar}`);
  }

  const sortedScores = [...(response.scores ?? [])].sort(
    (a, b) => (typeof b.total === 'number' ? b.total : 0) - (typeof a.total === 'number' ? a.total : 0),
  );
  const winner = sortedScores[0];
  if (winner) {
    const winnerLabel = response.options?.find(o => o.id === winner.optionId)?.label ?? String(winner.optionId ?? '');
    console.log('');
    console.log(`  🥇  RECOMMENDATION: ${winnerLabel}  (score: ${typeof winner.total === 'number' ? winner.total.toFixed(0) : '?'}/100)`);
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('💡  REASONING');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  ${response.recommendation ?? '(none)'}`);
  if (response.reasoning) {
    console.log('');
    console.log(`  Decomposition: ${response.reasoning.decomposition}`);
    console.log('');
    console.log('  Assumptions:');
    for (const a of response.reasoning.assumptions ?? []) console.log(`    • ${a}`);
    console.log('');
    console.log('  Tradeoffs:');
    for (const t of response.reasoning.tradeoffs ?? []) console.log(`    • ${t}`);
    console.log('');
    console.log('  Risks:');
    for (const r of response.reasoning.risks ?? []) console.log(`    • ${r}`);
    console.log('');
    console.log(`  Sensitivity: ${response.reasoning.sensitivity}`);
  }
  console.log('');
  console.log(`  Confidence: ${response.confidence ?? 'N/A'}/100`);

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('✅  AHP-Powered MCDA Analysis Complete');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('❌  AHP Live Test Failed');
  console.error('════════════════════════════════════════════════════');
  console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    const lines = err.stack.split('\n').slice(1, 4).join('\n');
    console.error(`  ${lines}`);
  }
  console.error('');
  process.exit(1);
});
