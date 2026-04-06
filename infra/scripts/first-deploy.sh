#!/usr/bin/env bash
# =============================================================================
# first-deploy.sh — Primeiro deploy manual no servidor
# Execute no servidor como usuário 'deploy': bash first-deploy.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

APP_DIR="/opt/inventech"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env"

# ── Validações ────────────────────────────────────────────────────────────────
[[ ! -f "$ENV_FILE" ]]     && error ".env não encontrado em $APP_DIR. Execute server-setup.sh primeiro."
[[ ! -f "$COMPOSE_FILE" ]] && error "docker-compose.prod.yml não encontrado em $APP_DIR."

# Verifica se ainda há placeholders no .env
if grep -q "TROQUE_POR" "$ENV_FILE"; then
  error "O arquivo $ENV_FILE ainda contém valores placeholder (TROQUE_POR_*).\nEdite-o antes de continuar."
fi

cd "$APP_DIR"

# ── Carrega variáveis para o script ───────────────────────────────────────────
set -a; source "$ENV_FILE"; set +a

# ─────────────────────────────────────────────────────────────────────────────
# Para a aplicação antiga antes de subir a nova
# ─────────────────────────────────────────────────────────────────────────────
info "Parando a aplicação atual..."

# Para processos Node/PM2 da API antiga (em /opt/intranet_hcr)
if command -v pm2 &>/dev/null; then
  warning "PM2 detectado — parando todos os processos..."
  pm2 stop all || true
  pm2 delete all || true
fi

# Para qualquer processo node rodando na porta 3000 ou similar
for port in 3000 3001 5000 8000 8080; do
  pid=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    warning "Matando processo na porta $port (PID: $pid)..."
    kill -TERM "$pid" 2>/dev/null || true
    sleep 2
  fi
done

# Remove o site estático antigo do Nginx (não apaga os arquivos, só desativa)
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  sudo rm -f /etc/nginx/sites-enabled/default
  info "Site default do Nginx desativado."
fi

# Desativa qualquer outro site que possa conflitar na porta 80/443
for site in /etc/nginx/sites-enabled/*; do
  name=$(basename "$site")
  if [[ "$name" != "inventech.conf" ]]; then
    warning "Desativando site Nginx conflitante: $name"
    sudo rm -f "$site"
  fi
done

info "Aplicação antiga parada. Os arquivos em /var/www/html e /opt/intranet_hcr"
info "foram preservados — apague manualmente quando confirmar que tudo funciona."
info ""

info "Iniciando primeiro deploy..."
info "Repositório: ${GITHUB_REPOSITORY_LOWER:-NÃO DEFINIDO}"

# ── Login no GHCR ─────────────────────────────────────────────────────────────
read -rp "Token do GitHub (com permissão read:packages): " GHCR_TOKEN
read -rp "Seu usuário GitHub: " GITHUB_USER

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin

# ── Sobe infraestrutura base primeiro ─────────────────────────────────────────
info "Subindo PostgreSQL, Redis e MinIO..."
IMAGE_TAG=latest GITHUB_REPOSITORY_LOWER="${GITHUB_USER}/inventechmonorepo" \
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  up -d postgres redis minio

info "Aguardando serviços ficarem saudáveis (pode levar ~30s)..."
sleep 15

# Verifica saúde dos serviços base
for service in inventech_postgres inventech_redis inventech_minio; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "not found")
  if [[ "$status" != "healthy" ]]; then
    warning "Serviço $service não está healthy (status: $status). Continuando mesmo assim..."
  else
    info "$service: healthy ✓"
  fi
done

# ── Baixa e sobe API e Web ────────────────────────────────────────────────────
info "Baixando imagens da API e Web..."
IMAGE_TAG=latest GITHUB_REPOSITORY_LOWER="${GITHUB_USER}/inventechmonorepo" \
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  pull api web

info "Rodando migrations do banco de dados..."
IMAGE_TAG=latest GITHUB_REPOSITORY_LOWER="${GITHUB_USER}/inventechmonorepo" \
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  run --rm api sh -c "cd apps/api && npx prisma migrate deploy"

info "Subindo todos os serviços..."
IMAGE_TAG=latest GITHUB_REPOSITORY_LOWER="${GITHUB_USER}/inventechmonorepo" \
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  up -d --remove-orphans

# ── Configura Nginx ───────────────────────────────────────────────────────────
info "Configurando Nginx..."

NGINX_CONF="/etc/nginx/sites-available/inventech.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/inventech.conf"

if [[ -f "$APP_DIR/infra/nginx/inventech.conf" ]]; then
  sudo cp "$APP_DIR/infra/nginx/inventech.conf" "$NGINX_CONF"
  sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

  # Remove o site default se existir
  sudo rm -f /etc/nginx/sites-enabled/default

  sudo nginx -t && sudo systemctl reload nginx
  info "Nginx configurado e recarregado."
else
  warning "Arquivo infra/nginx/inventech.conf não encontrado em $APP_DIR."
  warning "Configure o Nginx manualmente."
fi

# ── Status final ──────────────────────────────────────────────────────────────
info ""
info "╔══════════════════════════════════════════════════════╗"
info "║           Primeiro deploy concluído!                 ║"
info "╚══════════════════════════════════════════════════════╝"
info ""
info "Status dos containers:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

info ""
info "Verifique a API:"
info "  curl -s http://localhost:3000/api/v1/health/ping"
info ""
info "Verifique o frontend:"
info "  curl -s http://localhost:3001"
info ""
info "Acesse pelo domínio: https://intranet.hcrmarau.com.br"
