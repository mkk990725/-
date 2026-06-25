# Football Analysis Agent Architecture

## Current Migration Strategy

The project is being migrated in phases instead of being rewritten in one step.

Current stable service:

- `server.js` keeps serving the existing web app and APIs on `127.0.0.1:5174`.
- Vue/Vite development server keeps running on `127.0.0.1:5173`.

New architecture scaffold:

- `backend/` contains the FastAPI application and typed API routes.
- `engine/` contains deterministic scoring and calculation code.
- `ai/` contains large-model adapters and report generation.
- `tests/` contains Python tests for deterministic modules.

## Layer Boundaries

### Frontend

Vue 3 + Vite + Naive UI + ECharts.

Responsibilities:

- Display match list and match detail.
- Display prediction heat cards.
- Trigger manual refresh and prediction tasks.
- Never calculate final prediction scores.

### Backend

FastAPI.

Responsibilities:

- Validate all API input and output through Pydantic schemas.
- Read and write SQLite.
- Coordinate data refresh, prediction, AI report generation, and scheduled tasks.

### Math Engine

Python deterministic code.

Responsibilities:

- Source sufficiency score.
- Analysis score.
- Confidence for winner, goals, score, and half/full-time.
- Future statistical and machine-learning corrections.

The large model must not replace this layer.

### AI Layer

Adapter-based LLM integration.

Responsibilities:

- Explain deterministic outputs.
- Generate Chinese reports.
- Summarize prematch information.
- Suggest missing data and model-configuration improvements.

### Database

SQLite for the local MVP.

Current compatibility:

- The new repository can read existing `football-agent.db`.
- The new `/api/matches` can read existing `.cache/scoreboard/*.json`.
- The new `/api/predictions/{match_id}` can read legacy predictions.

## Local Commands

Install Python dependencies in a Python 3.11 or 3.12 environment:

```bash
pip install -r requirements.txt
```

Run current Node service:

```bash
npm start
```

Run current Vite frontend:

```bash
npm run dev
```

Run new FastAPI backend:

```bash
npm run api:dev
```

Run Python tests:

```bash
npm run test:py
```

## Python Version Note

The local `py` launcher currently points to Python 3.14. The selected numerical stack is safer on Python 3.11 or 3.12 because NumPy, SciPy, pandas, and scikit-learn release compatibility there first.

On this workstation, the project uses an isolated local conda environment at `.conda/football-agent`. It is ignored by Git and does not modify existing Python environments or model configuration keys.
