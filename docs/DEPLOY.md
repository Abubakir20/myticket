# Deploy va CI/CD

## Server

| | |
|---|---|
| SSH | `ssh -p 22001 root@167.86.79.82` |
| Sayt | http://167.86.79.82:28001 |
| Swagger | http://167.86.79.82:28001/api/v1/docs |
| Loyiha papkasi | `/var/www/myticket` |
| Process manager | PM2 (`pm2 ls`, `pm2 logs myticket`) |
| Reverse proxy | nginx `:80` → `127.0.0.1:3006` (tashqi port `28001`) |
| Node | v22 (nodesource), pnpm 10, PM2 7 |
| PostgreSQL | `10.77.0.2:5432/talaba01` (lab serveri beradi) |
| Redis | localhost:6379, `maxmemory 64mb` |

Server 512 MB RAM bilan cheklangan, shuning uchun **build serverda emas, GitHub Actions
runnerida** bajariladi; serverga faqat `dist/` va prod paketlar tushadi.

## CI/CD oqimi

- `.github/workflows/ci.yml` — har push/PR da: `pnpm install` → lint(web) → typecheck(web)
  → `pnpm build` → `pnpm test:web`.
- `.github/workflows/deploy.yml` — `master` yoki `dev` ga push bo'lsa (yoki qo'lda
  "Run workflow"):
  1. runnerda build qiladi;
  2. `rsync` bilan `dist public prisma generated package.json pnpm-lock.yaml
     ecosystem.config.js prisma.config.ts` ni serverga yuboradi
     (`.env`, `uploads`, `logs`, `node_modules` tegilmaydi);
  3. serverda `deploy/remote-deploy.sh` ishga tushadi:
     `pnpm install --prod` → `prisma migrate deploy` → `pm2 reload` → `pm2 save`;
  4. `http://HOST:28001/api/v1/docs` 200 qaytarishini tekshiradi (health check).

## GitHub Secrets (bir marta qo'shiladi)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Nomi | Qiymati |
|---|---|
| `SSH_HOST` | `167.86.79.82` |
| `SSH_PORT` | `22001` |
| `SSH_USER` | `root` |
| `DEPLOY_PATH` | `/var/www/myticket` |
| `PUBLIC_PORT` | `28001` |
| `SSH_PRIVATE_KEY` | `deploy/ci_deploy_key` faylining to'liq matni (BEGIN/END qatorlari bilan) |

Mos public kalit serverdagi `/root/.ssh/authorized_keys` ga allaqachon qo'shilgan.

## Qo'lda deploy (zarur bo'lsa)

```bash
pnpm build
rsync -az --delete -e "ssh -p 22001" \
  --exclude node_modules --exclude .env --exclude uploads --exclude logs \
  dist public prisma generated package.json pnpm-lock.yaml \
  ecosystem.config.js prisma.config.ts deploy \
  root@167.86.79.82:/var/www/myticket/
ssh -p 22001 root@167.86.79.82 "DEPLOY_PATH=/var/www/myticket bash -s" < deploy/remote-deploy.sh
```

## Serverdagi .env

`/var/www/myticket/.env` faqat serverda turadi (git da yo'q). Muhim farqlar:

- `DB_URI` — lab PostgreSQL (`10.77.0.2`);
- `BASE_URL=http://167.86.79.82:28001/uploads` — statik rasmlar `useStaticAssets`
  orqali `/uploads` prefiksida beriladi (lokal `.env` dagi `/api/v1/uploads` xato edi);
- `ORDER_HOLD_MINUTES=15` — lokal `.env` da yo'q, bo'lmasa `NaN` bo'lib buyurtma
  muddati buziladi;
- JWT/OTP kalitlari prod uchun alohida.

## Foydali buyruqlar

```bash
pm2 ls; pm2 logs myticket --lines 50; pm2 reload myticket
systemctl status nginx redis-server
cd /var/www/myticket && node dist/src/seed/seed.js          # demo ma'lumot
cd /var/www/myticket && npx prisma migrate deploy
```

## Domen + HTTPS (keyinroq)

A-record `167.86.79.82` ga, keyin:
`certbot certonly --manual --preferred-challenges dns -d <domen>`,
nginx ga `listen 443 ssl` blokini qo'shib, sertifikat yo'llarini ko'rsatish.
HTTPS tashqi `44301` portida ochiladi.
