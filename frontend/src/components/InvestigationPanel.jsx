import { useState } from 'react';

const REGIONS = ['All Regions', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata'];
const PAYMENT_METHODS = ['All Methods', 'UPI', 'card', 'netbanking', 'wallet'];

const EMPTY_CONTEXT = {
  started_at: '',
  affected_region: '',
  affected_payment_method: '',
  additional_notes: '',
};

const SCENARIOS = [
  {
    label: 'Mumbai UPI outage',
    query: 'Customers are reporting UPI payment failures at checkout',
    context: {
      started_at: 'around 3:30pm, after the afternoon deployment',
      affected_region: 'Mumbai',
      affected_payment_method: 'UPI',
      additional_notes: 'Only mobile app users appear affected; web checkout looks normal.',
    },
  },
  {
    label: 'Card auth spike',
    query: 'Card payments are timing out during authorization',
    context: {
      started_at: 'in the last hour',
      affected_region: 'Delhi',
      affected_payment_method: 'card',
      additional_notes: 'Support is seeing retries and high latency before gateway auth fails.',
    },
  },
  {
    label: 'Wallet regression',
    query: 'Wallet payments are failing after the latest hotfix',
    context: {
      started_at: 'after the hotfix rollout',
      affected_region: 'All Regions',
      affected_payment_method: 'wallet',
      additional_notes: 'Premium users reported failures first; need to know if this is regional or global.',
    },
  },
];

export default function InvestigationPanel({ onInvestigate, loading }) {
  const [query, setQuery] = useState(SCENARIOS[0].query);
  const [showContext, setShowContext] = useState(true);
  const [baContext, setBaContext] = useState(SCENARIOS[0].context);

  const updateContext = (field, value) => {
    setBaContext((prev) => ({ ...prev, [field]: value }));
  };

  const fillScenario = (scenario) => {
    if (loading) return;
    setQuery(scenario.query);
    setBaContext(scenario.context);
    setShowContext(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading && query.trim()) {
      onInvestigate(query.trim(), {
        started_at: baContext.started_at.trim() || null,
        affected_region:
          baContext.affected_region && baContext.affected_region !== 'All Regions'
            ? baContext.affected_region
            : null,
        affected_payment_method:
          baContext.affected_payment_method && baContext.affected_payment_method !== 'All Methods'
            ? baContext.affected_payment_method
            : null,
        additional_notes: baContext.additional_notes.trim() || null,
      });
    }
  };

  return (
    <section className="investigation-panel panel-glass">
      <div className="panel-heading">
        <span className="section-kicker">BA intake</span>
        <h2>Describe the customer impact.</h2>
        <p>
          Use a plain-English report. PaySentinel turns it into a scoped investigation,
          evidence search, diagnosis, and Jira-ready incident.
        </p>
      </div>

      <div className="scenario-row" aria-label="Demo scenarios">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.label}
            type="button"
            className="scenario-chip"
            onClick={() => fillScenario(scenario)}
            disabled={loading}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="investigation-form">
        <label className="primary-query">
          <span>Incident report</span>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. customers are reporting UPI payment failures at checkout"
            rows={4}
            disabled={loading}
          />
        </label>

        <div className="context-section">
          <button
            type="button"
            className="context-toggle"
            onClick={() => setShowContext((prev) => !prev)}
            aria-expanded={showContext}
            disabled={loading}
          >
            <span className="context-toggle-icon">{showContext ? '−' : '+'}</span>
            Analyst context
          </button>

          {showContext && (
            <div className="context-fields">
              <label className="context-field">
                <span>Time it started</span>
                <input
                  type="text"
                  value={baContext.started_at}
                  onChange={(e) => updateContext('started_at', e.target.value)}
                  placeholder='e.g. "after the 3:30pm deployment"'
                  disabled={loading}
                />
              </label>

              <label className="context-field">
                <span>Affected region</span>
                <select
                  value={baContext.affected_region || 'All Regions'}
                  onChange={(e) => updateContext('affected_region', e.target.value)}
                  disabled={loading}
                >
                  {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="context-field">
                <span>Payment method</span>
                <select
                  value={baContext.affected_payment_method || 'All Methods'}
                  onChange={(e) => updateContext('affected_payment_method', e.target.value)}
                  disabled={loading}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              <label className="context-field context-field-wide">
                <span>Additional notes</span>
                <textarea
                  value={baContext.additional_notes}
                  onChange={(e) => updateContext('additional_notes', e.target.value)}
                  placeholder='e.g. "mobile app only, web users fine"'
                  rows={3}
                  disabled={loading}
                />
              </label>
            </div>
          )}
        </div>

        <div className="submit-row">
          <button type="submit" className="investigate-button" disabled={loading || !query.trim()}>
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Agent investigating…
              </>
            ) : (
              <>
                Launch investigation
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
          <span className="submit-caption">Streams live progress from the backend investigation.</span>
        </div>
      </form>

      <style>{`
        .investigation-panel {
          padding: 1.25rem;
        }

        .panel-heading h2 {
          margin: 0.45rem 0 0.55rem;
          color: var(--text-strong);
          font-size: clamp(1.55rem, 3vw, 2.25rem);
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .panel-heading p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.65;
        }

        .scenario-row {
          margin: 1.1rem 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .scenario-chip {
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: 999px;
          background: rgba(45, 212, 191, 0.08);
          color: var(--text-soft);
          padding: 0.55rem 0.7rem;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        .scenario-chip:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(45, 212, 191, 0.55);
          background: rgba(45, 212, 191, 0.14);
        }

        .scenario-chip:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .investigation-form {
          display: grid;
          gap: 1rem;
        }

        .primary-query,
        .context-field {
          display: grid;
          gap: 0.45rem;
        }

        .primary-query > span,
        .context-field span {
          color: var(--text-soft);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.045em;
          text-transform: uppercase;
        }

        .investigation-panel textarea,
        .investigation-panel input,
        .investigation-panel select {
          width: 100%;
          padding: 0.95rem 1rem;
          background: rgba(2, 6, 23, 0.62);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text);
          outline: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .investigation-panel textarea {
          resize: vertical;
        }

        .investigation-panel textarea:focus,
        .investigation-panel input:focus,
        .investigation-panel select:focus {
          border-color: rgba(45, 212, 191, 0.65);
          box-shadow: 0 0 0 4px rgba(45, 212, 191, 0.09);
          background: rgba(2, 6, 23, 0.82);
        }

        .investigation-panel textarea:disabled,
        .investigation-panel input:disabled,
        .investigation-panel select:disabled {
          opacity: 0.62;
        }

        .context-section {
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-lg);
          padding: 0.85rem;
          background: rgba(255, 255, 255, 0.035);
        }

        .context-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0;
          background: none;
          border: none;
          color: var(--text-soft);
          font-size: 0.85rem;
          font-weight: 900;
          cursor: pointer;
        }

        .context-toggle-icon {
          width: 1.4rem;
          height: 1.4rem;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--accent-dim);
          color: var(--accent);
        }

        .context-fields {
          margin-top: 0.9rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .context-field-wide {
          grid-column: 1 / -1;
        }

        .submit-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.8rem;
        }

        .investigate-button {
          min-height: 3.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          padding: 0.85rem 1.25rem;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: #03121f;
          border: none;
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 18px 44px rgba(45, 212, 191, 0.22);
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .investigate-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 24px 60px rgba(45, 212, 191, 0.3);
        }

        .investigate-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .submit-caption {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(3, 18, 31, 0.25);
          border-top-color: #03121f;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 720px) {
          .context-fields {
            grid-template-columns: 1fr;
          }

          .investigate-button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
