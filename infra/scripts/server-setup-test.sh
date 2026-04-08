#!/usr/bin/env bash
# =============================================================================
# server-setup-test.sh — Configuração inicial da VM de teste (sem domínio/SSL)
# Execute como root: bash server-setup-test.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Execute este script como root: sudo bash server-setup-test.sh"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Atualiza o sistema
# ─────────────────────────────────────────────────────────────────────────────
info "Atualizando pacotes do sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ─────────────────────────────────────────────────────────────────────────────
# 2. Instala dependências básicas (sem certbot)
# ─────────────────────────────────────────────────────────────────────────────
info "Instalando dependências básicas..."
apt-get install -y -qq \
  curl wget git unzip \
  ca-certificates gnupg lsb-release \
  ufw fail2ban \
  nginx \
  openssl

# ─────────────────────────────────────────────────────────────────────────────
# 3. Instala Docker
# ─────────────────────────────────────────────────────────────────────────────
info "Instalando Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

info "Docker $(docker --version) instalado com sucesso."

# ─────────────────────────────────────────────────────────────────────────────
# 4. Cria usuário 'deploy'
# ─────────────────────────────────────────────────────────────────────────────
DEPLOY_USER="deploy"

if id "$DEPLOY_USER" &>/dev/null; then
  warning "Usuário '$DEPLOY_USER' já existe, pulando criação."
else
  info "Criando usuário '$DEPLOY_USER'..."
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi

usermod -aG docker "$DEPLOY_USER"

DEPLOY_HOME="/home/$DEPLOY_USER"
mkdir -p "$DEPLOY_HOME/.ssh"
chmod 700 "$DEPLOY_HOME/.ssh"

info ""
info "Cole a chave pública SSH do GitHub Actions para acesso ao usuário 'deploy':"
info "(gere com: ssh-keygen -t ed25519 -C 'github-actions-deploy-test' -f ~/.ssh/inventech_deploy_test)"
info ""
read -rp "Cole a chave pública (ed25519) aqui e pressione ENTER: " PUBKEY

if [[ -z "$PUBKEY" ]]; then
  warning "Nenhuma chave informada. Adicione manualmente em: $DEPLOY_HOME/.ssh/authorized_keys"
else
  echo "$PUBKEY" >> "$DEPLOY_HOME/.ssh/authorized_keys"
  chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
  info "Chave pública adicionada com sucesso."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Configura diretório da aplicação
# ─────────────────────────────────────────────────────────────────────────────
APP_DIR="/opt/inventech"
info "Criando diretório da aplicação em $APP_DIR..."
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Configura Firewall (UFW) — apenas HTTP (sem HTTPS)
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw --force enable

info "Regras do firewall:"
ufw status numbered

# ─────────────────────────────────────────────────────────────────────────────
# 7. Configura Fail2Ban
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando Fail2Ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = systemd
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# ─────────────────────────────────────────────────────────────────────────────
# 8. Detecta IP interno
# ─────────────────────────────────────────────────────────────────────────────
VM_IP=$(hostname -I | awk '{print $1}')
info "IP interno detectado: $VM_IP"

# ─────────────────────────────────────────────────────────────────────────────
# 9. Cria template .env de teste
# ─────────────────────────────────────────────────────────────────────────────
info "Criando template .env de teste em $APP_DIR/.env..."
cat > "$APP_DIR/.env" << EOF
# ─────────────────────────────────────────────────────────────────
# AMBIENTE DE TESTE — VM INTERNA (sem domínio, sem SSL)
# Preencha os valores antes do primeiro deploy
# ─────────────────────────────────────────────────────────────────

NODE_ENV=production
APP_PORT=3000

# PostgreSQL
POSTGRES_USER=manutencao_user
POSTGRES_PASSWORD=TROQUE_POR_SENHA_FORTE
POSTGRES_DB=manutencao_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://manutencao_user:TROQUE_POR_SENHA_FORTE@postgres:5432/manutencao_db?schema=public

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=TROQUE_POR_SENHA_FORTE
REDIS_DB=0

# MinIO
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=TROQUE_POR_SENHA_FORTE
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ENDPOINT=minio
MINIO_USE_SSL=false

# Buckets MinIO
MINIO_BUCKET_EQUIPMENT=equipment-attachments
MINIO_BUCKET_SERVICE_ORDERS=service-order-attachments
MINIO_BUCKET_INVOICES=invoices
MINIO_BUCKET_AVATARS=avatars
MINIO_BUCKET_REPORTS=reports

# JWT — gere com: openssl rand -hex 32
JWT_ACCESS_SECRET=TROQUE_POR_SECRET_FORTE_HEX_32
JWT_REFRESH_SECRET=TROQUE_POR_OUTRO_SECRET_FORTE_HEX_32
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS — IP interno da VM de teste
ALLOWED_ORIGINS=http://${VM_IP}

# Email (pode deixar em branco para testes)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM_NAME=Sistema de Manutenção - TESTE
MAIL_FROM_ADDRESS=
MAIL_IGNORE_TLS=true

# Telegram (opcional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_NAME=ManutencaoBot
TELEGRAM_USE_WEBHOOK=false
TELEGRAM_WEBHOOK_URL=
EOF

chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

warning "IMPORTANTE: Edite $APP_DIR/.env e substitua todos os valores 'TROQUE_POR_*' antes do deploy!"

# ─────────────────────────────────────────────────────────────────────────────
# Resumo final
# ─────────────────────────────────────────────────────────────────────────────
info ""
info "╔══════════════════════════════════════════════════════════════╗"
info "║          Setup de teste concluído com sucesso!              ║"
info "╚══════════════════════════════════════════════════════════════╝"
info ""
info "IP desta VM: $VM_IP"
info ""
info "Próximos passos:"
info "  1. Edite $APP_DIR/.env com as credenciais reais"
info "  2. Adicione ao GitHub (Settings → Secrets → Actions):"
info "     SSH_HOST_TEST        = $VM_IP"
info "     SSH_USER_TEST        = deploy"
info "     SSH_PRIVATE_KEY_TEST = conteúdo de ~/.ssh/inventech_deploy_test"
info "     NEXT_PUBLIC_API_URL_TEST = http://$VM_IP/api/v1"
info "     NEXT_PUBLIC_WS_URL_TEST  = http://$VM_IP"
info "  3. Faça push para a branch 'develop' para disparar o deploy de teste"
info "     OU acione manualmente em Actions → Deploy Test VM → Run workflow"
info ""
