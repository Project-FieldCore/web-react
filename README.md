# web-react

Painel web administrativo / supervisor do **FieldOps** (org FieldCore).

## Documentação

- Assistentes de IA: [docs/AGENTS.md](https://github.com/Project-FieldCore/docs/blob/main/AGENTS.md) · [AGENTS.md](AGENTS.md)
Especificação do produto, gestão e convenções (fonte canônica):

- Hub: [Project-FieldCore/docs](https://github.com/Project-FieldCore/docs)
- Branches, commits, issues e PRs: [BRANCH_COMMIT_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/BRANCH_COMMIT_CONVENTION.md)
- Backlog / DoD: Notion export em `docs` (páginas 15–18)

## Mocks OpenAPI (cadastros)

Cadastros de seed (`users` / `clients` / `sites` / `equipment`) vêm de
`src/data/openapi/fieldops-v1.json` (cópia do mock canônico da API) via
`src/data/contract-mocks.ts`. Credenciais de demo local ficam em
`src/data/demo-credentials.ts` (fora do contrato). Modelos/inspeções de UI
continuam como demo local com FKs apontando para os UUIDs do contrato.

## Qualidade / CI

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

Detalhes do workflow GitHub Actions: [docs/CI.md](docs/CI.md). Convenção dos 3 repos: [CI_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/CI_CONVENTION.md).

## Git

Segue a convenção do projeto em [BRANCH_COMMIT_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/BRANCH_COMMIT_CONVENTION.md) (branches `tipo/PBI-XXXX-…`, base `develop` neste repo, commits `:gitmoji: type: …`, PRs `[PBI-XXXX] …`).
