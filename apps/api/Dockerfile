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

# Gera o cliente Prisma
RUN npm run -w api build -- --project apps/api/tsconfig.build.json || \
    cd apps/api && npx prisma generate && npm run build

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

# Copia o build compilado e o schema Prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist 2>/dev/null || true

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
CMD ["node", "apps/api/dist/main"]
