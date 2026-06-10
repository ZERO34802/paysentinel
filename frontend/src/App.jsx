import { useState } from 'react';
import InvestigationPanel from './components/InvestigationPanel.jsx';
import StepTracker from './components/StepTracker.jsx';
import DiagnosisOutput from './components/DiagnosisOutput.jsx';
import './App.css';

const INITIAL_STEPS = [
  { id: 'planning', name: 'Build investigation plan with Gemini', status: 'pending' },
  { id: 'elastic_mcp_search', name: 'Search via Elastic MCP', status: 'pending' },
  { id: 'elastic_search', name: 'Search failed transactions in Elasticsearch', status: 'pending' },
  { id: 'analyze', name: 'Analyze failure patterns vs baseline', status: 'pending' },
  { id: 'diagnose', name: 'Generate AI diagnosis with Gemini', status: 'pending' },
  { id: 'jira', name: 'Create Jira incident ticket', status: 'pending' },
  { id: 'elastic_write', name: 'Persist incident to Elasticsearch', status: 'pending' },
];

export default function App() {
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [diagnosis, setDiagnosis] = useState(null);
  const [jira, setJira] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetState = () => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', data: null, error: null })));
    setDiagnosis(null);
    setJira(null);
    setError(null);
  };

  const handleInvestigate = async (query, baContext = {}) => {
    resetState();
    setLoading(true);

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="logo">◈</span>
          <div>
            <h1>PaySentinel</h1>
            <p>Payment failure investigation agent</p>
          </div>
        </div>
      </header>

      <main className="main">
        <InvestigationPanel onInvestigate={handleInvestigate} loading={loading} />

        {(loading || steps.some((s) => s.status !== 'pending')) && (
          <StepTracker steps={steps} />
        )}

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {diagnosis && <DiagnosisOutput diagnosis={diagnosis} jira={jira} />}
      </main>
    </div>
  );
}
