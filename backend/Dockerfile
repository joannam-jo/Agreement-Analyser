# API server: document reading, OCR, risk analysis.
# Build from the repository root:  docker build -f backend/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=@faa/shared --workspace=@faa/backend
COPY shared shared
COPY backend backend
RUN npm run build --workspace=@faa/shared && npm run build --workspace=@faa/backend \
 && npm prune --omit=dev --workspace=@faa/shared --workspace=@faa/backend

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared/package.json shared/package.json
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
# Encrypted agreements, files and cached OCR language data live on a volume owned by the app user.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/index.js"]
