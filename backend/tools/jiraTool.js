function formatBaContextLines(baContext) {
  if (!baContext) return [];

  const lines = [];
  if (baContext.started_at) lines.push(`* Time it started: ${baContext.started_at}`);
  if (baContext.affected_region) lines.push(`* Affected region: ${baContext.affected_region}`);
  if (baContext.affected_payment_method) {
    lines.push(`* Affected payment method: ${baContext.affected_payment_method}`);
  }
  if (baContext.additional_notes) lines.push(`* Additional notes: ${baContext.additional_notes}`);

  if (lines.length === 0) return [];

  return ['h3. BA Context', ...lines, ''];
}

function formatDiagnosisDescription(diagnosis, userQuery, baContext = {}) {
  const actions = (diagnosis.recommended_actions || [])
    .map((action, i) => `${i + 1}. ${action}`)
    .join('\n');

  return [
    'h2. PaySentinel Automated Investigation',
    '',
    `*User query:* ${userQuery}`,
    '',
    ...formatBaContextLines(baContext),
    'h3. Summary',
    diagnosis.summary || 'No summary provided',
    '',
    'h3. Affected Components',
    `* Payment Method: ${diagnosis.affected?.payment_method || 'N/A'}`,
    `* Gateway: ${diagnosis.affected?.gateway || 'N/A'}`,
    `* Bank: ${diagnosis.affected?.bank || 'N/A'}`,
    '',
    'h3. Failure Rates',
    `* Current: ${diagnosis.failure_rate?.current || 'N/A'}`,
    `* Baseline (7-day): ${diagnosis.failure_rate?.baseline || 'N/A'}`,
    '',
    'h3. Probable Cause',
    diagnosis.probable_cause || 'Under investigation',
    '',
    'h3. Recommended Actions',
    actions || 'None specified',
    '',
    '_Created automatically by PaySentinel_',
  ].join('\n');
}

export async function createJiraTicket(diagnosis, userQuery, baContext = {}) {
  const jiraUrl = process.env.JIRA_URL;
  const jiraEmail = process.env.JIRA_EMAIL;
  const jiraApiKey = process.env.JIRA_API_KEY;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!jiraUrl || !jiraEmail || !jiraApiKey || !projectKey) {
    throw new Error('Jira credentials (JIRA_URL, JIRA_EMAIL, JIRA_API_KEY, JIRA_PROJECT_KEY) must be configured');
  }

  const summary =
    diagnosis.summary?.slice(0, 200) ||
    `Payment failure investigation: ${diagnosis.affected?.payment_method || 'unknown'} via ${diagnosis.affected?.gateway || 'unknown'}`;

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: `[PaySentinel] ${summary}`,
      description: formatDiagnosisDescription(diagnosis, userQuery, baContext),
      issuetype: { name: 'Bug' },
    },
  };

  const auth = Buffer.from(`${jiraEmail}:${jiraApiKey}`).toString('base64');
  const baseUrl = jiraUrl.replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/rest/api/2/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Jira API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  return {
    ticket_id: data.key,
    ticket_url: `${baseUrl}/browse/${data.key}`,
    id: data.id,
  };
}
