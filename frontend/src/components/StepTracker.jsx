const STATUS_ICON = {
  pending: '○',
  completed: '✓',
  failed: '✕',
};

const STATUS_COLOR = {
  pending: 'var(--text-muted)',
  completed: 'var(--success)',
  failed: 'var(--error)',
};

export default function StepTracker({ steps }) {
  return (
    <section className="panel step-tracker">
      <h2>Investigation progress</h2>
      <ol className="step-list">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`step-item step-${step.status}`}
            style={{ '--status-color': STATUS_COLOR[step.status] }}
          >
            <span className="step-icon" aria-hidden="true">
              {STATUS_ICON[step.status]}
            </span>
            <div className="step-content">
              <span className="step-number">Step {index + 1}</span>
              <span className="step-name">{step.name}</span>
              {step.data && (
                <span className="step-detail">{formatStepDetail(step)}</span>
              )}
              {step.error && <span className="step-error">{step.error}</span>}
            </div>
          </li>
        ))}
      </ol>

      <style>{`
        .step-tracker {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.5rem;
        }

        .step-tracker h2 {
          margin: 0 0 1.25rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .step-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          padding: 0.85rem 1rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
          transition: border-color 0.2s;
        }

        .step-completed {
          border-color: rgba(52, 211, 153, 0.25);
        }

        .step-failed {
          border-color: rgba(248, 113, 113, 0.3);
        }

        .step-icon {
          flex-shrink: 0;
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--status-color);
          font-family: var(--font-mono);
        }

        .step-content {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }

        .step-number {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .step-name {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .step-detail {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .step-error {
          font-size: 0.8rem;
          color: var(--error);
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
      return `${data.hypotheses?.length ?? 0} hypotheses · ${data.time_window_hours ?? 1}h window`;
    case 'elastic_mcp_search':
      return data.count != null
        ? `${data.count} failed transactions via Elastic MCP (${data.timeRange})`
        : 'Elastic MCP search failed';
    case 'elastic_search':
      if (data.source === 'elastic_mcp') {
        return `${data.count} failed transactions (via Elastic MCP)`;
      }
      if (data.fallback_from_mcp) {
        return `${data.count} failed transactions via direct client (MCP fallback)`;
      }
      return `${data.count} failed transactions found (${data.timeRange})`;
    case 'analyze':
      return `${data.anomalous_count} anomalous group(s) detected`;
    case 'diagnose':
      return data.diagnosis?.summary?.slice(0, 80) + (data.diagnosis?.summary?.length > 80 ? '…' : '');
    case 'jira':
      return `Ticket ${data.ticket_id} created`;
    case 'elastic_write':
      return `Incident ${data.incident_id} indexed`;
    default:
      return null;
  }
}
