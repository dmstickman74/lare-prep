# Deploying LARE Prep to the Azure VM

This site has two pieces:

1. **Static frontend** — plain HTML/CSS/JS in the repo root (`index.html`, `css/`, `js/`, `assets/`, `fonts/`). Caddy serves it directly.
2. **Progress sync API** — small Node service in `server/` that persists per-device exam/lesson progress to Postgres.

Both run on the same VM. Caddy reverse-proxies `/api/*` to the Node service on `127.0.0.1:4001`; everything else is served as static files.

## One-time setup

### 1. System user + paths

```bash
sudo useradd --system --home /var/www/lareprep --shell /usr/sbin/nologin lareprep
sudo mkdir -p /var/www/lareprep
sudo chown -R lareprep:lareprep /var/www/lareprep
```

### 2. Postgres

```bash
sudo -u postgres psql <<SQL
CREATE USER lareprep WITH PASSWORD 'change-me';
CREATE DATABASE lareprep OWNER lareprep;
SQL
```

### 3. Deploy code

```bash
sudo -u lareprep git clone https://github.com/ASLA1899/lareprep.git /var/www/lareprep
cd /var/www/lareprep/server
sudo -u lareprep npm ci --omit=dev
sudo -u lareprep cp .env.example .env
# edit /var/www/lareprep/server/.env and set DATABASE_URL
sudo -u lareprep DATABASE_URL='postgres://lareprep:change-me@127.0.0.1:5432/lareprep' npm run migrate
```

### 4. systemd service

```bash
sudo cp /var/www/lareprep/deploy/lareprep-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lareprep-api
sudo systemctl status lareprep-api
curl -s http://127.0.0.1:4001/healthz
```

### 5. Caddy

Add the contents of `deploy/Caddyfile.snippet` to `/etc/caddy/Caddyfile` (update the hostname), then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Updating

```bash
sudo -u lareprep git -C /var/www/lareprep pull
cd /var/www/lareprep/server
sudo -u lareprep npm ci --omit=dev
# only if schema.sql changed:
sudo -u lareprep DATABASE_URL=... npm run migrate
sudo systemctl restart lareprep-api
```

## Notes

- Identity is currently a random UUID generated client-side, stored in `localStorage` as `lare-device-id`, and sent as `X-Device-Id` on every API call. This means "progress sync" today survives data wipes within the same browser, but does **not** cross devices. That's intentional — when Impexium SSO is fixed, the API will switch to keying rows by the SSO user ID, and existing device IDs can be linked at first sign-in.
- The Node service listens on `127.0.0.1` only. Do not expose port 4001 publicly — Caddy is the only entry point.
- `server/.env` contains the DB password. It's `gitignore`d and should have mode 0640 owned by `lareprep:lareprep`.
- Request body limit is 256 KB. Bumps to this should be done with care — a progress blob is normally well under 10 KB.
