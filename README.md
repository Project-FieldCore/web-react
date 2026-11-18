# web-react

Painel web administrativo / supervisor do **FieldOps** (org FieldCore).

## Documentação

- Assistentes de IA: [docs/AGENTS.md](https://github.com/Project-FieldCore/docs/blob/main/AGENTS.md) · [AGENTS.md](AGENTS.md)

Especificação do produto, gestão e convenções (fonte canônica):

- Hub: [Project-FieldCore/docs](https://github.com/Project-FieldCore/docs)
- Branches, commits, issues e PRs: [BRANCH_COMMIT_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/BRANCH_COMMIT_CONVENTION.md)
- Backlog / DoD: Notion export em `docs` (páginas 15–18)

## Requisitos locais

- Node.js **22** (versão usada no CI; mín. 18.18) e npm

## Executar (dev)

```bash
cd web-react
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
npm ci
npm run dev                        # http://localhost:3000
```

- **A API precisa estar no ar** para login e cadastros: suba a [api-java](../api-java/README.md) (perfil `dev`,
  `http://localhost:8080`) antes de abrir o painel.
- Login com os usuários do seed da API (senha `DemoPass123!`, só para demo): `admin@fieldcore.com` (ADMIN),
  `ana.silva@example.com` (SUPERVISOR). Lista completa em [DEMO_SEED.md](../api-java/docs/DEMO_SEED.md).
- Se a API estiver em outro host/porta, ajuste `NEXT_PUBLIC_API_BASE_URL` em `.env.local`.

| Script | Função |
|--------|--------|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e execução de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes (Vitest) |

## Estados de interface

As telas com dados remotos tratam os estados **carregando**, **vazio**, **erro** e **sucesso**
(doc. 14.15). Erros da API seguem o formato padronizado `ErrorResponse` (`code`, `message`, `fieldErrors`) descrito no
[README da API](../api-java/README.md#formato-padronizado-de-erro).

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
npm test
```

Detalhes do workflow GitHub Actions: [docs/CI.md](docs/CI.md). Convenção dos 3 repos: [CI_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/CI_CONVENTION.md).

## Git

Segue a convenção do projeto em [BRANCH_COMMIT_CONVENTION.md](https://github.com/Project-FieldCore/docs/blob/main/PROJECT_MANAGEMENT/BRANCH_COMMIT_CONVENTION.md) (branches `tipo/PBI-XXXX-…`, base `develop` neste repo, commits `:gitmoji: type: …`, PRs `[PBI-XXXX] …`).
