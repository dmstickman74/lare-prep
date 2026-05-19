# Deploying LARE Prep to the Azure VM

The app ships as a single Docker stack:

- **`lareprep-api`** — Node 22 container. Serves the static frontend on `/` and the progress sync API on `/api/*`.
- **`lareprep-postgres`** — Postgres 18 container, dedicated to this stack. Schema is auto-applied via `/docker-entrypoint-initdb.d`.

The host Caddy (on the shared `portainer-proxy_proxy` network) reverse-proxies the public hostname to `lareprep-api:4001`.

## One-time setup on the VM

```bash
# 1. Clone
sudo git clone https://github.com/ASLA1899/lareprep.git /srv/lareprep
cd /srv/lareprep

# 2. Set the Postgres password
sudo cp .env.example .env
sudo $EDITOR .env       # set POSTGRES_PASSWORD
sudo chmod 600 .env

# 3. Bring up the stack
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs -f api    # ctrl-C when you've seen "lareprep-api listening on..."

# 4. Smoke-test from the VM
sudo docker exec lareprep-api node -e \
  "fetch('http://127.0.0.1:4001/healthz').then(r=>r.json()).then(j=>console.log(j))"

# 5. Wire up Caddy (host)
sudo cp deploy/Caddyfile.snippet /etc/caddy/conf.d/lareprep.caddy   # or paste into Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

> **DNS:** point `lareprep.aslalabs.org` at the VM before Caddy issues a cert, or it will fall back to internal TLS.

## Updating

```bash
cd /srv/lareprep
sudo git pull
sudo docker compose up -d --build
```

If `server/schema.sql` changed, the auto-init only runs on a *fresh* data volume. For schema changes after first deploy, run them by hand:

```bash
sudo docker exec -i lareprep-postgres psql -U lareprep -d lareprep < server/schema.sql
```

(Eventually swap in a real migration tool if the schema grows.)

## Conventions / gotchas

- **Never** reference Postgres as `postgres` in `DATABASE_URL` from any container on `portainer-proxy_proxy`. That hostname is aliased to another stack's database. Use the explicit `container_name` (`lareprep-postgres`) — this stack already does.
- The API listens on `4001` inside the container and is **not** published to the host. Caddy reaches it over the `portainer-proxy_proxy` Docker network.
- Static frontend is baked into the API image at `/app/public`. Updating frontend = rebuilding the image (handled by `docker compose up -d --build`).
- Postgres data lives in the `lareprep-pgdata` named volume. To wipe it (will lose all progress): `docker compose down -v`.
- The API process runs as the unprivileged `node` user (UID 1000) inside the container.

## Identity model (for the SSO pass)

Progress is keyed by a random UUID the client generates on first visit and sends as `X-Device-Id`. When Impexium SSO is wired up, the API will switch to keying rows by the authenticated user ID, and existing device IDs will be linkable at first sign-in. No DB shape change needed — just a column addition.
