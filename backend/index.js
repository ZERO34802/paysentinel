import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { getInvestigationSteps, runInvestigation } from './agent.js';
import { reseedLastHour } from './jobs/reseedJob.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function requireApiKey(req, res, next) {
  const expectedKey = process.env.AGENT_BUILDER_API_KEY;

  if (!expectedKey) {
    return next();
  }

  const providedKey = req.query.api_key || req.headers['x-api-key'];

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PaySentinel' });
});

app.get('/api/steps', (_req, res) => {
  res.json({ steps: getInvestigationSteps() });
});

app.post('/api/investigate', requireApiKey, async (req, res) => {
  const {
    query,
    started_at,
    affected_region,
    affected_payment_method,
    additional_notes,
  } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'A non-empty query is required' });
  }

  const baContext = {
    started_at: typeof started_at === 'string' && started_at.trim() ? started_at.trim() : null,
    affected_region:
      typeof affected_region === 'string' && affected_region.trim()
        ? affected_region.trim()
        : null,
    affected_payment_method:
      typeof affected_payment_method === 'string' && affected_payment_method.trim()
        ? affected_payment_method.trim()
        : null,
    additional_notes:
      typeof additional_notes === 'string' && additional_notes.trim()
        ? additional_notes.trim()
        : null,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('started', { query: query.trim(), baContext, steps: getInvestigationSteps() });

  try {
    const results = await runInvestigation(query.trim(), baContext, (step) => {
      sendEvent('step', step);
    });

    sendEvent('complete', {
      diagnosis: results.diagnosis,
      jira: results.jira,
      incident: results.incident,
      steps: results.steps,
    });
  } catch (err) {
    sendEvent('error', { message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`PaySentinel backend running on http://localhost:${PORT}`);

  reseedLastHour().catch((err) => {
    console.error('Initial reseed failed:', err.message);
  });

  cron.schedule('*/45 * * * *', reseedLastHour);
  console.log('Auto-reseed job scheduled every 45 minutes');
});
