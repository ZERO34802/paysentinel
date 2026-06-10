export default function DiagnosisOutput({ diagnosis, jira }) {
  const actions = diagnosis.recommended_actions || [];

  return (
    <section className="panel diagnosis-output">
      <h2>Diagnosis</h2>

      <div className="diagnosis-card">
        <div className="diagnosis-section">
          <h3>Summary</h3>
          <p>{diagnosis.summary}</p>
        </div>

        <div className="diagnosis-grid">
          <div className="diagnosis-section">
            <h3>Affected</h3>
            <dl>
              <div>
                <dt>Payment method</dt>
                <dd>{diagnosis.affected?.payment_method || '—'}</dd>
              </div>
              <div>
                <dt>Gateway</dt>
                <dd>{diagnosis.affected?.gateway || '—'}</dd>
              </div>
              <div>
                <dt>Bank</dt>
                <dd>{diagnosis.affected?.bank || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="diagnosis-section">
            <h3>Failure rate</h3>
            <dl>
              <div>
                <dt>Current (1h)</dt>
                <dd className="rate-current">{diagnosis.failure_rate?.current || '—'}</dd>
              </div>
              <div>
                <dt>Baseline (7d)</dt>
                <dd className="rate-baseline">{diagnosis.failure_rate?.baseline || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="diagnosis-section">
          <h3>Probable cause</h3>
          <p>{diagnosis.probable_cause}</p>
        </div>

        {actions.length > 0 && (
          <div className="diagnosis-section">
            <h3>Recommended actions</h3>
            <ol>
              {actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {jira && (
        <div className="jira-footer">
          <span className="jira-label">Jira ticket</span>
          <a href={jira.ticket_url} target="_blank" rel="noopener noreferrer">
            {jira.ticket_id}
          </a>
        </div>
      )}

      <style>{`
        .diagnosis-output {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.5rem;
        }

        .diagnosis-output h2 {
          margin: 0 0 1.25rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .diagnosis-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .diagnosis-section h3 {
          margin: 0 0 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .diagnosis-section p {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .diagnosis-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 600px) {
          .diagnosis-grid {
            grid-template-columns: 1fr;
          }
        }

        .diagnosis-section dl {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .diagnosis-section dl > div {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1rem;
        }

        .diagnosis-section dt {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .diagnosis-section dd {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 500;
          font-family: var(--font-mono);
        }

        .rate-current {
          color: var(--error);
        }

        .rate-baseline {
          color: var(--success);
        }

        .diagnosis-section ol {
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .diagnosis-section li {
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .jira-footer {
          margin-top: 1.25rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .jira-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .jira-footer a {
          color: var(--accent);
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
        }

        .jira-footer a:hover {
          text-decoration: underline;
        }
      `}</style>
    </section>
  );
}
