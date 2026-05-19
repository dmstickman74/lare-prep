# Deploying LARE Prep

Deploys run automatically on every push to `main` (or via `workflow_dispatch` from the Actions tab). The GHA pipeline:

1. **Gate** — `node --check` every JS file + `docker build` the image. Fails fast on syntax errors or broken Dockerfile.
2. **Deploy** — SSHes to the VM as the `lareprep-deploy` user and runs `deploy/deploy.sh`, which `git pull`s, rebuilds the image, runs migrations via `docker compose run --rm api node migrate.js`, then `docker compose up -d`.

Concurrency is set to `deploy-main` with `cancel-in-progress: false` — a second push during a deploy queues, doesn't cancel.

## The app stack

- **`lareprep-api`** — Node 22 container. Serves the static frontend on `/`, the SSO/session API on `/api/auth/*`, and the progress sync API on `/api/progress`.
- **`lareprep-postgres`** — Postgres 18 container, dedicated to this stack. Migrations applied via the runner — never via `docker-entrypoint-initdb.d`.

Host Caddy (on the shared `portainer-proxy_proxy` network) reverse-proxies the public hostname to `lareprep-api:4001`.

## Migrations

Files live in `server/migrations/NNNN_name.sql` and are applied in filename order. Each runs in its own transaction. The runner tracks applied filenames in a `schema_migrations` table and is idempotent — `docker compose run --rm api node migrate.js` is safe to re-run anytime. For schema changes:

1. Add `server/migrations/0002_whatever.sql` (use the next free number).
2. Push to `main` — the deploy script runs the migrator before bringing the app back up.

## One-time VM setup

Only needed for the first deploy. After this, every push deploys itself.

```bash
# 1. Deploy user with no shell login (only SSH key-based)
sudo useradd --system --create-home --shell /bin/bash lareprep-deploy
# NOTE: do NOT add this user to the docker group — that's effectively root on
# the host (any container can mount /). Use the scoped sudoers entry below
# instead. Scoped sudo is narrower and auditable.

# 2. Restricted sudo for docker compose on this app only
sudo tee /etc/sudoers.d/lareprep-deploy >/dev/null <<'EOF'
lareprep-deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /opt/lareprep/docker-compose.yml *
lareprep-deploy ALL=(root) NOPASSWD: /usr/bin/docker image prune -f
EOF
sudo chmod 440 /etc/sudoers.d/lareprep-deploy
sudo visudo -c                            # validate syntax

# 3. Two SSH keys — one for GHA→VM (authorized_keys here), one for VM→GitHub
#    (added as a deploy key on the repo so the private clone works).

# 3a. GHA → VM key (private half goes into the DEPLOY_SSH_KEY repo secret)
sudo -u lareprep-deploy mkdir -p /home/lareprep-deploy/.ssh
sudo -u lareprep-deploy chmod 700 /home/lareprep-deploy/.ssh
sudo -u lareprep-deploy ssh-keygen -t ed25519 -N '' -C 'gha-lareprep' \
  -f /home/lareprep-deploy/.ssh/id_ed25519
sudo -u lareprep-deploy cp /home/lareprep-deploy/.ssh/id_ed25519.pub \
  /home/lareprep-deploy/.ssh/authorized_keys
sudo chmod 600 /home/lareprep-deploy/.ssh/authorized_keys

# 3b. VM → GitHub key (separate keypair; public half goes on the GitHub repo
#     as a deploy key — Settings → Deploy keys → Add deploy key, read-only)
sudo -u lareprep-deploy ssh-keygen -t ed25519 -N '' -C 'lareprep-vm-to-github' \
  -f /home/lareprep-deploy/.ssh/github_ed25519
sudo -u lareprep-deploy tee /home/lareprep-deploy/.ssh/config >/dev/null <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_ed25519
  IdentitiesOnly yes
EOF
sudo chmod 600 /home/lareprep-deploy/.ssh/config
# Print the public key — add it on github.com/ASLA1899/lareprep
# under Settings → Deploy keys → Add deploy key (read-only)
sudo cat /home/lareprep-deploy/.ssh/github_ed25519.pub

# 4. App directory + clone (via SSH, using the deploy key from step 3b)
sudo mkdir -p /opt/lareprep
sudo chown lareprep-deploy:lareprep-deploy /opt/lareprep
sudo -u lareprep-deploy git clone git@github.com:ASLA1899/lareprep.git /opt/lareprep

# 5. .env (Postgres password, JWT_SECRET, Impexium creds, APP_URL)
sudo -u lareprep-deploy cp /opt/lareprep/.env.example /opt/lareprep/.env
sudo -u lareprep-deploy $EDITOR /opt/lareprep/.env
sudo chmod 600 /opt/lareprep/.env
# Generate JWT_SECRET:   openssl rand -base64 36

# 6. First deploy (manual; subsequent ones are automatic from GHA)
sudo -u lareprep-deploy bash /opt/lareprep/deploy/deploy.sh

# 7. Wire up Caddy on the host — paste the snippet into the main Caddyfile
#    (this VM uses a single Caddyfile, no .d/ include directory).
sudo $EDITOR /opt/portainer-proxy/Caddyfile
# Paste the contents of deploy/Caddyfile.snippet as a new site block,
# then validate + reload:
sudo caddy validate --config /opt/portainer-proxy/Caddyfile
sudo systemctl reload caddy

# 8. In the Impexium admin, register the callback URL:
#    https://lareprep.aslalabs.org/api/auth/callback

# 9. Print the GHA→VM private key — paste it into the DEPLOY_SSH_KEY repo secret
sudo cat /home/lareprep-deploy/.ssh/id_ed25519
```

> **Don't edit files in `/opt/lareprep` by hand.** Every deploy runs
> `git reset --hard origin/main`, which will silently wipe any local edits.
> All changes go through the repo.

## GitHub repo secrets

Add under **Settings → Secrets and variables → Actions**:

| Name              | Value                                                            |
|-------------------|------------------------------------------------------------------|
| `DEPLOY_SSH_KEY`  | Private half of the deploy key generated in step 4 (full key incl. headers) |
| `DEPLOY_HOST`     | `20.185.219.8` (or your VM hostname)                             |
| `DEPLOY_PORT`     | `2222` (or whatever your VM's SSH port is)                       |
| `DEPLOY_USER`     | `lareprep-deploy`                                                |

## Manual operations

```bash
# Re-fire a deploy without a new commit:
# GitHub → Actions → Deploy → Run workflow → main → Run

# Manual deploy from the VM (skips GHA — useful for debugging):
sudo -u lareprep-deploy FORCE=1 bash /opt/lareprep/deploy/deploy.sh

# Manual migration run only:
cd /opt/lareprep && sudo docker compose run --rm api node migrate.js

# Tail logs:
sudo docker compose -f /opt/lareprep/docker-compose.yml logs -f api

# Wipe the database (will lose all member progress — be sure):
sudo docker compose -f /opt/lareprep/docker-compose.yml down -v
```

## Identity model

Every request outside the public allow-list (`/login`, `/api/auth/*`, `/assets/*`, `/css/*`, `/js/*`, `/fonts/*`, `/robots.txt`, `/healthz`) redirects to `/login` if there's no valid session cookie. The cookie carries a signed JWT — Impexium `customerId`, name, email, access level, an absolute 8h cap (`sessionStart`), and a 2h sliding inactivity window (`lastActivity`). `/api/progress` reads `customerId` directly from the validated JWT; no client-supplied identity is trusted.

Members with no active Impexium membership are blocked at the callback (`/login?error=no_membership`). The "paid for the product" entitlement gate is not yet enforced — when the entitlement source exists, add the check in `server/auth/impexium.js` `validateSsoCallback`.

## Local development

```bash
# Bring up a local stack with dev-login enabled
cat > .env <<EOF
POSTGRES_PASSWORD=local
APP_URL=http://localhost:4001
NODE_ENV=development
DEV_LOGIN_ENABLED=true
JWT_SECRET=$(openssl rand -base64 36)
# Impexium values can be placeholders for local dev unless you're testing SSO
IMPEXIUM_APP_NAME=local
IMPEXIUM_APP_KEY=local
IMPEXIUM_APP_ID=local
IMPEXIUM_APP_PASSWORD=local
IMPEXIUM_APP_USER_EMAIL=local
IMPEXIUM_APP_USER_PASSWORD=local
IMPEXIUM_CLIENT_URL=https://my.asla.org
EOF
docker compose up -d --build
docker compose run --rm api node migrate.js
# Visit http://localhost:4001/api/auth/dev-login → sets fake session → lands on /
```

`/api/auth/dev-login` is only registered when **both** `NODE_ENV != production` and `DEV_LOGIN_ENABLED=true`.

## Gotchas

- **Never** reference Postgres as `postgres` in `DATABASE_URL` from any container on `portainer-proxy_proxy`. That hostname is aliased to another stack's database. Use the explicit `container_name` (`lareprep-postgres`) — this stack already does.
- The API listens on `4001` inside the container and is **not** published to the host. Caddy reaches it over `portainer-proxy_proxy`.
- The static frontend is baked into the API image at `/app/public`. Updating frontend = rebuilding the image (the deploy script handles it).
- Postgres data lives in the `lareprep-pgdata` named volume. Backups TBD — `pg_dump` cron not yet wired.
