# syntax=docker/dockerfile:1.7

# ---- deps stage: install production node_modules ---------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4001 \
    STATIC_ROOT=/app/public

# Non-root user (node:alpine includes a "node" UID 1000 — use that)
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node server/index.js server/migrate.js server/schema.sql server/package.json ./
COPY --chown=node:node server/auth ./auth
COPY --chown=node:node index.html ./public/index.html
COPY --chown=node:node login.html ./public/login.html
COPY --chown=node:node robots.txt ./public/robots.txt
COPY --chown=node:node css ./public/css
COPY --chown=node:node js ./public/js
COPY --chown=node:node fonts ./public/fonts
COPY --chown=node:node assets ./public/assets

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
