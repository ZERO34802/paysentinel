export default function DiagnosisOutput({ diagnosis, jira }) {
  const actions = diagnosis?.recommended_actions || [];
  const affected = diagnosis?.affected || {};
  const failureRate = diagnosis?.failure_rate || {};
  const currentRate = failureRate.current || '—';
  const baselineRate = failureRate.baseline || '—';
  const hypothesisEvidence = normalizeEvidence(
    diagnosis?.hypothesis_outcomes || diagnosis?.hypothesis_results || diagnosis?.hypotheses
  );

  return (
    <section className="diagnosis-output panel-glass">
      <div className="diagnosis-hero">
        <div>
          <span className="section-kicker">Agent diagnosis</span>
          <h2>{diagnosis?.summary || 'Diagnosis generated'}</h2>
        </div>
        <div className="severity-card">
          <span>Incident severity</span>
          <strong>Revenue risk</strong>
        </div>
      </div>

      <div className="rate-grid" aria-label="Failure rate comparison">
        <article>
          <span>Current failure rate</span>
          <strong className="rate-current">{currentRate}</strong>
        </article>
        <article>
          <span>7-day baseline</span>
          <strong className="rate-baseline">{baselineRate}</strong>
        </article>
        <article>
          <span>Developer handoff</span>
          <strong>{jira?.ticket_id || 'Ready'}</strong>
        </article>
      </div>

      <div className="diagnosis-grid">
        <section className="diagnosis-card affected-card">
          <h3>Affected surface</h3>
          <dl>
            <div>
              <dt>Payment method</dt>
              <dd>{affected.payment_method || '—'}</dd>
            </div>
            <div>
              <dt>Gateway</dt>
              <dd>{affected.gateway || '—'}</dd>
            </div>
            <div>
              <dt>Bank</dt>
              <dd>{affected.bank || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="diagnosis-card cause-card">
          <h3>Probable cause</h3>
          <p>{diagnosis?.probable_cause || 'The agent completed the investigation and produced a structured diagnosis.'}</p>
        </section>
      </div>

      {hypothesisEvidence.length > 0 && (
        <section className="diagnosis-card evidence-card">
          <h3>Hypothesis evidence</h3>
          <div className="evidence-list">
            {hypothesisEvidence.slice(0, 4).map((item, index) => (
              <div key={`${item.title}-${index}`}>
                <span>{item.status}</span>
                <p>{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section className="diagnosis-card action-card">
          <h3>Recommended actions</h3>
          <ol>
            {actions.map((action, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <p>{action}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {jira && (
        <div className="jira-footer">
          <div>
            <span>Jira ticket created</span>
            <strong>{jira.ticket_id}</strong>
          </div>
          {jira.ticket_url && (
            <a href={jira.ticket_url} target="_blank" rel="noopener noreferrer">
              Open ticket
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}

      <style>{`
        .diagnosis-output {
          padding: 1.25rem;
        }

        .diagnosis-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: start;
        }

        .diagnosis-hero h2 {
          margin: 0.45rem 0 0;
          color: var(--text-strong);
          font-size: clamp(1.45rem, 3vw, 2.2rem);
          line-height: 1.05;
          letter-spacing: -0.055em;
        }

        .severity-card,
        .diagnosis-card,
        .rate-grid article,
        .jira-footer {
          border: 1px solid var(--border-soft);
          background: rgba(2, 6, 23, 0.46);
          border-radius: var(--radius-lg);
        }

        .severity-card {
          padding: 0.9rem 1rem;
          min-width: 170px;
        }

        .severity-card span,
        .rate-grid span,
        .diagnosis-card h3,
        .jira-footer span {
          display: block;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .severity-card strong {
          display: block;
          margin-top: 0.3rem;
          color: var(--warning);
          font-size: 1.05rem;
        }

        .rate-grid {
          margin: 1.1rem 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .rate-grid article {
          padding: 1rem;
        }

        .rate-grid strong {
          display: block;
          margin-top: 0.35rem;
          color: var(--text-strong);
          font-family: var(--font-mono);
          font-size: clamp(1.35rem, 3vw, 2rem);
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .rate-grid .rate-current {
          color: var(--error);
        }

        .rate-grid .rate-baseline {
          color: var(--success);
        }

        .diagnosis-grid {
          display: grid;
          grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr);
          gap: 0.75rem;
        }

        .diagnosis-card {
          padding: 1rem;
        }

        .diagnosis-card h3 {
          margin: 0 0 0.75rem;
        }

        .diagnosis-card p {
          margin: 0;
          color: var(--text-soft);
          line-height: 1.65;
        }

        .affected-card dl {
          display: grid;
          gap: 0.65rem;
          margin: 0;
        }

        .affected-card dl > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .affected-card dt {
          color: var(--text-muted);
          font-size: 0.84rem;
        }

        .affected-card dd {
          margin: 0;
          border-radius: 999px;
          background: rgba(45, 212, 191, 0.1);
          color: var(--accent);
          padding: 0.35rem 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          font-weight: 900;
        }

        .evidence-card,
        .action-card {
          margin-top: 0.75rem;
        }

        .evidence-list {
          display: grid;
          gap: 0.6rem;
        }

        .evidence-list div {
          display: grid;
          grid-template-columns: 98px minmax(0, 1fr);
          gap: 0.65rem;
          align-items: start;
        }

        .evidence-list span {
          width: fit-content;
          border-radius: 999px;
          padding: 0.3rem 0.5rem;
          background: rgba(45, 212, 191, 0.1);
          color: var(--accent);
          font-family: var(--font-mono);
          font-size: 0.67rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .action-card ol {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.75rem;
        }

        .action-card li {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.75rem;
          align-items: start;
        }

        .action-card li span {
          width: 2rem;
          height: 2rem;
          display: grid;
          place-items: center;
          border-radius: 0.75rem;
          background: linear-gradient(135deg, rgba(45, 212, 191, 0.18), rgba(56, 189, 248, 0.12));
          color: var(--accent);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 900;
        }

        .jira-footer {
          margin-top: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem;
        }

        .jira-footer strong {
          display: block;
          margin-top: 0.25rem;
          color: var(--text-strong);
          font-family: var(--font-mono);
          font-size: 1.05rem;
        }

        .jira-footer a {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          border-radius: 999px;
          padding: 0.7rem 0.95rem;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: #03121f;
          font-size: 0.86rem;
          font-weight: 950;
          text-decoration: none;
        }

        @media (max-width: 780px) {
          .diagnosis-hero,
          .diagnosis-grid,
          .rate-grid {
            grid-template-columns: 1fr;
          }

          .jira-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .jira-footer a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}

function normalizeEvidence(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return { status: 'Evidence', title: item };
      return {
        status: item.status || item.outcome || item.result || 'Evidence',
        title: item.hypothesis || item.title || item.summary || JSON.stringify(item),
      };
    });
  }

  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => ({
      status: typeof item === 'object' ? item.status || item.outcome || 'Evidence' : 'Evidence',
      title: typeof item === 'object' ? item.summary || item.hypothesis || key : `${key}: ${item}`,
    }));
  }

  return [{ status: 'Evidence', title: String(value) }];
}
