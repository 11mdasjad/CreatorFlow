FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY . .
ARG APP_URL=https://creatorflow.example.com
ARG API_INTERNAL_URL=http://api:4000
ENV APP_URL=$APP_URL API_INTERNAL_URL=$API_INTERNAL_URL NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build
FROM build AS migration
CMD ["npm", "run", "db:migrate"]
FROM build AS runtime
RUN npm prune --omit=dev --no-audit --no-fund && chown -R node:node /app
ENV NODE_ENV=production API_HOST=0.0.0.0
USER node
EXPOSE 3000 4000
CMD ["node", "apps/api/dist/main.js"]
