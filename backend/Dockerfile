# Photo Arena API — Node 24 + Prisma + NestJS
FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma/
# Full install so `prisma` CLI remains available for migrate deploy.
RUN npm ci && npx prisma generate

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/uploads \
  && chown -R node:node /app/uploads

USER node

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
