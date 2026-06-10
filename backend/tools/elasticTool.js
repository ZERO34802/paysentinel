import { Client } from '@elastic/elasticsearch';

let client = null;

function getClient() {
  if (!client) {
    const url = process.env.ELASTIC_URL;
    const apiKey = process.env.ELASTIC_API_KEY;

    if (!url || !apiKey) {
      throw new Error('ELASTIC_URL and ELASTIC_API_KEY must be configured');
    }

    client = new Client({
      node: url,
      auth: { apiKey },
    });
  }
  return client;
}

function buildQueryClauses(filters = {}) {
  const hours = Math.min(Math.max(filters.time_window_hours ?? 1, 1), 168);
  const must = [
    { range: { timestamp: { gte: `now-${hours}h` } } },
  ];

  if (filters.status) {
    must.push({ term: { status: filters.status } });
  }

  if (filters.payment_method) {
    must.push({ term: { payment_method: filters.payment_method } });
  }

  if (filters.region) {
    must.push({ term: { ip_region: filters.region } });
  }

  if (filters.user_device) {
    must.push({ term: { user_device: filters.user_device } });
  }

  if (filters.failure_stage) {
    must.push({ term: { failure_stage: filters.failure_stage } });
  }

  return { must, hours };
}

function describeAppliedFilters(filters = {}) {
  const applied = [];
  if (filters.time_window_hours) applied.push(`time_window=${filters.time_window_hours}h`);
  if (filters.payment_method) applied.push(`payment_method=${filters.payment_method}`);
  if (filters.region) applied.push(`region=${filters.region}`);
  if (filters.user_device) applied.push(`user_device=${filters.user_device}`);
  if (filters.failure_stage) applied.push(`failure_stage=${filters.failure_stage}`);
  if (filters.status) applied.push(`status=${filters.status}`);
  return applied.length > 0 ? applied : null;
}

function formatSearchResult(failures, searchFilters, hours) {
  return {
    count: failures.length,
    failures,
    timeRange: `last ${hours} hour(s)`,
    filters: describeAppliedFilters(searchFilters),
  };
}

function escapeEsqlValue(value) {
  return String(value).replace(/"/g, '\\"');
}

function buildEsqlQuery(searchFilters, hours) {
  const lines = [
    'FROM transactions',
    '| WHERE status == "failed"',
    `| WHERE timestamp >= NOW() - ${hours} hours`,
  ];

  if (searchFilters.payment_method) {
    lines.push(`| WHERE payment_method == "${escapeEsqlValue(searchFilters.payment_method)}"`);
  }
  if (searchFilters.region) {
    lines.push(`| WHERE ip_region == "${escapeEsqlValue(searchFilters.region)}"`);
  }
  if (searchFilters.user_device) {
    lines.push(`| WHERE user_device == "${escapeEsqlValue(searchFilters.user_device)}"`);
  }
  if (searchFilters.failure_stage) {
    lines.push(`| WHERE failure_stage == "${escapeEsqlValue(searchFilters.failure_stage)}"`);
  }

  lines.push(
    '| KEEP transaction_id, timestamp, payment_method, gateway, bank, error_code, failure_stage, response_time_ms, retry_count, merchant_id, user_device, ip_region, amount, status',
    '| SORT timestamp DESC',
    '| LIMIT 10000'
  );

  return lines.join('\n');
}

function parseEsqlResult(mcpResult) {
  const text = mcpResult?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Elastic MCP execute_esql response missing content[0].text');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Elastic MCP execute_esql content[0].text is not valid JSON');
  }

  const esqlResults = Array.isArray(parsed?.results)
    ? parsed.results.find((entry) => entry?.type === 'esql_results')
    : null;

  const columns = esqlResults?.data?.columns ?? parsed.columns;
  const values = esqlResults?.data?.values ?? parsed.values ?? parsed.rows;

  if (Array.isArray(columns) && Array.isArray(values)) {
    const columnNames = columns.map((col) => col.name ?? col);
    return values.map((row) => {
      const doc = {};
      columnNames.forEach((name, i) => {
        doc[name] = row[i];
      });
      return doc;
    });
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.documents)) {
    return parsed.documents;
  }

  throw new Error('Unexpected Elastic MCP execute_esql result format');
}

export async function callElasticMCP(toolName, toolInput) {
  const endpoint = process.env.ELASTIC_MCP_ENDPOINT;
  const apiKey = process.env.ELASTIC_API_KEY;

  if (!endpoint) {
    throw new Error('ELASTIC_MCP_ENDPOINT must be configured');
  }
  if (!apiKey) {
    throw new Error('ELASTIC_API_KEY must be configured');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolInput,
      },
      id: 1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Elastic MCP error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  console.log('Elastic MCP raw response:', JSON.stringify(data, null, 2));

  const payload = data;

  if (payload?.error) {
    const { code, message } = payload.error;
    throw new Error(`Elastic MCP JSON-RPC error (${code ?? 'unknown'}): ${message ?? 'Unknown error'}`);
  }

  if (payload?.result === undefined) {
    throw new Error('Elastic MCP response missing result field');
  }

  return payload.result;
}

export async function searchViaElasticMCP(filters = {}) {
  const searchFilters = { ...filters, status: 'failed' };
  const hours = Math.min(Math.max(searchFilters.time_window_hours ?? 1, 1), 168);
  const esqlQuery = buildEsqlQuery(searchFilters, hours);

  const mcpResult = await callElasticMCP('platform_core_execute_esql', {
    query: esqlQuery,
  });

  const failures = parseEsqlResult(mcpResult);

  return {
    ...formatSearchResult(failures, searchFilters, hours),
    source: 'elastic_mcp',
  };
}

export async function searchFailedTransactions(filters = {}) {
  const es = getClient();
  const searchFilters = { ...filters, status: 'failed' };
  const { must, hours } = buildQueryClauses(searchFilters);

  const result = await es.search({
    index: 'transactions',
    size: 10000,
    query: { bool: { must } },
    sort: [{ timestamp: 'desc' }],
  });

  const failures = result.hits.hits.map((hit) => hit._source);

  return {
    ...formatSearchResult(failures, searchFilters, hours),
    source: 'elasticsearch_client',
  };
}

export async function searchTransactionsForAnalysis(filters = {}) {
  const es = getClient();
  const hours = Math.min(Math.max(filters.time_window_hours ?? 1, 1), 168);

  const currentClauses = buildQueryClauses({ ...filters, time_window_hours: hours });
  const baselineMust = [
    { range: { timestamp: { gte: 'now-7d/d', lte: `now-${hours}h` } } },
  ];

  if (filters.payment_method) {
    baselineMust.push({ term: { payment_method: filters.payment_method } });
  }
  if (filters.region) {
    baselineMust.push({ term: { ip_region: filters.region } });
  }
  if (filters.user_device) {
    baselineMust.push({ term: { user_device: filters.user_device } });
  }
  if (filters.failure_stage) {
    baselineMust.push({ term: { failure_stage: filters.failure_stage } });
  }

  const [currentResult, baselineResult] = await Promise.all([
    es.search({
      index: 'transactions',
      size: 0,
      query: { bool: { must: currentClauses.must } },
      aggs: {
        by_group: {
          composite: {
            size: 1000,
            sources: [
              { payment_method: { terms: { field: 'payment_method' } } },
              { gateway: { terms: { field: 'gateway' } } },
              { bank: { terms: { field: 'bank' } } },
              { error_code: { terms: { field: 'error_code', missing_bucket: true } } },
            ],
          },
          aggs: {
            failed: { filter: { term: { status: 'failed' } } },
            total: { value_count: { field: 'transaction_id' } },
          },
        },
      },
    }),
    es.search({
      index: 'transactions',
      size: 0,
      query: { bool: { must: baselineMust } },
      aggs: {
        by_group: {
          composite: {
            size: 1000,
            sources: [
              { payment_method: { terms: { field: 'payment_method' } } },
              { gateway: { terms: { field: 'gateway' } } },
              { bank: { terms: { field: 'bank' } } },
              { error_code: { terms: { field: 'error_code', missing_bucket: true } } },
            ],
          },
          aggs: {
            failed: { filter: { term: { status: 'failed' } } },
            total: { value_count: { field: 'transaction_id' } },
          },
        },
      },
    }),
  ]);

  return {
    current: currentResult.aggregations.by_group.buckets,
    baseline: baselineResult.aggregations.by_group.buckets,
    timeRange: `last ${hours} hour(s)`,
    filters: describeAppliedFilters(filters),
  };
}

export async function writeIncident(incident) {
  const es = getClient();
  const incidentId = `inc_${Date.now()}`;

  const doc = {
    incident_id: incidentId,
    created_at: new Date().toISOString(),
    summary: incident.summary,
    diagnosis: incident.diagnosis,
    jira_ticket_id: incident.jira_ticket_id,
    affected: incident.diagnosis?.affected || {},
    failure_rate: incident.diagnosis?.failure_rate || {},
  };

  await es.index({
    index: 'incidents',
    id: incidentId,
    document: doc,
    refresh: true,
  });

  return { incident_id: incidentId, document: doc };
}
