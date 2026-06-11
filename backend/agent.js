import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  searchFailedTransactions,
  searchViaElasticMCP,
  writeIncident,
} from './tools/elasticTool.js';
import { analyzeFailures } from './tools/analyzerTool.js';
import { createJiraTicket } from './tools/jiraTool.js';

const STEPS = [
  { id: 'planning', name: 'Build investigation plan with Gemini' },
  { id: 'elastic_mcp_search', name: 'Search via Elastic MCP' },
  { id: 'elastic_search', name: 'Search failed transactions in Elasticsearch' },
  { id: 'analyze', name: 'Analyze failure patterns vs baseline' },
  { id: 'diagnose', name: 'Generate AI diagnosis with Gemini' },
  { id: 'jira', name: 'Create Jira incident ticket' },
  { id: 'elastic_write', name: 'Persist incident to Elasticsearch' },
];

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY must be configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return genAI.getGenerativeModel({ model: modelName });
}

function parseJsonResponse(text) {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}

function countByField(items, field) {
  const counts = {};
  for (const item of items) {
    const value = item[field] ?? 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count, pct: `${((count / items.length) * 100).toFixed(1)}%` }));
}

function buildResponseTimeStats(failures) {
  const times = failures
    .map((f) => f.response_time_ms)
    .filter((t) => typeof t === 'number' && !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (!times.length) return null;

  const sum = times.reduce((acc, t) => acc + t, 0);
  const p95Index = Math.min(times.length - 1, Math.floor(times.length * 0.95));

  return {
    avg_ms: Math.round(sum / times.length),
    min_ms: times[0],
    max_ms: times[times.length - 1],
    p95_ms: times[p95Index],
  };
}

function buildFailureDistributions(failures) {
  if (!failures.length) {
    return {
      total: 0,
      by_error_code: [],
      by_failure_stage: [],
      by_user_device: [],
      by_ip_region: [],
      by_payment_method: [],
      by_gateway: [],
      response_time_stats: null,
      timestamp_range: null,
    };
  }

  const timestamps = failures
    .map((f) => new Date(f.timestamp).getTime())
    .filter((t) => !Number.isNaN(t));

  return {
    total: failures.length,
    by_error_code: countByField(failures, 'error_code'),
    by_failure_stage: countByField(failures, 'failure_stage'),
    by_user_device: countByField(failures, 'user_device'),
    by_ip_region: countByField(failures, 'ip_region'),
    by_payment_method: countByField(failures, 'payment_method'),
    by_gateway: countByField(failures, 'gateway'),
    response_time_stats: buildResponseTimeStats(failures),
    timestamp_range:
      timestamps.length > 0
        ? {
            earliest: new Date(Math.min(...timestamps)).toISOString(),
            latest: new Date(Math.max(...timestamps)).toISOString(),
          }
        : null,
  };
}

function detectBaSignals(baContext = {}) {
  const notes = (baContext.additional_notes || '').toLowerCase();
  const startedAt = (baContext.started_at || '').toLowerCase();
  const combined = `${notes} ${startedAt}`;

  return {
    mentions_deployment:
      /deploy|hotfix|release|rollout|config change|push/.test(combined),
    mentions_mobile:
      /mobile|android|ios|app only|app users/.test(combined),
    mentions_premium: /premium|vip|paid user|subscription/.test(notes),
    mentions_region: Boolean(baContext.affected_region),
    mentions_payment_method: Boolean(baContext.affected_payment_method),
    has_any_context: Boolean(
      baContext.started_at ||
        baContext.affected_region ||
        baContext.affected_payment_method ||
        baContext.additional_notes
    ),
  };
}

function formatBaContextForPrompt(baContext) {
  if (!baContext) return 'No additional BA context provided.';

  const lines = [];
  if (baContext.started_at) lines.push(`- Time it started: ${baContext.started_at}`);
  if (baContext.affected_region) lines.push(`- Affected region: ${baContext.affected_region}`);
  if (baContext.affected_payment_method) {
    lines.push(`- Affected payment method: ${baContext.affected_payment_method}`);
  }
  if (baContext.additional_notes) lines.push(`- Additional notes: ${baContext.additional_notes}`);

  return lines.length ? lines.join('\n') : 'No additional BA context provided.';
}

function buildPlanningPrompt(userQuery, baContext) {
  return `You are PaySentinel, a payment failure investigation agent.

A business analyst has reported an issue. You do NOT have access to transaction logs yet.
Design an investigation plan based ONLY on the user query and BA context below.

USER QUERY: "${userQuery}"

BA CONTEXT:
${formatBaContextForPrompt(baContext)}

Available transaction log fields you can filter and analyze in the next phase:
- payment_method: UPI, card, netbanking, wallet
- ip_region: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Kolkata
- user_device: mobile, web, app
- failure_stage: gateway_auth, bank_processing, network, timeout, fraud_check
- error_code, gateway, bank, response_time_ms, retry_count, timestamp, status

Guidelines for your plan:
- Set filters.payment_method and filters.region to null unless BA context or the query strongly suggests scoping to a specific method or region.
- Choose time_window_hours (1-24) based on when the issue reportedly started.
- focus_areas should name the specific dimensions and signals you want retrieved (e.g. "gateway_auth failures", "mobile devices", "response times", "retry counts").
- Form 2-4 testable hypotheses grounded in the BA context.
- what_to_look_for must explain what evidence in the logs would confirm or deny EACH hypothesis.

Respond ONLY with valid JSON matching this exact schema (no markdown, no code fences):
{
  "filters": {
    "payment_method": "UPI or null",
    "region": "Mumbai or null",
    "time_window_hours": 2,
    "focus_areas": ["gateway_auth failures", "mobile devices", "response times"]
  },
  "hypotheses": [
    "Deployment at 3:30pm changed gateway config",
    "Mobile SDK issue with UPI flow"
  ],
  "what_to_look_for": "explanation of what data would confirm or deny each hypothesis"
}`;
}

function parseInvestigationPlan(text) {
  const parsed = parseJsonResponse(text);

  if (!parsed.filters || !Array.isArray(parsed.hypotheses) || !parsed.what_to_look_for) {
    throw new Error('Investigation plan missing required fields');
  }

  return {
    filters: {
      payment_method: parsed.filters.payment_method || null,
      region: parsed.filters.region || null,
      time_window_hours: parsed.filters.time_window_hours ?? 1,
      focus_areas: Array.isArray(parsed.filters.focus_areas) ? parsed.filters.focus_areas : [],
    },
    hypotheses: parsed.hypotheses,
    what_to_look_for: parsed.what_to_look_for,
  };
}

function fallbackInvestigationPlan(baContext = {}) {
  const focusAreas = ['error codes', 'failure rates'];
  const hypotheses = ['General payment failure spike in the reported time window'];
  const signals = detectBaSignals(baContext);

  if (baContext.affected_payment_method) {
    focusAreas.push(`${baContext.affected_payment_method} transactions`);
    hypotheses.push(`${baContext.affected_payment_method} payment path degradation`);
  }
  if (baContext.affected_region) {
    focusAreas.push(`failures concentrated in ${baContext.affected_region}`);
    hypotheses.push(`Regional routing or bank partner issue in ${baContext.affected_region}`);
  }
  if (signals.mentions_mobile) {
    focusAreas.push('mobile devices');
    hypotheses.push('Mobile-specific SDK or device integration issue');
  }
  if (signals.mentions_deployment) {
    focusAreas.push('gateway_auth failures', 'response times');
    hypotheses.push(
      `Deployment or config change around ${baContext.started_at || 'the reported time'} altered gateway behavior`
    );
  }

  return {
    filters: {
      payment_method: baContext.affected_payment_method || null,
      region: baContext.affected_region || null,
      time_window_hours: 1,
      focus_areas: focusAreas,
    },
    hypotheses,
    what_to_look_for:
      'Compare failure rates, error codes, device/region distributions, and response times against the 7-day baseline. Confirm whether failures align with BA-reported scope and timeline.',
  };
}

function planToSearchFilters(plan) {
  const { filters } = plan;
  const searchFilters = {
    time_window_hours: Math.min(Math.max(filters.time_window_hours || 1, 1), 24),
    payment_method: filters.payment_method || null,
    region: filters.region || null,
    user_device: null,
    failure_stage: null,
  };

  const focusText = (filters.focus_areas || []).join(' ').toLowerCase();

  if (/mobile/.test(focusText)) searchFilters.user_device = 'mobile';
  else if (/\bweb\b/.test(focusText)) searchFilters.user_device = 'web';
  else if (/\bapp\b/.test(focusText)) searchFilters.user_device = 'app';

  if (/gateway_auth/.test(focusText)) searchFilters.failure_stage = 'gateway_auth';
  else if (/bank_processing/.test(focusText)) searchFilters.failure_stage = 'bank_processing';
  else if (/timeout/.test(focusText)) searchFilters.failure_stage = 'timeout';
  else if (/network/.test(focusText)) searchFilters.failure_stage = 'network';
  else if (/fraud/.test(focusText)) searchFilters.failure_stage = 'fraud_check';

  return searchFilters;
}

function buildFocusAreaEvidence(plan, distributions) {
  const focusText = (plan.filters.focus_areas || []).join(' ').toLowerCase();
  const evidence = {};

  if (/response time|latency|slow|timeout/.test(focusText)) {
    evidence.response_times = distributions.response_time_stats;
  }
  if (/mobile|web|app|device/.test(focusText)) {
    evidence.user_device_distribution = distributions.by_user_device;
  }
  if (/region|geograph|mumbai|delhi|bangalore|chennai|hyderabad|kolkata/.test(focusText)) {
    evidence.region_distribution = distributions.by_ip_region;
  }
  if (/gateway_auth|bank_processing|failure.?stage|stage/.test(focusText)) {
    evidence.failure_stage_distribution = distributions.by_failure_stage;
  }
  if (/retry/.test(focusText)) {
    evidence.note = 'Check retry_count in sample failures for elevated retry patterns';
  }

  return Object.keys(evidence).length ? evidence : null;
}

function buildDiagnosisPrompt(userQuery, baContext, plan, failedData, analysis) {
  const distributions = buildFailureDistributions(failedData.failures);
  const focusEvidence = buildFocusAreaEvidence(plan, distributions);
  const filterNote = failedData.filters?.length
    ? `Applied search filters: ${failedData.filters.join(', ')}`
    : 'No additional search filters applied';

  return `You are PaySentinel, a payment failure investigation agent.

You previously formed an investigation plan BEFORE seeing log data. Transaction logs have now been retrieved according to that plan. Produce a final diagnosis by testing your hypotheses against the evidence.

USER QUERY: "${userQuery}"

BA CONTEXT:
${formatBaContextForPrompt(baContext)}

YOUR INVESTIGATION PLAN:
- Filters: ${JSON.stringify(plan.filters)}
- Hypotheses: ${JSON.stringify(plan.hypotheses)}
- What to look for: ${plan.what_to_look_for}

RETRIEVED DATA (${failedData.timeRange}, ${filterNote}):
- Failed transaction count: ${failedData.count}
- Sample failures: ${JSON.stringify(failedData.failures.slice(0, 5), null, 2)}

FAILURE DISTRIBUTIONS:
${JSON.stringify(distributions, null, 2)}

FOCUS AREA EVIDENCE (data retrieved per your plan):
${JSON.stringify(focusEvidence, null, 2)}

ANALYSIS RESULTS (vs 7-day baseline):
- Anomalous groups detected: ${analysis.anomalous_count}
- Top anomalies: ${JSON.stringify(analysis.anomalies.slice(0, 5), null, 2)}
- Top errors: ${JSON.stringify(analysis.top_errors.slice(0, 5), null, 2)}
- Summary by dimension: ${JSON.stringify(analysis.summary_by_dimension, null, 2)}

DIAGNOSIS INSTRUCTIONS:
1. For EACH hypothesis in your plan, explicitly state whether the evidence CONFIRMS, DENIES, or is INCONCLUSIVE — cite specific numbers from the distributions and analysis.
2. Cross-reference BA context with log findings (timeline alignment, region/device concentration, payment method match).
3. If a hypothesis is denied, explain what the data suggests instead.
4. Do NOT just restate error counts — reason about whether error codes and patterns make sense given BA context and your hypotheses.
5. recommended_actions must follow from confirmed or competing hypotheses, not generic monitoring advice.

Respond ONLY with valid JSON matching this exact schema (no markdown, no code fences):
{
  "summary": "concise description of what is failing, noting hypothesis outcomes",
  "affected": { "payment_method": "", "gateway": "", "bank": "" },
  "failure_rate": { "current": "percentage string", "baseline": "percentage string" },
  "probable_cause": "reasoned root cause citing hypothesis verdicts and evidence; flag BA context mismatches explicitly",
  "recommended_actions": ["context-specific action 1", "context-specific action 2", "context-specific action 3"]
}`;
}

function parseDiagnosis(text) {
  const parsed = parseJsonResponse(text);

  const required = ['summary', 'affected', 'failure_rate', 'probable_cause', 'recommended_actions'];
  for (const field of required) {
    if (parsed[field] === undefined) {
      throw new Error(`Diagnosis missing required field: ${field}`);
    }
  }

  return parsed;
}

async function generateInvestigationPlan(userQuery, baContext) {
  const model = getGeminiModel();
  const prompt = buildPlanningPrompt(userQuery, baContext);
  const result = await model.generateContent(prompt);
  return parseInvestigationPlan(result.response.text());
}

async function generateDiagnosis(userQuery, failedData, analysis, baContext, plan) {
  const model = getGeminiModel();
  const prompt = buildDiagnosisPrompt(userQuery, baContext, plan, failedData, analysis);
  const result = await model.generateContent(prompt);
  return parseDiagnosis(result.response.text());
}

function fallbackDiagnosis(analysis, plan) {
  const primary = analysis.anomalies[0] || analysis.groups[0];

  if (!primary) {
    return {
      summary: 'No significant payment failures detected in the investigation window',
      affected: { payment_method: 'none', gateway: 'none', bank: 'none' },
      failure_rate: { current: '0%', baseline: '0%' },
      probable_cause: `No anomalous failure patterns found. Hypotheses could not be confirmed: ${plan.hypotheses.join('; ')}`,
      recommended_actions: ['Continue monitoring transaction metrics'],
    };
  }

  return {
    summary: `Elevated failures detected for ${primary.payment_method} via ${primary.gateway} (${primary.bank})`,
    affected: {
      payment_method: primary.payment_method,
      gateway: primary.gateway,
      bank: primary.bank,
    },
    failure_rate: {
      current: primary.failure_rate_pct,
      baseline: primary.baseline.failure_rate_pct,
    },
    probable_cause: `Failure rate spiked to ${primary.failure_rate_pct} vs ${primary.baseline.failure_rate_pct} baseline (${primary.ratio_vs_baseline}). Top error: ${primary.error_code || 'unknown'}. Investigation hypotheses: ${plan.hypotheses.join('; ')}`,
    recommended_actions: [
      `Escalate to ${primary.gateway} support for ${primary.payment_method} routing issues`,
      `Check ${primary.bank} connectivity and decline codes`,
      'Enable enhanced logging for affected payment path',
      'Consider routing traffic to backup gateway temporarily',
    ],
  };
}

export function getInvestigationSteps() {
  return STEPS;
}

export async function runInvestigation(userQuery, baContext = {}, onStepComplete) {
  if (typeof baContext === 'function') {
    onStepComplete = baContext;
    baContext = {};
  }

  const results = {
    steps: [],
    investigationPlan: null,
    searchFilters: null,
    failedData: null,
    analysis: null,
    diagnosis: null,
    jira: null,
    incident: null,
    baContext,
  };

  const completeStep = (stepId, status, data = null, error = null) => {
    const step = STEPS.find((s) => s.id === stepId);
    const stepResult = {
      id: stepId,
      name: step?.name || stepId,
      status,
      data,
      error,
      completed_at: new Date().toISOString(),
    };
    results.steps.push(stepResult);
    if (onStepComplete) onStepComplete(stepResult);
    return stepResult;
  };

  try {
    let plan;
    try {
      plan = await generateInvestigationPlan(userQuery, baContext);
    } catch (err) {
      console.error('Gemini planning failed, using fallback plan:', err.message);
      plan = fallbackInvestigationPlan(baContext);
    }
    results.investigationPlan = plan;
    completeStep('planning', 'completed', {
      hypotheses: plan.hypotheses,
      focus_areas: plan.filters.focus_areas,
      time_window_hours: plan.filters.time_window_hours,
      filters: plan.filters,
    });
  } catch (err) {
    completeStep('planning', 'failed', null, err.message);
    throw err;
  }

  const searchFilters = planToSearchFilters(results.investigationPlan);
  results.searchFilters = searchFilters;

  let mcpSearchError = null;
  try {
    const mcpData = await searchViaElasticMCP(searchFilters);
    results.failedData = mcpData;
    completeStep('elastic_mcp_search', 'completed', {
      count: mcpData.count,
      timeRange: mcpData.timeRange,
      filters: mcpData.filters,
      source: 'elastic_mcp',
    });
  } catch (err) {
    mcpSearchError = err.message;
    completeStep('elastic_mcp_search', 'failed', null, err.message);
  }

  try {
    if (results.failedData) {
      completeStep('elastic_search', 'completed', {
        count: results.failedData.count,
        timeRange: results.failedData.timeRange,
        filters: results.failedData.filters,
        source: 'elastic_mcp',
        note: 'Using results from Elastic MCP search',
      });
    } else {
      const failedData = await searchFailedTransactions(searchFilters);
      results.failedData = failedData;
      completeStep('elastic_search', 'completed', {
        count: failedData.count,
        timeRange: failedData.timeRange,
        filters: failedData.filters,
        source: 'elasticsearch_client',
        fallback_from_mcp: mcpSearchError,
      });
    }
  } catch (err) {
    completeStep('elastic_search', 'failed', null, err.message);
    throw err;
  }

  try {
    const analysis = await analyzeFailures(searchFilters);
    results.analysis = analysis;
    completeStep('analyze', 'completed', {
      anomalous_count: analysis.anomalous_count,
      top_anomalies: analysis.anomalies.slice(0, 3).map((a) => ({
        combination: `${a.payment_method}/${a.gateway}/${a.bank}`,
        current: a.failure_rate_pct,
        baseline: a.baseline.failure_rate_pct,
      })),
    });
  } catch (err) {
    completeStep('analyze', 'failed', null, err.message);
    throw err;
  }

  try {
    let diagnosis;
    try {
      diagnosis = await generateDiagnosis(
        userQuery,
        results.failedData,
        results.analysis,
        baContext,
        results.investigationPlan
      );
    } catch (err) {
      console.error('Gemini diagnosis failed, using fallback diagnosis:', err.message);
      diagnosis = fallbackDiagnosis(results.analysis, results.investigationPlan);
    }
    results.diagnosis = diagnosis;
    completeStep('diagnose', 'completed', { diagnosis });
  } catch (err) {
    completeStep('diagnose', 'failed', null, err.message);
    throw err;
  }

  try {
    const jira = await createJiraTicket(results.diagnosis, userQuery, baContext);
    results.jira = jira;
    completeStep('jira', 'completed', {
      ticket_id: jira.ticket_id,
      ticket_url: jira.ticket_url,
    });
  } catch (err) {
    completeStep('jira', 'failed', null, err.message);
    throw err;
  }

  try {
    const incident = await writeIncident({
      summary: results.diagnosis.summary,
      diagnosis: results.diagnosis,
      jira_ticket_id: results.jira.ticket_id,
    });
    results.incident = incident;
    completeStep('elastic_write', 'completed', {
      incident_id: incident.incident_id,
    });
  } catch (err) {
    completeStep('elastic_write', 'failed', null, err.message);
    throw err;
  }

  return results;
}
