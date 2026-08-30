# Project Commands

## Install dependencies

```bash
npm install
```

## Start development server

```bash
npm run dev          # live console at http://localhost:5173
```

## Run tests

```bash
npx vitest run       # engine + rubric + ablation + gate state machine
```

Note: there is no `npm test` script by design — vitest is a dev dependency
invoked directly; the repo ships with only `dev`, `build`, `typecheck`.

## Run type checking

```bash
npm run typecheck    # tsc --noEmit
```

## Linting

No linter is configured. `npm run build` (vite) + `npm run typecheck` are the
static gates. Do not add eslint/prettier configs unless the team asks —
document the gap instead.

## Build

```bash
npm run build        # static artifact in dist/ (the deployment target)
```

## Preview the built artifact

```bash
npm run preview      # or: npx serve dist
```

## Database migration

None to run: storage is a localStorage document migrated lazily on first read
(`src/backend/db.ts`). To start clean: clear site data, or call `db.reset()`
from a console/test context (never from UI).

## Reproduce the scored evaluation (clean environment)

```bash
npm install && npx vitest run
# expect: baseline 30% / agent 100%, false pages 5 → 0, wrong-team 9 → 0,
#         ablation 30 → 71 → 96 → 100, gate 401/403/409/422 paths green
```

## Notes

- Zero environment variables required; `.env.example` documents two optional
  developer flags (`VITE_CHAOS_DEFAULT`, `VITE_LOG_LEVEL`).
- Runtime for the full evaluation: <1 s. Cost: $0.00.
