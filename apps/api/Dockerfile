# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — instala deps e compila TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia arquivos de workspace e manifests de dependências
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY apps/api/package.json ./apps/api/

# Instala todas as dependências (incluindo devDependencies para o build)
RUN npm ci --workspace=apps/api --include-workspace-root

# Copia o código-fonte
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Builda shared-types antes da API (dist é excluído pelo .dockerignore)
RUN cd packages/shared-types && npx tsc -p tsconfig.build.json

# Gera o cliente Prisma e compila TypeScript
RUN cd apps/api && npx prisma generate
RUN npm run -w api build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — apenas artefatos necessários para rodar
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Instala dumb-init para tratamento correto de sinais do processo
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Copia apenas os manifests para instalar dependências de produção
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY apps/api/package.json ./apps/api/

# Instala apenas dependências de produção
RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev

# Copia o build compilado, schema Prisma e config do Prisma v7
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Copia o dist do shared-types (compilado no builder, necessário em runtime)
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/v1/health/ping', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# dumb-init garante que SIGTERM chegue corretamente ao processo Node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/src/main"]
