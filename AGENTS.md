# AGENTS — web-react

Contexto canônico (qualquer IA):  
**https://github.com/Project-FieldCore/docs/blob/main/AGENTS.md**

## Este repositório

- Stack: Next.js (App Router) + TypeScript + Tailwind ([ADR 0002](https://github.com/Project-FieldCore/docs/blob/main/DECISIONS/0002-web-nextjs-instead-of-angular.md))
- Branch de integração: `develop`
- CI/CD: [docs/CI.md](docs/CI.md) → PR validation `npm ci && npm run lint && npm run typecheck && npm run build`; deploy EC2: [docs/DEPLOY_EC2.md](docs/DEPLOY_EC2.md), secrets: [docs/SECRETS.md](docs/SECRETS.md)
- Estados de UI: `src/components/States.tsx`
- Título de PR: `[PBI-XXXX] …` ou `[PBI-XXXX.N] …`

Não duplique regras de produto aqui. Instruções de um vendor específico devem
apenas referenciar o `AGENTS.md` do repo `docs`.
