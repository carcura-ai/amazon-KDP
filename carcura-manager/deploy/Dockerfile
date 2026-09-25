# Zentrales Carcura-Backend (API + Oberfläche) als Container.
# Build aus dem Ordner carcura-manager:  docker build -f deploy/Dockerfile -t carcura-server .
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY server server
COPY web web
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=4800 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    TRUST_PROXY=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/drizzle server/drizzle
COPY --from=build /app/web/dist web/dist
# Chromium für PDF-Erzeugung (Rechnungen, Angebote, Protokolle, Berichte)
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data && chown -R node:node /data /ms-playwright
USER node
VOLUME ["/data"]
EXPOSE 4800
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4800/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/dist/index.js"]
