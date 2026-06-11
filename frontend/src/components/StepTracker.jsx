const STATUS_ICON = {
  pending: '○',
  running: '…',
  completed: '✓',
  failed: '✕',
};

const STATUS_LABEL = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Done',
  failed: 'Needs attention',
};

export default function StepTracker({ steps, loading, progress, runMeta }) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => !['completed', 'failed'].includes(step.status))
  );
  const completedCount = steps.filter((step) => step.status === 'completed').length;
  const failedCount = steps.filter((step) => step.status === 'failed').length;

  return (
    <section className="step-tracker panel-glass">
      <div className="tracker-header">
        <div>
          <span className="section-kicker">Live agent trace</span>
          <h2>Investigation progress</h2>
          <p>{runMeta?.query || 'Waiting for the analyst report.'}</p>
        </div>
        <div className={`run-state ${loading ? 'is-live' : ''}`}>
          <span />
          {loading ? 'Running' : completedCount ? 'Complete' : 'Ready'}
        </div>
      </div>

      <div className="progress-shell" aria-label={`Investigation ${progress}% complete`}>
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="tracker-stats" aria-label="Investigation statistics">
        <div>
          <strong>{completedCount}/7</strong>
          <span>steps complete</span>
        </div>
        <div>
          <strong>{failedCount}</strong>
          <span>tool errors</span>
        </div>
        <div>
          <strong>{progress}%</strong>
          <span>mission progress</span>
        </div>
      </div>

      <ol className="step-list">
        {steps.map((step, index) => {
          const inferredStatus = loading && index === activeIndex && step.status === 'pending' ? 'running' : step.status;
          const detail = formatStepDetail(step);

          return (
            <li key={step.id} className={`step-item step-${inferredStatus}`}>
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="step-icon" aria-hidden="true">{STATUS_ICON[inferredStatus] || '○'}</span>
              <div className="step-content">
                <div className="step-title-row">
                  <span className="step-name">{step.name}</span>
                  <span className="step-status">{STATUS_LABEL[inferredStatus] || inferredStatus}</span>
                </div>
                {detail && <span className="step-detail">{detail}</span>}
                {step.error && <span className="step-error">{step.error}</span>}
              </div>
            </li>
          );
        })}
      </ol>

      <style>{`
        .step-tracker {
          padding: 1.25rem;
        }

        .tracker-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .tracker-header h2 {
          margin: 0.45rem 0 0.35rem;
          color: var(--text-strong);
          font-size: 1.45rem;
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .tracker-header p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .run-state {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          flex: 0 0 auto;
          border: 1px solid var(--border-soft);
          border-radius: 999px;
          padding: 0.45rem 0.7rem;
          color: var(--text-soft);
          background: rgba(255, 255, 255, 0.045);
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .run-state span {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 999px;
          background: var(--success);
        }

        .run-state.is-live span {
          animation: live-pulse 1.2s ease-out infinite;
        }

        .progress-shell {
          height: 0.65rem;
          margin: 1rem 0;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.13);
          border: 1px solid var(--border-soft);
        }

        .progress-bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--accent), var(--accent-strong));
          box-shadow: 0 0 22px rgba(45, 212, 191, 0.45);
          transition: width 0.35s ease;
        }

        .tracker-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          margin-bottom: 1rem;
        }

        .tracker-stats div {
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.8rem;
        }

        .tracker-stats strong {
          display: block;
          color: var(--text-strong);
          font-family: var(--font-mono);
          font-size: 1.05rem;
        }

        .tracker-stats span {
          display: block;
          margin-top: 0.15rem;
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .step-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.7rem;
        }

        .step-item {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr);
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-md);
          background: rgba(2, 6, 23, 0.42);
          transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
        }

        .step-running {
          border-color: rgba(45, 212, 191, 0.55);
          background: rgba(45, 212, 191, 0.06);
          transform: translateY(-1px);
        }

        .step-completed {
          border-color: rgba(52, 211, 153, 0.28);
        }

        .step-failed {
          border-color: rgba(251, 113, 133, 0.45);
        }

        .step-index {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 900;
          padding-top: 0.2rem;
        }

        .step-icon {
          width: 1.55rem;
          height: 1.55rem;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--text-muted);
          background: rgba(148, 163, 184, 0.12);
          font-family: var(--font-mono);
          font-size: 0.82rem;
          font-weight: 900;
        }

        .step-running .step-icon {
          color: var(--accent);
          background: rgba(45, 212, 191, 0.14);
          animation: breathe 1.25s ease-in-out infinite;
        }

        .step-completed .step-icon {
          color: #022c22;
          background: var(--success);
        }

        .step-failed .step-icon {
          color: #2f0710;
          background: var(--error);
        }

        .step-content {
          min-width: 0;
          display: grid;
          gap: 0.2rem;
        }

        .step-title-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
        }

        .step-name {
          color: var(--text-soft);
          font-size: 0.9rem;
          font-weight: 850;
        }

        .step-status {
          flex: 0 0 auto;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .step-running .step-status {
          color: var(--accent);
        }

        .step-completed .step-status {
          color: var(--success);
        }

        .step-failed .step-status,
        .step-error {
          color: var(--error);
        }

        .step-detail {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.78rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .step-error {
          font-size: 0.8rem;
        }

        @keyframes live-pulse {
          70% { box-shadow: 0 0 0 10px rgba(52, 211, 153, 0); }
          100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }

        @keyframes breathe {
          50% { transform: scale(1.07); }
        }

        @media (max-width: 720px) {
          .tracker-header {
            flex-direction: column;
          }

          .tracker-stats {
            grid-template-columns: 1fr;
          }

          .step-title-row {
            flex-direction: column;
            gap: 0.1rem;
          }
        }
      `}</style>
    </section>
  );
}

function formatStepDetail(step) {
  const { data, id } = step;
  if (!data) return null;

  switch (id) {
    case 'planning':
      return `${data.hypotheses?.length ?? 0} hypotheses · ${data.time_window_hours ?? data.filters?.time_window_hours ?? 1}h window`;
    case 'elastic_mcp_search':
      return data.count != null
        ? `ES|QL via Elastic MCP → ${data.count} failed transactions${data.timeRange ? ` · ${data.timeRange}` : ''}`
        : 'Elastic MCP (ES|QL) returned no evidence';
    case 'elastic_search':
      if (data.source === 'elastic_mcp') return `${data.count} failures reused from Elastic MCP`;
      if (data.fallback_from_mcp) return `${data.count} failures via direct Elasticsearch fallback`;
      return `${data.count ?? 0} failed transactions found${data.timeRange ? ` · ${data.timeRange}` : ''}`;
    case 'analyze':
      return `${data.anomalous_count ?? 0} anomalous group(s) detected vs 7-day baseline`;
    case 'diagnose': {
      const summary = data.diagnosis?.summary || data.summary || 'Evidence-backed diagnosis generated';
      return summary.length > 96 ? `${summary.slice(0, 96)}…` : summary;
    }
    case 'jira':
      return data.ticket_id ? `Ticket ${data.ticket_id} created` : 'Jira ticket request completed';
    case 'elastic_write':
      return data.incident_id ? `Incident ${data.incident_id} indexed` : 'Incident memory stored in Elasticsearch';
    default:
      return null;
  }
}
