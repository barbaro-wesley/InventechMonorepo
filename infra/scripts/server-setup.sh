#!/usr/bin/env bash
# =============================================================================
# server-setup.sh — Configuração inicial do servidor de produção
# Execute como root: bash server-setup.sh
# =============================================================================
set -euo pipefail

# ─── Cores para output ────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Execute este script como root: sudo bash server-setup.sh"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Atualiza o sistema
# ─────────────────────────────────────────────────────────────────────────────
info "Atualizando pacotes do sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ─────────────────────────────────────────────────────────────────────────────
# 2. Instala dependências básicas
# ─────────────────────────────────────────────────────────────────────────────
info "Instalando dependências básicas..."
apt-get install -y -qq \
  curl wget git unzip \
  ca-certificates gnupg lsb-release \
  ufw fail2ban \
  nginx \
  openssl \
  certbot python3-certbot-nginx

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

# Adiciona ao grupo docker (permite rodar docker sem sudo)
usermod -aG docker "$DEPLOY_USER"

# Diretório SSH para o usuário deploy
DEPLOY_HOME="/home/$DEPLOY_USER"
mkdir -p "$DEPLOY_HOME/.ssh"
chmod 700 "$DEPLOY_HOME/.ssh"

info ""
info "╔══════════════════════════════════════════════════════════════╗"
info "║  PRÓXIMO PASSO: adicione a chave pública do GitHub Actions  ║"
info "╚══════════════════════════════════════════════════════════════╝"
info ""
info "Na sua máquina local, gere um par de chaves dedicado para deploy:"
info ""
info "  ssh-keygen -t ed25519 -C 'github-actions-deploy' -f ~/.ssh/inventech_deploy"
info ""
info "Depois cole a chave PÚBLICA aqui:"
info "  cat ~/.ssh/inventech_deploy.pub"
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
# 6. Endurece o SSH
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando SSH mais seguro..."
SSHD_CONFIG="/etc/ssh/sshd_config"

# Backup do config original
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%Y%m%d)"

# Aplica configurações de segurança
cat >> "$SSHD_CONFIG" << 'EOF'

# ── Inventech: configurações de segurança ──────────────────────
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
warning "Login root via SSH desabilitado. Use o usuário 'deploy' daqui em diante."

# ─────────────────────────────────────────────────────────────────────────────
# 7. Configura Firewall (UFW)
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'

# Acesso da rede interna ao banco e MinIO
ufw allow from 192.168.0.0/24 to any port 5432 comment 'PostgreSQL - rede interna'
ufw allow from 192.168.0.0/24 to any port 9000 comment 'MinIO API - rede interna'
ufw allow from 192.168.0.0/24 to any port 9001 comment 'MinIO Console - rede interna'

ufw --force enable

info "Regras do firewall:"
ufw status numbered

# ─────────────────────────────────────────────────────────────────────────────
# 8. Configura Fail2Ban (proteção contra brute force)
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
# 9. Cria arquivo .env de produção (template)
# ─────────────────────────────────────────────────────────────────────────────
info "Criando template .env de produção em $APP_DIR/.env..."
cat > "$APP_DIR/.env" << 'EOF'
# ─────────────────────────────────────────────────────────────────
# PREENCHA TODOS OS VALORES ANTES DE FAZER O PRIMEIRO DEPLOY
# ─────────────────────────────────────────────────────────────────

NODE_ENV=production
APP_PORT=3000

# PostgreSQL — gere senha com: openssl rand -base64 32
POSTGRES_USER=manutencao_user
POSTGRES_PASSWORD=TROQUE_POR_SENHA_FORTE
POSTGRES_DB=manutencao_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://manutencao_user:TROQUE_POR_SENHA_FORTE@postgres:5432/manutencao_db?schema=public

# Redis — gere senha com: openssl rand -base64 32
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=TROQUE_POR_SENHA_FORTE
REDIS_DB=0

# MinIO — gere senha com: openssl rand -base64 32
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

# CORS — domínio do frontend em produção
ALLOWED_ORIGINS=https://intranet.hcrmarau.com.br

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=seu_email@gmail.com
MAIL_PASSWORD=sua_app_password_gmail
MAIL_FROM_NAME=Sistema de Manutenção HCR
MAIL_FROM_ADDRESS=seu_email@gmail.com
MAIL_IGNORE_TLS=false

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
# 9b. Let's Encrypt — emite ou renova o certificado
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando Let's Encrypt para intranet.hcrmarau.com.br..."

DOMAIN="intranet.hcrmarau.com.br"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

if [[ -d "$CERT_PATH" ]]; then
  warning "Certificado já existe em $CERT_PATH. Pulando emissão."
else
  # Nginx precisa estar rodando para o desafio HTTP-01
  systemctl start nginx || true

  info "Emitindo certificado Let's Encrypt..."
  certbot certonly \
    --nginx \
    --non-interactive \
    --agree-tos \
    --email "ti@hcrmarau.com.br" \
    -d "$DOMAIN" || {
      warning "Certbot falhou. Verifique se o domínio aponta para este servidor e a porta 80 está acessível."
      warning "Depois rode manualmente: certbot --nginx -d $DOMAIN"
    }
fi

# Garante renovação automática via systemd timer (já instalado com o pacote certbot)
systemctl enable certbot.timer
systemctl start certbot.timer

# Hook pós-renovação: recarrega o Nginx quando o cert for renovado
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

info "Renovação automática configurada (certbot.timer)."
info "Teste a renovação com: certbot renew --dry-run"

# ─────────────────────────────────────────────────────────────────────────────
# Resumo final
# ─────────────────────────────────────────────────────────────────────────────
info ""
info "╔══════════════════════════════════════════════════════════════╗"
info "║              Setup concluído com sucesso!                   ║"
info "╚══════════════════════════════════════════════════════════════╝"
info ""
info "Próximos passos:"
info "  1. Edite $APP_DIR/.env com as credenciais reais"
info "  2. Adicione a chave privada ao GitHub: Settings → Secrets"
info "     SSH_PRIVATE_KEY  = conteúdo de ~/.ssh/inventech_deploy"
info "     SSH_HOST         = IP ou hostname do servidor"
info "     SSH_USER         = deploy"
info "  3. Configure o Nginx: copie infra/nginx/inventech.conf para /etc/nginx/sites-available/"
info "  4. Faça o primeiro push para a branch main para disparar o deploy"
info ""
