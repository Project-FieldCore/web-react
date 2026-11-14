#!/usr/bin/env bash
# Applies runtime env on the EC2 host and restarts the FieldOps web systemd unit.
# NEXT_PUBLIC_* is NOT set here — it is baked into the Next.js bundle at CI build time.
set -euo pipefail

DEPLOY_TARGET="${DEPLOY_TARGET:?DEPLOY_TARGET is required (vars.TARGET_DIR)}"
SERVER_PORT="${SERVER_PORT:-3000}"
ENV_FILE_NAME="fieldops-web.env"

echo "PATCH started: DEPLOY_TARGET=${DEPLOY_TARGET} SERVER_PORT=${SERVER_PORT}"

write_env_file() {
  local env_file="${DEPLOY_TARGET}/${ENV_FILE_NAME}"
  {
    # Next.js standalone listens on PORT; SERVER_PORT kept for parity with docs/workflows.
    echo "PORT=${SERVER_PORT}"
    echo "SERVER_PORT=${SERVER_PORT}"
    echo "HOSTNAME=127.0.0.1"
  } | sudo tee "$env_file" >/dev/null
  sudo chmod 600 "$env_file"
  echo "Wrote ${env_file}"
}

verify_standalone() {
  if [ ! -f "${DEPLOY_TARGET}/server.js" ]; then
    echo "ERROR: ${DEPLOY_TARGET}/server.js missing after deploy." >&2
    ls -la "${DEPLOY_TARGET}" >&2 || true
    exit 1
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: node not found on PATH for the deploy user." >&2
    exit 1
  fi
  echo "Node: $(node -v)"
}

verify_systemd_and_health() {
  local service="$1"
  local url="http://127.0.0.1:${SERVER_PORT}/"

  if ! sudo systemctl is-active --quiet "$service"; then
    echo "ERROR: ${service} is not active after restart." >&2
    sudo systemctl status "$service" --no-pager -n 30 || true
    sudo journalctl -u "$service" -n 40 --no-pager || true
    exit 1
  fi
  echo "Service active: ${service}"

  local attempt code
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    if [ "$code" = "200" ]; then
      echo "Health OK (${url} → HTTP ${code})"
      return 0
    fi
    echo "Waiting for Next.js (${url}) attempt ${attempt}/12 (HTTP ${code:-000})..."
    sleep 5
  done

  echo "ERROR: health check failed at ${url} (last HTTP ${code})." >&2
  echo "Check Nginx: proxy_pass must target 127.0.0.1:${SERVER_PORT}." >&2
  sudo ss -tlnp | grep -E ":${SERVER_PORT}\\b" || echo "Nothing listening on port ${SERVER_PORT}." >&2
  sudo journalctl -u "$service" -n 40 --no-pager || true
  exit 1
}

write_env_file
verify_standalone
echo "Application env patch completed."

SYSTEMD_SERVICE_NAME="${SYSTEMD_SERVICE_NAME:-${SYSTEMD_SERVICE_FALLBACK:-fieldops-web.service}}"

if [ -n "${SYSTEMD_SERVICE_NAME}" ]; then
  ENV_FILE="${DEPLOY_TARGET}/${ENV_FILE_NAME}"
  DROPIN_DIR="/etc/systemd/system/${SYSTEMD_SERVICE_NAME}.d"
  DROPIN_FILE="${DROPIN_DIR}/github-actions-deploy.conf"
  sudo mkdir -p "$DROPIN_DIR"
  {
    echo "[Service]"
    echo "EnvironmentFile=-${ENV_FILE}"
    echo "WorkingDirectory=${DEPLOY_TARGET}"
  } | sudo tee "$DROPIN_FILE" >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl restart "$SYSTEMD_SERVICE_NAME"
  echo "Service restarted (${SYSTEMD_SERVICE_NAME})."
  verify_systemd_and_health "$SYSTEMD_SERVICE_NAME"
fi
