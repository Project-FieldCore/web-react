# CI/CD — web-react

Actions pinned to commit SHAs; least-privilege `permissions`.

## Pull Request Validation

Workflow: `.github/workflows/pull-request-validation.yml`  
Name: **0. [Auto] Pull Request Validation**

Runs on pull requests targeting `develop` / `main` (and manual `workflow_dispatch`).

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

- Node **22** (LTS) with npm cache
- Build uses a placeholder `NEXT_PUBLIC_API_BASE_URL` (no live API call)
- Quality gate only — deploy workflows rebuild for standalone publish

**Branch protection:** require this check on `develop` before merge. Deploy DEV
rebuilds the Next.js standalone bundle after merge and relies on that gate.

## Deploy DEV (automatic)

Workflow: `.github/workflows/deploy-dev.yml`  
Triggers: `push` to `develop` + `workflow_dispatch`  
Environment: `development`

1. `npm ci` + `npm run build` with `vars.NEXT_PUBLIC_API_BASE_URL` (**baked at build time**)
2. Stage `.next/standalone` + `.next/static` + `public` (must include hidden `.next`; CI asserts `publish/.next/BUILD_ID`)
3. Upload with `include-hidden-files: true`, transfer as `publish.tar.gz` (not `publish/*`), extract/rsync on EC2, patch `fieldops-web.env`, restart systemd, health check `http://127.0.0.1:${SERVER_PORT}/`

## Deploy Production (manual)

Workflow: `.github/workflows/deploy-production.yml`  
Trigger: `workflow_dispatch` only  
Environment: `production` (separate EC2 — different `AWS_HOST`)

Same shape as DEV; paths/service names **without** `dev-` prefix.

## Docs

- Host bootstrap (Node 22, Nginx → 3000, systemd `node server.js`, SG): [DEPLOY_EC2.md](DEPLOY_EC2.md)
- Secrets/variables from scratch: [SECRETS.md](SECRETS.md)

## Run the same checks locally

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

No EC2 secrets are required for PR validation.
