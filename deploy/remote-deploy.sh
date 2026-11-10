#!/usr/bin/env bash
# Serverda ishlaydigan deploy qadamlari (GitHub Actions `ssh ... bash -s` orqali chaqiradi)
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-/var/www/myticket}"
cd "$APP_DIR"

export PATH="/usr/bin:/usr/local/bin:$PATH"
mkdir -p logs uploads

echo "==> Prod paketlar o'rnatilmoqda"
pnpm install --prod --frozen-lockfile

echo "==> Migratsiyalar qo'llanmoqda"
npx prisma migrate deploy

echo "==> PM2 qayta ishga tushirilmoqda"
if pm2 describe myticket > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

pm2 describe myticket | grep -E 'status|uptime|restarts' || true
echo "==> Deploy tugadi"
