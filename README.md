# PaySentinel — Autonomous Payment Failure Investigation Agent

> Google Cloud Rapid Agent Hackathon · Elastic Partner Track · Financial Services

**From payment failure report to diagnosed Jira ticket in 90 seconds.**

## The Problem

When payments fail in a company, the current workflow looks like this:

1. Client reports payment failures to the Business Analyst
2. BA creates a vague Jira ticket based on their limited understanding
3. Developer opens the ticket, has no technical context
4. Developer manually digs through thousands of log lines under pressure
5. Developer spends 30–45 minutes identifying the root cause
6. Developer finally starts fixing

The gap between what the BA knows and what the developer needs is entirely manual, time-consuming, and happens under pressure while customers are failing at checkout.

## The Solution

PaySentinel sits between the BA and the developer. The BA describes the issue in plain English, the agent investigates the logs autonomously, and the developer gets a pre-diagnosed Jira ticket with the root cause already identified.

New workflow:

1. Client reports issue to BA
2. BA opens PaySentinel, describes the issue with optional context
3. Agent investigates autonomously (90 seconds)
4. Developer opens Jira ticket — root cause already identified
5. Developer goes straight to fixing

## How the Agent Works (7 Steps)

### Step 1 — Build Investigation Plan (Gemini)
Gemini receives the BA's description and context. It doesn't just search blindly — it forms specific hypotheses first. For example: "UPI gateway degradation", "deployment-related config change", "mobile SDK issue". It also decides what filters to apply when searching logs (region, payment method, time window).

### Step 2 — Search via Elastic MCP
The agent calls the Elastic MCP endpoint (`platform_core_execute_esql`) with a dynamically built ES|QL query based on Gemini's investigation plan. The query filters by payment method, region, time window, and failure stage as needed. This is not a hardcoded query — Gemini decides what to search for.

### Step 3 — Search failed transactions in Elasticsearch
Falls back to a direct Elasticsearch query if MCP returns insufficient data. Retrieves individual failed transaction records for deep analysis.

### Step 4 — Analyze failure patterns vs baseline
Groups failures by payment method, gateway, bank, error code, failure stage, response time, device type, and region. Compares current failure rates against a 7-day historical baseline. Identifies which combinations are anomalous.

### Step 5 — Generate AI diagnosis (Gemini)
Gemini receives the original hypotheses alongside the actual log evidence. It confirms or denies each hypothesis with cited evidence from the data. Produces a structured diagnosis: what is failing, why, and what to do.

### Step 6 — Create Jira ticket
The structured diagnosis is automatically pushed to Jira as a ticket. The ticket includes: BA context, technical diagnosis, failure rates vs baseline, probable cause, and recommended actions — everything the developer needs.

### Step 7 — Persist incident to Elasticsearch
The diagnosis is stored back in Elasticsearch as a searchable incident record. Future investigations can reference past incidents, making the agent smarter over time.

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Agent Brain | Gemini (Google AI Studio) | Investigation planning and diagnosis |
| Agent Orchestration | Google Cloud Agent Builder (CX Agent Studio) | Agent management and tool routing |
| Search | Elastic MCP (`platform_core_execute_esql`) | ES\|QL queries against transaction logs |
| Database | Elasticsearch (Elastic Cloud Serverless) | Transaction storage and incident memory |
| Ticketing | Jira REST API | Automated ticket creation |
| Frontend | React + Vite | BA-facing investigation UI |
| Backend | Node.js + Express | API and agent orchestration |
| Auto-reseed | node-cron | Keeps transaction data fresh every 45 minutes |

## Transaction Data Model

```json
{
  "transaction_id": "txn_00012345",
  "timestamp": "2026-06-11T03:30:00.000Z",
  "payment_method": "UPI | card | netbanking | wallet",
  "gateway": "Razorpay | PayU | Stripe",
  "bank": "HDFC | SBI | Axis | ICICI",
  "error_code": "GATEWAY_TIMEOUT | INSUFFICIENT_FUNDS | BANK_DECLINED | ...",
  "failure_stage": "gateway_auth | bank_processing | network | timeout | fraud_check",
  "response_time_ms": 8421,
  "retry_count": 2,
  "merchant_id": "merchant_001",
  "user_device": "mobile | web | app",
  "ip_region": "Mumbai | Delhi | Bangalore | Chennai | Hyderabad | Kolkata",
  "amount": 2499.0,
  "status": "failed | success"
}
```

## Quick Start

### Prerequisites
- Node.js 18+
- Elasticsearch cluster (Elastic Cloud Serverless recommended)
- Gemini API key (Google AI Studio — free)
- Jira account (free tier works)

### Setup

```bash
git clone https://github.com/ZERO34802/paysentinel.git

# Backend
cd paysentinel/backend
npm install
cp .env.example .env
# Fill in your credentials (see Environment Variables section)
node data/seedLogs.js    # Seeds 10,000 synthetic transactions into Elasticsearch
node index.js            # Starts backend on http://localhost:3001
```

In a new terminal:

```bash
# Frontend
cd paysentinel/frontend
npm install
npm run dev              # Starts frontend on http://localhost:5173
```

Open http://localhost:5173 and run your first investigation.

## Environment Variables

| Variable | Purpose | Where to get it |
|----------|---------|----------------|
| `GEMINI_API_KEY` | Gemini API access | aistudio.google.com |
| `ELASTIC_URL` | Elasticsearch endpoint | Elastic Cloud dashboard |
| `ELASTIC_API_KEY` | Elasticsearch auth | Elastic Cloud → API Keys |
| `ELASTIC_MCP_ENDPOINT` | Elastic Agent Builder MCP | Kibana → Agent Builder |
| `JIRA_URL` | Your Jira instance | e.g. https://yourname.atlassian.net |
| `JIRA_EMAIL` | Atlassian account email | Your Atlassian account |
| `JIRA_API_KEY` | Jira API token | id.atlassian.com/manage-profile/security/api-tokens |
| `JIRA_PROJECT_KEY` | Jira project key | Your Jira project settings |
| `AGENT_BUILDER_API_KEY` | Auth for Agent Builder calls | Set your own value |

## Integrating with Your Existing System

PaySentinel works with any Elasticsearch cluster. To use your real payment logs:

1. Point `ELASTIC_URL` and `ELASTIC_API_KEY` at your existing cluster
2. Update Jira credentials for your instance
3. Ensure your transaction logs match the data model schema above
4. No code changes required — only environment variables

## Example Investigation

**BA input:**

| Field | Value |
|-------|-------|
| Query | "Customers reporting UPI payment failures at checkout" |
| Time started | "around 3:30pm, after the afternoon deployment" |
| Affected region | Mumbai |
| Affected payment method | UPI |
| Additional notes | "Only mobile app users affected, web users fine" |

**Resulting Jira ticket:**

```
[PaySentinel] UPI failures via Razorpay spiking in Mumbai on mobile

h2. PaySentinel Automated Investigation

*User query:* Customers reporting UPI payment failures at checkout

h3. BA Context
* Time it started: around 3:30pm, after the afternoon deployment
* Affected region: Mumbai
* Affected payment method: UPI
* Additional notes: Only mobile app users affected, web users fine

h3. Summary
UPI transactions via Razorpay are failing at gateway_auth for mobile users in
Mumbai. Failure timing aligns with the ~3:30pm deployment.

h3. Affected Components
* Payment Method: UPI
* Gateway: Razorpay
* Bank: HDFC

h3. Failure Rates
* Current: 46.6%
* Baseline (7-day): 3.1%

h3. Probable Cause
Hypothesis "deployment-related config change" CONFIRMED: failures begin at
~3:30pm and concentrate on gateway_auth (63% of failures), consistent with a
gateway credential/config change. Mobile-only concentration confirmed (failures
are ~100% user_device=mobile). INSUFFICIENT_FUNDS errors are flat vs baseline,
ruling out a user-side cause.

h3. Recommended Actions
1. Review config changes deployed at ~3:30pm (Razorpay gateway credentials/routing)
2. Compare mobile SDK version against web SDK for gateway integration differences
3. Audit UPI payment path end-to-end including gateway auth handshake
4. Consider routing UPI traffic to a backup gateway until the deployment is rolled back

_Created automatically by PaySentinel_
```

## Architecture Diagram

```
BA describes issue in plain English
           ↓
    React Frontend (localhost:5173)
           ↓
    Node/Express Backend (:3001)
           ↓
  ┌────────────────────────┐
  │  Google Cloud Agent    │
  │  Builder (CX Studio)   │
  └────────────────────────┘
        ↓           ↓
  Elastic MCP    Gemini API
  (ES|QL search) (plan+diagnose)
        ↓           ↓
  Elasticsearch  Jira REST API
  (logs+memory)  (create ticket)
```

## What Makes This an Agent (Not a Chatbot)

- It doesn't just answer questions — it executes a multi-step investigation
- Gemini forms hypotheses BEFORE searching, then validates them with evidence
- It calls real external tools: Elastic MCP, Jira API, Elasticsearch
- Each step depends on the previous step's findings
- It takes action in the world: creates tickets, persists incidents
- The more it's used, the smarter it gets (incident memory)

## License

MIT — see LICENSE
