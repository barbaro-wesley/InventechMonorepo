#!/usr/bin/env bash
# =============================================================================
# server-setup-test.sh — Configuração inicial da VM de teste (sem domínio/SSL)
# Execute como root: bash server-setup-test.sh
# =============================================================================
set -euo pipefail

# Evita qualquer prompt interativo do apt/dpkg
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

LOG_FILE="/var/log/inventech-setup.log"
exec > >(tee -a "$LOG_FILE") 2>&1

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
step()    { echo -e "${CYAN}[STEP]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ $EUID -ne 0 ]] && error "Execute este script como root: sudo bash server-setup-test.sh"

info "Log completo em: $LOG_FILE"
info "Para acompanhar em outro terminal: tail -f $LOG_FILE"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Atualiza o sistema
# ─────────────────────────────────────────────────────────────────────────────
step "[1/9] Atualizando lista de pacotes..."
apt-get update -y --fix-missing || { warning "apt-get update teve erros menores, continuando..."; true; }
# Upgrade completo é opcional — ignora falhas de download (conexão instável)
apt-get upgrade -y --fix-missing \
  -o Dpkg::Options::="--force-confdef" \
  -o Dpkg::Options::="--force-confold" \
  -o Acquire::Retries=3 \
  -o Acquire::http::Timeout=30 \
  || warning "Upgrade parcial (alguns pacotes não baixaram) — não afeta o setup, continuando."
info "Lista de pacotes atualizada."

# ─────────────────────────────────────────────────────────────────────────────
# 2. Instala dependências básicas
# ─────────────────────────────────────────────────────────────────────────────
step "[2/9] Instalando dependências básicas..."
apt-get install -y --fix-missing \
  -o Dpkg::Options::="--force-confdef" \
  -o Dpkg::Options::="--force-confold" \
  -o Acquire::Retries=3 \
  -o Acquire::http::Timeout=30 \
  curl wget git unzip \
  ca-certificates gnupg lsb-release \
  ufw fail2ban \
  nginx \
  openssl \
  vsftpd
info "Dependências instaladas."

# ─────────────────────────────────────────────────────────────────────────────
# 3. Instala Docker
# ─────────────────────────────────────────────────────────────────────────────
step "[3/9] Instalando Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y --fix-missing
apt-get install -y --fix-missing \
  -o Dpkg::Options::="--force-confdef" \
  -o Dpkg::Options::="--force-confold" \
  -o Acquire::Retries=3 \
  -o Acquire::http::Timeout=30 \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
info "Docker $(docker --version) instalado."

# ─────────────────────────────────────────────────────────────────────────────
# 4. Cria usuário 'deploy'
# ─────────────────────────────────────────────────────────────────────────────
step "[4/9] Criando usuário deploy..."
DEPLOY_USER="deploy"
DEPLOY_HOME="/home/$DEPLOY_USER"

if id "$DEPLOY_USER" &>/dev/null; then
  warning "Usuário '$DEPLOY_USER' já existe, pulando criação."
else
  useradd -m -s /bin/bash "$DEPLOY_USER"
  info "Usuário '$DEPLOY_USER' criado."
fi

usermod -aG docker "$DEPLOY_USER"

echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/systemctl reload nginx, /usr/bin/systemctl restart nginx, /bin/cp, /bin/mkdir, /bin/ln, /bin/rm" \
  > /etc/sudoers.d/deploy-nginx
chmod 440 /etc/sudoers.d/deploy-nginx

mkdir -p "$DEPLOY_HOME/.ssh"
chmod 700 "$DEPLOY_HOME/.ssh"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
info "Usuário deploy configurado."

# ─────────────────────────────────────────────────────────────────────────────
# 5. Configura diretório da aplicação
# ─────────────────────────────────────────────────────────────────────────────
step "[5/9] Criando diretório da aplicação..."
APP_DIR="/opt/inventech"
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
info "Diretório $APP_DIR criado."

# ─────────────────────────────────────────────────────────────────────────────
# 6. Configura Firewall (UFW)
# ─────────────────────────────────────────────────────────────────────────────
step "[6/9] Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH + SFTP'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 21/tcp    comment 'FTP (Samsung)'
ufw allow 40000:40100/tcp comment 'FTP passivo (Samsung)'
ufw --force enable
info "Firewall configurado."

# ─────────────────────────────────────────────────────────────────────────────
# 7. Configura Fail2Ban
# ─────────────────────────────────────────────────────────────────────────────
step "[7/9] Configurando Fail2Ban..."
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
info "Fail2Ban configurado."

# ─────────────────────────────────────────────────────────────────────────────
# 8. Usuário e diretórios SFTP para impressoras
# ─────────────────────────────────────────────────────────────────────────────
step "[8/9] Configurando SFTP para impressoras..."

SCANNER_USER="scanner"
SFTP_ROOT="/srv/scans"
SFTP_INCOMING="$SFTP_ROOT/incoming"

if id "$SCANNER_USER" &>/dev/null; then
  warning "Usuário '$SCANNER_USER' já existe, pulando criação."
else
  useradd -m -s /sbin/nologin "$SCANNER_USER"
fi

mkdir -p "$SFTP_INCOMING"
chown root:root "$SFTP_ROOT"
chmod 755 "$SFTP_ROOT"
chown "$SCANNER_USER:$SCANNER_USER" "$SFTP_INCOMING"
chmod 755 "$SFTP_INCOMING"

# Senha padrão — TROQUE após o setup
SCANNER_PASS="Scanner@$(openssl rand -hex 4)"
echo "$SCANNER_USER:$SCANNER_PASS" | chpasswd
info "Senha temporária do scanner gerada (veja resumo final)."

# Configura chroot SFTP no sshd_config
SSHD_CONF="/etc/ssh/sshd_config"
if grep -q "Match User $SCANNER_USER" "$SSHD_CONF"; then
  warning "Bloco SFTP chroot já existe no sshd_config, pulando."
else
  cat >> "$SSHD_CONF" << EOF

# ── SFTP chroot para impressoras ──────────────────────────────────
Match User $SCANNER_USER
    ChrootDirectory $SFTP_ROOT
    ForceCommand internal-sftp
    AllowTcpForwarding no
    X11Forwarding no
EOF
fi

systemctl restart ssh

# vsftpd (Samsung FTP)
VM_IP=$(hostname -I | awk '{print $1}')

cat > /etc/vsftpd.conf << EOF
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
use_localtime=YES
xferlog_enable=YES
connect_from_port_20=YES
chroot_local_user=YES
allow_writeable_chroot=YES
secure_chroot_dir=/var/run/vsftpd/empty
pam_service_name=vsftpd
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
pasv_address=$VM_IP
userlist_enable=YES
userlist_file=/etc/vsftpd.userlist
userlist_deny=NO
EOF

echo "$SCANNER_USER" > /etc/vsftpd.userlist
usermod -d "$SFTP_ROOT" "$SCANNER_USER"
chown root:root "$SFTP_ROOT"

systemctl enable vsftpd
systemctl restart vsftpd
info "SFTP + vsftpd configurados."

# ─────────────────────────────────────────────────────────────────────────────
# 9. Cria template .env
# ─────────────────────────────────────────────────────────────────────────────
step "[9/9] Criando template .env..."
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

# CORS — IP interno da VM
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

# ── Impressoras & Scans ─────────────────────────────────────────
SFTP_SCAN_BASE_DIR=/srv/scans/incoming
SFTP_HOST=${VM_IP}
EOF

chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
info "Template .env criado em $APP_DIR/.env"

# ─────────────────────────────────────────────────────────────────────────────
# Resumo final
# ─────────────────────────────────────────────────────────────────────────────
echo ""
info "╔══════════════════════════════════════════════════════════════╗"
info "║          Setup de teste concluído com sucesso!              ║"
info "╚══════════════════════════════════════════════════════════════╝"
echo ""
info "IP desta VM     : $VM_IP"
info "Log do setup    : $LOG_FILE"
echo ""
warning "══ CREDENCIAIS GERADAS — ANOTE AGORA ══════════════════════════"
warning "Senha do usuário scanner (impressoras): $SCANNER_PASS"
warning "  → Troque depois: passwd scanner"
warning "═══════════════════════════════════════════════════════════════"
echo ""
info "Próximos passos:"
info "  1. Instalar o runner manualmente (como usuário deploy):"
info "     Baixe em: https://github.com/barbaro-wesley/InventechMonorepo/settings/actions/runners/new"
info "     su - deploy"
info "     mkdir -p ~/actions-runner && cd ~/actions-runner"
info "     # Extraia o pacote baixado e execute:"
info "     ./config.sh --url https://github.com/barbaro-wesley/InventechMonorepo \\"
info "                 --token SEU_TOKEN \\"
info "                 --name inventech-test-vm \\"
info "                 --labels self-hosted,linux \\"
info "                 --unattended"
info "     exit"
info "     cd /home/deploy/actions-runner && ./svc.sh install deploy && ./svc.sh start"
echo ""
info "  2. Editar $APP_DIR/.env (substituir TROQUE_POR_*)"
info "     nano $APP_DIR/.env"
echo ""
info "  3. Adicionar ao GitHub Secrets:"
info "     GHCR_TOKEN               = token com read:packages"
info "     NEXT_PUBLIC_API_URL_TEST = http://$VM_IP/api/v1"
info "     NEXT_PUBLIC_WS_URL_TEST  = http://$VM_IP"
echo ""
info "  4. Push para develop → deploy automático"
