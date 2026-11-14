# Secrets e variáveis — FieldOps Web (web-react)

Criar **do zero** no GitHub. Nada sensível deve ser commitado.

## Visão geral

| Camada | Onde no GitHub | Uso |
| ------ | -------------- | --- |
| Sensível (por ambiente) | Environment secrets | `AWS_HOST` |
| Não sensível (por ambiente) | Environment variables | `TARGET_DIR`, `SYSTEMD_SERVICE`, `SERVER_PORT`, `NEXT_PUBLIC_API_BASE_URL` |
| Compartilhado | Repository ou Organization secrets | `AWS_USER`, `AWS_SSH_KEY` |

Mesmos **nomes** em `development` e `production`; **valores** diferentes (EC2 e URL da API distintos).

Este host **não** precisa de `JWT_SECRET` nem `DATABASE_*` — autenticação e banco ficam na API.

Bootstrap completo do host: [DEPLOY_EC2.md](DEPLOY_EC2.md).

---

## Passo a passo — criar do zero

### 1. Environments

**Settings → Environments** → New environment:

1. `development` (obrigatório para deploy DEV)
2. `production` (quando a EC2 PRD existir; recomendado: required reviewers)

### 2. Secrets do Environment `development`

| Secret | Como obter / exemplo |
| ------ | -------------------- |
| `AWS_HOST` | IP ou DNS público/privado da EC2 **web** DEV (dedicada, não a da API) |

Repita no Environment `production` com a **outra** EC2 web.

### 3. Variables do Environment `development`

| Variable | Exemplo DEV | Exemplo PRD |
| -------- | ----------- | ----------- |
| `TARGET_DIR` | `/srv/dev-fieldops-web` | `/srv/fieldops-web` |
| `SYSTEMD_SERVICE` | `dev-fieldops-web.service` | `fieldops-web.service` |
| `SERVER_PORT` | `3000` | `3000` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api-dev.example.com/api/v1` | `https://api.example.com/api/v1` |

**Importante — build-time:** `NEXT_PUBLIC_*` é **inlineado no bundle** pelo Next.js durante `npm run build` no workflow. Trocar a URL da API exige **novo deploy** (rebuild). O script no EC2 **não** redefine `NEXT_PUBLIC_API_BASE_URL`.

Substitua os placeholders pelos endpoints reais da API (DEV/PRD) antes do primeiro deploy.

### 4. Secrets de repositório / organização

| Secret | Uso |
| ------ | --- |
| `AWS_USER` | Usuário SSH (ex. `ubuntu`) |
| `AWS_SSH_KEY` | Chave privada PEM completa (inclui `BEGIN`/`END`) |

Se forem Organization secrets, libere **Repository access** para `Project-FieldCore/web-react`.

---

## Runtime no EC2 (`fieldops-web.env`)

O script `.github/scripts/patch-application-ec2.sh` grava (permissão `600`):

| Variável | Origem |
| -------- | ------ |
| `PORT` | `vars.SERVER_PORT` (Next.js standalone) |
| `SERVER_PORT` | `vars.SERVER_PORT` (documentação / health) |
| `HOSTNAME` | fixo `127.0.0.1` (só Nginx local) |

Não há JWT nem DATABASE neste arquivo.

---

## Workflows

| Workflow | Environment | Secrets necessários |
| -------- | ----------- | ------------------- |
| `pull-request-validation.yml` | — | nenhum |
| `deploy-dev.yml` | `development` | `AWS_HOST` + `AWS_USER` / `AWS_SSH_KEY` |
| `deploy-production.yml` | `production` | idem (outro `AWS_HOST`) |

Deploy DEV reconstrói o standalone após o merge; mantenha branch protection em `develop` exigindo **Pull Request Validation**.

---

## Local (sem secrets de EC2)

```bash
cp .env.local.example .env.local
# edite NEXT_PUBLIC_API_BASE_URL se a API local não estiver em :8080
npm run dev
```
