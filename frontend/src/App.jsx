import { useMemo, useState } from 'react';
import InvestigationPanel from './components/InvestigationPanel.jsx';
import StepTracker from './components/StepTracker.jsx';
import DiagnosisOutput from './components/DiagnosisOutput.jsx';
import './App.css';

const INITIAL_STEPS = [
  { id: 'planning', name: 'Gemini builds investigation plan', status: 'pending' },
  { id: 'elastic_mcp_search', name: 'Elastic MCP runs ES|QL search', status: 'pending' },
  { id: 'elastic_search', name: 'Elasticsearch retrieves failures', status: 'pending' },
  { id: 'analyze', name: 'Baseline anomaly analysis', status: 'pending' },
  { id: 'diagnose', name: 'Gemini evidence-backed diagnosis', status: 'pending' },
  { id: 'jira', name: 'Jira ticket is created', status: 'pending' },
  { id: 'elastic_write', name: 'Incident memory is persisted', status: 'pending' },
];

const IMPACT_STATS = [
  {
    label: 'Manual triage today',
    value: '30–45m',
    caption: 'Developer searches logs under pressure',
  },
  {
    label: 'PaySentinel target',
    value: '≈90s',
    caption: 'Report → diagnosis → Jira ticket',
  },
  {
    label: 'Agent actions',
    value: '7',
    caption: 'Plan, search, analyze, diagnose, file, remember',
  },
  {
    label: 'Partner track',
    value: 'Elastic',
    caption: 'MCP + ES|QL over payment telemetry',
  },
];

const STACK_ITEMS = ['Gemini', 'Google Cloud Agent Builder', 'Elastic MCP', 'Elasticsearch', 'Jira'];

export default function App() {
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [diagnosis, setDiagnosis] = useState(null);
  const [jira, setJira] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runMeta, setRunMeta] = useState(null);

  const progress = useMemo(() => {
    const completed = steps.filter((step) => step.status === 'completed').length;
    return Math.round((completed / steps.length) * 100);
  }, [steps]);

  const resetState = () => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', data: null, error: null })));
    setDiagnosis(null);
    setJira(null);
    setError(null);
    setRunMeta(null);
  };

  const handleInvestigate = async (query, baContext = {}) => {
    resetState();
    setLoading(true);
    setRunMeta({ query, baContext, startedAt: new Date().toISOString() });

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'x-api-key': 'paysentinel-agent-key-2026',
        },
        body: JSON.stringify({ query, ...baContext }),
      });

      if (!response.ok) {
        throw new Error(`Investigation failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let event = 'message';
          let data = null;

          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7);
            if (line.startsWith('data: ')) data = JSON.parse(line.slice(6));
          }

          if (event === 'started' && data) {
            setRunMeta((prev) => ({ ...prev, ...data, startedAt: prev?.startedAt || new Date().toISOString() }));
          }

          if (event === 'step' && data) {
            setSteps((prev) =>
              prev.map((step) =>
                step.id === data.id
                  ? { ...step, status: data.status, data: data.data, error: data.error }
                  : step
              )
            );
          }

          if (event === 'complete' && data) {
            setDiagnosis(data.diagnosis);
            setJira(data.jira);
            setRunMeta((prev) => ({ ...prev, completedAt: new Date().toISOString(), incident: data.incident }));
          }

          if (event === 'error' && data) {
            setError(data.message);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="hero">
        <nav className="topbar" aria-label="Product status">
          <div className="brand-mark">
            <span className="brand-orb" aria-hidden="true">◆</span>
            <div>
              <span className="brand-name">PaySentinel</span>
              <span className="brand-subtitle">Autonomous payment failure agent</span>
            </div>
          </div>
          <div className="status-pill">
            <span className="status-dot" /> Live demo ready
          </div>
        </nav>

        <div className="hero-grid">
          <section className="hero-copy">
            <div className="eyebrow">Google Cloud Rapid Agent Hackathon · Elastic Partner Track</div>
            <h1>From vague payment complaint to developer-ready Jira ticket.</h1>
            <p>
              PaySentinel gives business analysts a command center: Gemini plans the
              investigation, Elastic MCP searches the evidence, and Jira receives a
              root-cause ticket with recommended fixes.
            </p>
            <div className="hero-actions" aria-label="PaySentinel capabilities">
              <span>Plain-English intake</span>
              <span>Evidence-backed diagnosis</span>
              <span>Human-in-control automation</span>
            </div>
          </section>

          <aside className="hero-card" aria-label="Agent stack">
            <div className="hero-card-topline">Agent stack</div>
            <div className="stack-ladder">
              {STACK_ITEMS.map((item, index) => (
                <div className="stack-step" key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </header>

      <section className="impact-strip" aria-label="Hackathon impact metrics">
        {IMPACT_STATS.map((stat) => (
          <article className="impact-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.caption}</p>
          </article>
        ))}
      </section>

      <main className="dashboard-grid">
        <div className="left-rail">
          <InvestigationPanel onInvestigate={handleInvestigate} loading={loading} />

          <section className="architecture-card panel-glass">
            <div>
              <span className="section-kicker">What judges should notice</span>
              <h2>This is an agent, not a chatbot.</h2>
              <p>
                Each run shows a real multi-step mission: plan hypotheses, search logs,
                compare baseline anomalies, create Jira, and write incident memory back
                to Elasticsearch.
              </p>
            </div>
            <div className="flow-map" aria-label="Agent workflow">
              <span>BA report</span>
              <span>Gemini plan</span>
              <span>Elastic MCP</span>
              <span>Diagnosis</span>
              <span>Jira + memory</span>
            </div>
          </section>
        </div>

        <div className="right-rail">
          <StepTracker steps={steps} loading={loading} progress={progress} runMeta={runMeta} />

          {error && (
            <div className="error-banner" role="alert">
              <strong>Investigation interrupted</strong>
              <span>{error}</span>
            </div>
          )}

          {diagnosis ? (
            <DiagnosisOutput diagnosis={diagnosis} jira={jira} />
          ) : (
            <section className="empty-state panel-glass">
              <span className="empty-icon" aria-hidden="true">⌁</span>
              <h2>Run the demo and let the agent prove the workflow.</h2>
              <p>
                The strongest judge story is the Mumbai UPI scenario: BA context enters
                once, then the agent produces evidence, root cause, recommended actions,
                and a Jira ticket.
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
