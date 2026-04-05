FROM node:24.14.1-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma/
RUN pnpm prisma generate

COPY . .
RUN pnpm build

FROM builder AS pruner
RUN pnpm prune --prod

FROM node:24.14.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=pruner /app/node_modules ./node_modules
COPY --from=pruner /app/dist ./dist
COPY --from=pruner /app/generated ./dist/generated
COPY --from=pruner /app/package.json ./

COPY scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"] 
CMD ["node", "dist/src/main.js"]