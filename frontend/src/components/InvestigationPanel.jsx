import { useState } from 'react';

const REGIONS = ['All Regions', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata'];
const PAYMENT_METHODS = ['All Methods', 'UPI', 'card', 'netbanking', 'wallet'];

const EMPTY_CONTEXT = {
  started_at: '',
  affected_region: '',
  affected_payment_method: '',
  additional_notes: '',
};

export default function InvestigationPanel({ onInvestigate, loading }) {
  const [query, setQuery] = useState('payments are failing, investigate');
  const [showContext, setShowContext] = useState(false);
  const [baContext, setBaContext] = useState(EMPTY_CONTEXT);

  const updateContext = (field, value) => {
    setBaContext((prev) => ({ ...prev, [field]: value }));
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
    <section className="panel investigation-panel">
      <h2>Describe the issue</h2>
      <p className="panel-subtitle">
        PaySentinel will search transaction logs, analyze anomalies, diagnose root cause,
        and file a Jira ticket automatically.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. payments are failing, investigate"
          rows={3}
          disabled={loading}
        />

        <div className="context-section">
          <button
            type="button"
            className="context-toggle"
            onClick={() => setShowContext((prev) => !prev)}
            aria-expanded={showContext}
            disabled={loading}
          >
            <span className="context-toggle-icon">{showContext ? '▾' : '▸'}</span>
            Add context (optional)
          </button>

          {showContext && (
            <div className="context-fields">
              <label className="context-field">
                <span>Time it started</span>
                <input
                  type="text"
                  value={baContext.started_at}
                  onChange={(e) => updateContext('started_at', e.target.value)}
                  placeholder='e.g. "around 2pm", "after the 3:30pm deployment"'
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
                <span>Affected payment method</span>
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

              <label className="context-field">
                <span>Additional notes</span>
                <textarea
                  value={baContext.additional_notes}
                  onChange={(e) => updateContext('additional_notes', e.target.value)}
                  placeholder='e.g. "only premium users affected", "started after hotfix deployment"'
                  rows={2}
                  disabled={loading}
                />
              </label>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Investigating…
            </>
          ) : (
            'Investigate'
          )}
        </button>
      </form>

      <style>{`
        .investigation-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.5rem;
        }

        .investigation-panel h2 {
          margin: 0 0 0.35rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .panel-subtitle {
          margin: 0 0 1.25rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .investigation-panel textarea,
        .investigation-panel input,
        .investigation-panel select {
          width: 100%;
          padding: 0.85rem 1rem;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.15s;
        }

        .investigation-panel textarea {
          resize: vertical;
        }

        .investigation-panel textarea:focus,
        .investigation-panel input:focus,
        .investigation-panel select:focus {
          border-color: var(--accent);
        }

        .investigation-panel textarea:disabled,
        .investigation-panel input:disabled,
        .investigation-panel select:disabled {
          opacity: 0.6;
        }

        .context-section {
          margin-top: 1rem;
        }

        .context-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s;
        }

        .context-toggle:hover:not(:disabled) {
          color: var(--text);
        }

        .context-toggle:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .context-toggle-icon {
          font-size: 0.75rem;
        }

        .context-fields {
          margin-top: 0.85rem;
          display: grid;
          gap: 0.85rem;
        }

        .context-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .context-field span {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .investigation-panel form > button[type="submit"] {
          margin-top: 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.5rem;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }

        .investigation-panel form > button[type="submit"]:hover:not(:disabled) {
          background: #2d8ae6;
        }

        .investigation-panel form > button[type="submit"]:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
