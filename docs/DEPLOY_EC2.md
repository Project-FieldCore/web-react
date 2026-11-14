# Deploy EC2 — FieldOps Web (web-react)

Bootstrap de uma EC2 **vazia** (dedicada ao web) para rodar o Next.js **standalone** via **systemd** atrás de **Nginx**.
Sem Docker nesta entrega. Sem JDK — apenas **Node.js 22**.

| Ambiente | Prefixo | Exemplo `TARGET_DIR` | Exemplo unit | Gatilho |
| -------- | ------- | -------------------- | ------------ | ------- |
| **DEV** | `dev-` | `/srv/dev-fieldops-web` | `dev-fieldops-web.service` | push/`workflow_dispatch` em `develop` |
| **PRD** | *(nenhum)* | `/srv/fieldops-web` | `fieldops-web.service` | só `workflow_dispatch` (outra EC2) |

Ambientes suportados neste pipeline: **development** e **production** apenas.

`NEXT_PUBLIC_API_BASE_URL` é definido no **build** do GitHub Actions (Environment variable). Alterar a URL da API exige novo deploy — o host não reaplica essa variável em runtime.

Artefato publicado: conteúdo de `.next/standalone` + `.next/static` + `public` (servidor `node server.js`). O diretório oculto `.next` **deve** chegar no host (`BUILD_ID` presente); o pipeline usa `include-hidden-files` + tarball — não use `publish/*` no SCP (o glob bash omite `.next`).

---

## 1. Pacotes (Ubuntu 22.04/24.04)

```bash
sudo apt-get update
sudo apt-get install -y nginx curl ca-certificates gnupg

# Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v22.x
npm -v
```

---

## 2. Usuário SSH e sudo

Use o usuário definido em `AWS_USER` (ex. `ubuntu`). Confirme login por chave e, se o deploy usar `sudo` sem senha para `systemctl`/`tee`/`rsync`:

```bash
# exemplo mínimo — ajuste o usuário
echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/tee, /usr/bin/mkdir, /usr/bin/cp, /usr/bin/mv, /usr/bin/rm, /usr/bin/rsync, /usr/bin/chmod, /usr/bin/chown, /usr/bin/journalctl, /usr/bin/ss' \
  | sudo tee /etc/sudoers.d/fieldops-deploy
sudo chmod 440 /etc/sudoers.d/fieldops-deploy
```

---

## 3. Swap (recomendado em t3.micro)

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 4. Pastas e permissões (DEV)

```bash
export TARGET_DIR=/srv/dev-fieldops-web   # PRD: /srv/fieldops-web
sudo mkdir -p "${TARGET_DIR}/logs"
sudo chown -R "$USER:$USER" "${TARGET_DIR}"
```

---

## 5. Unit systemd (exemplo DEV)

Arquivo `/etc/systemd/system/dev-fieldops-web.service` (PRD: `fieldops-web.service` e paths sem `dev-`):

```ini
[Unit]
Description=FieldOps Web (DEV)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/srv/dev-fieldops-web
ExecStart=/usr/bin/node server.js
EnvironmentFile=-/srv/dev-fieldops-web/fieldops-web.env
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable dev-fieldops-web.service
# start só depois do primeiro deploy (standalone + .env)
```

O workflow grava um drop-in em `/etc/systemd/system/<service>.d/github-actions-deploy.conf` apontando `EnvironmentFile` e `WorkingDirectory`.

Confirme que `ExecStart` usa o mesmo `node` do `PATH` (`which node` → tipicamente `/usr/bin/node`).

---

## 6. Nginx (HTTP agora; TLS depois)

Site exemplo `/etc/nginx/sites-available/fieldops-web` (`proxy_pass` → porta do `SERVER_PORT`, ex. `3000`):

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/fieldops-web /etc/nginx/sites-enabled/fieldops-web
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Security group

| Porta | Uso |
| ----- | --- |
| 22 | SSH (restrinja ao IP do GitHub Actions / seu bastion se possível) |
| 80 / 443 | HTTP(S) público via Nginx |

A porta do Node (`SERVER_PORT`, tipicamente `3000`) **não** precisa estar aberta na internet — só em `127.0.0.1`.

---

## 8. Checklist GitHub (criar do zero)

Detalhes e valores: [SECRETS.md](SECRETS.md).

1. **Settings → Environments** → criar `development` e (quando houver EC2 PRD) `production`.
2. Em cada Environment, secret: `AWS_HOST`.
3. Em cada Environment, variables: `TARGET_DIR`, `SYSTEMD_SERVICE`, `SERVER_PORT`, `NEXT_PUBLIC_API_BASE_URL` (URL real da API — sem placeholder).
4. Repo/org secrets: `AWS_USER`, `AWS_SSH_KEY` (acesso do repositório aos org secrets, se forem de org).
5. Branch protection em `develop`: exigir o check **Pull Request Validation** antes do merge.

---

## 9. Sem banco nesta EC2

O painel web só chama a API HTTP. Postgres/JWT ficam na EC2 (ou stack) da **api-java**. Aponte `NEXT_PUBLIC_API_BASE_URL` para o endpoint público (ou interno, se CORS/rede permitir) da API do mesmo ambiente.

---

## 10. Comandos auxiliares

```bash
# SSH
ssh -i ~/.ssh/sua-chave ubuntu@<AWS_HOST>

# Serviço
sudo systemctl status dev-fieldops-web.service
sudo journalctl -u dev-fieldops-web.service -n 80 --no-pager -f
sudo systemctl restart dev-fieldops-web.service

# Health local (mesmo alvo do deploy)
curl -sf -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/

# Env gerado pelo patch (não versionar)
sudo ls -la /srv/dev-fieldops-web/
sudo cat /srv/dev-fieldops-web/fieldops-web.env

# Nginx
sudo nginx -t
sudo systemctl reload nginx

# Teste SSH a partir da máquina local (simula Actions)
ssh -o BatchMode=yes -o ConnectTimeout=10 ubuntu@<AWS_HOST> 'echo ok && node -v'
```

---

## Workflows

| Arquivo | Quando |
| ------- | ------ |
| `.github/workflows/pull-request-validation.yml` | PR → `develop` / `main` |
| `.github/workflows/deploy-dev.yml` | push → `develop` + manual |
| `.github/workflows/deploy-production.yml` | só manual (`production`) |

Script remoto: `.github/scripts/patch-application-ec2.sh` (grava `fieldops-web.env`, drop-in systemd, restart, health em `/`).
