import { searchTransactionsForAnalysis } from './elasticTool.js';

const ANOMALY_THRESHOLD = 2.5;
const MIN_CURRENT_VOLUME = 10;

function bucketKey(bucket) {
  const { payment_method, gateway, bank, error_code } = bucket.key;
  return `${payment_method}|${gateway}|${bank}|${error_code ?? 'none'}`;
}

function parseBucket(bucket) {
  const total = bucket.total?.value || bucket.doc_count || 0;
  const failed = bucket.failed?.doc_count || 0;
  const failureRate = total > 0 ? failed / total : 0;

  return {
    payment_method: bucket.key.payment_method,
    gateway: bucket.key.gateway,
    bank: bucket.key.bank,
    error_code: bucket.key.error_code ?? null,
    total,
    failed,
    failure_rate: failureRate,
    failure_rate_pct: `${(failureRate * 100).toFixed(2)}%`,
  };
}

function buildBaselineMap(baselineBuckets) {
  const map = new Map();

  for (const bucket of baselineBuckets) {
    const key = bucketKey(bucket);
    map.set(key, parseBucket(bucket));
  }

  return map;
}

function isAnomalous(currentRate, baselineRate, currentVolume) {
  if (currentVolume < MIN_CURRENT_VOLUME) return false;
  if (baselineRate === 0) return currentRate >= 0.1;
  return currentRate >= baselineRate * ANOMALY_THRESHOLD && currentRate > baselineRate + 0.05;
}

export async function analyzeFailures(filters = {}) {
  const { current, baseline } = await searchTransactionsForAnalysis(filters);
  const baselineMap = buildBaselineMap(baseline);

  const groups = current.map((bucket) => {
    const key = bucketKey(bucket);
    const currentGroup = parseBucket(bucket);
    const baselineGroup = baselineMap.get(key);
    const baselineRate = baselineGroup?.failure_rate ?? 0.01;
    const baselineFailed = baselineGroup?.failed ?? 0;
    const baselineTotal = baselineGroup?.total ?? 0;

    const delta = currentGroup.failure_rate - baselineRate;
    const ratio = baselineRate > 0 ? currentGroup.failure_rate / baselineRate : currentGroup.failure_rate * 100;
    const anomalous = isAnomalous(currentGroup.failure_rate, baselineRate, currentGroup.total);

    return {
      ...currentGroup,
      baseline: {
        total: baselineTotal,
        failed: baselineFailed,
        failure_rate: baselineRate,
        failure_rate_pct: `${(baselineRate * 100).toFixed(2)}%`,
      },
      delta_pct: `${(delta * 100).toFixed(2)}%`,
      ratio_vs_baseline: `${ratio.toFixed(1)}x`,
      anomalous,
    };
  });

  groups.sort((a, b) => {
    if (a.anomalous !== b.anomalous) return a.anomalous ? -1 : 1;
    return b.failure_rate - a.failure_rate;
  });

  const anomalies = groups.filter((g) => g.anomalous);
  const topErrors = groups
    .filter((g) => g.failed > 0)
    .slice(0, 10)
    .map((g) => ({
      combination: `${g.payment_method} / ${g.gateway} / ${g.bank}`,
      error_code: g.error_code,
      current_rate: g.failure_rate_pct,
      baseline_rate: g.baseline.failure_rate_pct,
      failed_count: g.failed,
      total_count: g.total,
      anomalous: g.anomalous,
    }));

  const summaryByDimension = {
    payment_method: aggregateByDimension(groups, 'payment_method'),
    gateway: aggregateByDimension(groups, 'gateway'),
    bank: aggregateByDimension(groups, 'bank'),
    error_code: aggregateByDimension(groups, 'error_code'),
  };

  return {
    analyzed_at: new Date().toISOString(),
    total_groups: groups.length,
    anomalous_count: anomalies.length,
    anomalies,
    top_errors: topErrors,
    summary_by_dimension: summaryByDimension,
    groups,
  };
}

function aggregateByDimension(groups, dimension) {
  const map = new Map();

  for (const group of groups) {
    const key = group[dimension] ?? 'unknown';
    if (!map.has(key)) {
      map.set(key, { total: 0, failed: 0 });
    }
    const entry = map.get(key);
    entry.total += group.total;
    entry.failed += group.failed;
  }

  return [...map.entries()]
    .map(([name, stats]) => ({
      [dimension]: name,
      total: stats.total,
      failed: stats.failed,
      failure_rate_pct: stats.total > 0 ? `${((stats.failed / stats.total) * 100).toFixed(2)}%` : '0%',
    }))
    .sort((a, b) => b.failed - a.failed);
}
