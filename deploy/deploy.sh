#!/usr/bin/env bash
# Runs on the VM as the lareprep-deploy user. Invoked from
# .github/workflows/deploy.yml over SSH.
#
# Assumes:
#   * /opt/lareprep is a git clone owned by the deploy user
#   * /opt/lareprep/.env exists with all required values
#   * /etc/sudoers.d/lareprep-deploy grants NOPASSWD docker compose on this path

set -euo pipefail

APP=/opt/lareprep
cd "$APP"

echo "==> [$(date -Iseconds)] updating source"
git fetch --quiet origin main
NEW=$(git rev-parse origin/main)
OLD=$(git rev-parse HEAD)
if [ "$NEW" = "$OLD" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "already at $NEW — nothing to do (set FORCE=1 to rebuild anyway)"
  exit 0
fi
git reset --hard "$NEW"
echo "    $OLD → $NEW"

echo "==> building image"
sudo docker compose build api

echo "==> ensuring postgres is up"
sudo docker compose up -d postgres

echo "==> running migrations"
sudo docker compose run --rm api node migrate.js

echo "==> bringing up app"
sudo docker compose up -d

echo "==> pruning dangling images"
sudo docker image prune -f

echo "==> done"
sudo docker compose ps
