# CI — web-react

Pipeline mínimo de qualidade no GitHub Actions (`.github/workflows/ci.yml`).

## O que roda

Em todo `pull_request` e em push para `develop` / `main`:

1. `npm ci`
2. `npm run lint` — ESLint via `next lint` (`next/core-web-vitals` + `next/typescript`)
3. `npm run typecheck` — `tsc --noEmit`
4. `npm run build` — build de produção Next.js

Actions pinadas por SHA; cache npm via `actions/setup-node`. Node **22** (LTS).

## Local

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

Convenção global dos 3 repos de código: [CI_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/CI_CONVENTION.md).
