# PaySentinel — Autonomous Payment Failure Investigation Agent

> Google Cloud Rapid Agent Hackathon · Elastic Partner Track

## What it does

PaySentinel is an autonomous agent that investigates payment failures on behalf of Business Analysts. Instead of engineers manually digging through logs, a BA describes the issue in plain English, and PaySentinel:

1. **Builds an investigation plan** using Gemini — forms hypotheses based on the BA's context
2. **Searches transaction logs** via Elastic MCP — queries Elasticsearch using ES|QL
3. **Analyzes failure patterns** — compares current failure rates against 7-day baseline
4. **Generates AI diagnosis** using Gemini — confirms or denies hypotheses with evidence
5. **Creates a Jira ticket** automatically — structured diagnosis the engineer can act on immediately
6. **Persists the incident** back to Elasticsearch — searchable memory for future investigations

## The problem it solves

When payments fail, engineers manually sift through thousands of log lines under pressure to find the root cause. PaySentinel eliminates that investigation step — the engineer opens a Jira ticket and already knows exactly what to fix.

## Tech stack

- **Gemini** — investigation planning and diagnosis
- **Google Cloud Agent Builder (CX Agent Studio)** — agent orchestration
- **Elastic MCP** (`platform_core_execute_esql`) — transaction log search via ES|QL
- **Elasticsearch** — transaction log storage and incident memory
- **Jira REST API** — automated ticket creation
- **React + Vite** — frontend UI
- **Node.js + Express** — backend API

## Quick start

### Prerequisites
- Node.js 18+
- Elasticsearch cluster (Elastic Cloud recommended)
- Gemini API key (from Google AI Studio)
- Jira account

### Setup

```bash
git clone https://github.com/ZERO34802/paysentinel.git
cd paysentinel/backend
npm install
cp .env.example .env
# Fill in your credentials in .env
node data/seedLogs.js  # Seed synthetic transaction data
node index.js          # Start backend on port 3001
```

In a new terminal:
```bash
cd paysentinel/frontend
npm install
npm run dev            # Start frontend on port 5173
```

Open http://localhost:5173

### Environment variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini API key from Google AI Studio |
| `ELASTIC_URL` | Elasticsearch cluster URL |
| `ELASTIC_API_KEY` | Elasticsearch API key |
| `ELASTIC_MCP_ENDPOINT` | Elastic Agent Builder MCP endpoint |
| `JIRA_URL` | Jira instance URL |
| `JIRA_EMAIL` | Atlassian account email |
| `JIRA_API_KEY` | Jira API token |
| `JIRA_PROJECT_KEY` | Jira project key |
| `AGENT_BUILDER_API_KEY` | API key for Google Cloud Agent Builder |

## How to integrate with your existing system

PaySentinel works with any Elasticsearch cluster. To connect your real payment logs:

1. Point `ELASTIC_URL` and `ELASTIC_API_KEY` at your existing cluster
2. Update `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_KEY`, `JIRA_PROJECT_KEY` for your Jira
3. Run `node data/seedLogs.js` to initialize the index schema
4. Start ingesting your real transaction logs into the `transactions` index

No code changes required — only environment variables.

## Architecture

```
BA describes issue
        ↓
   React Frontend
        ↓
Node/Express Backend
        ↓
Google Cloud Agent Builder
   ↓              ↓
Elastic MCP      Gemini API
(search logs)    (plan + diagnose)
        ↓
Jira REST API (create ticket)
        ↓
Elasticsearch (persist incident)
```

## Demo

Enter a plain English description of the payment issue with optional BA context:
- Time it started
- Affected region
- Affected payment method
- Additional notes from the client

The agent runs 7 steps automatically and creates a structured Jira ticket.

## License

MIT — see LICENSE
