# My Agents

Monorepo project: Vite + React frontend | uv + Python backend

## Project Structure

```
my-agents/
├── apps/
│   ├── frontend/          # Vite + React + TypeScript
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── ...
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── backend/           # uv + Python + FastAPI
│       ├── app/
│       │   ├── main.py
│       │   ├── api.py
│       │   ├── core/
│       │   └── run.py
│       ├── tests/
│       └── pyproject.toml
├── packages/              # Shared packages (future)
├── pnpm-workspace.yaml
├── package.json
└── .gitignore
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- uv (Python package manager)
- Python >= 3.11

### Install Dependencies

```bash
# Frontend
pnpm install

# Backend
cd apps/backend && uv sync
```

### Development

```bash
# Start frontend only
pnpm dev

# Start backend only
pnpm dev:backend

# Start both frontend and backend
pnpm dev:all
```

### Build

```bash
pnpm build
```

## Ports

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
