# PaySentinel — Folder Structure

```
PaySentinel/
├── .gitignore
├── backend/
│   ├── .env
│   ├── agent.js
│   ├── index.js
│   ├── package.json
│   ├── data/
│   │   └── seedLogs.js
│   └── tools/
│       ├── analyzerTool.js
│       ├── elasticTool.js
│       └── jiraTool.js
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.css
        ├── App.jsx
        ├── index.css
        ├── main.jsx
        └── components/
            ├── DiagnosisOutput.jsx
            ├── InvestigationPanel.jsx
            └── StepTracker.jsx
```

## Summary

| Path | Description |
|------|-------------|
| `backend/` | Node.js API and agent orchestration |
| `backend/tools/` | Integrations (Elasticsearch, Jira, analyzer) |
| `backend/data/` | Seed/mock log data |
| `frontend/` | Vite + React UI |
| `frontend/src/components/` | Investigation UI components |
