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
  openssl \
  vsftpd

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
# deploy precisa recarregar nginx no pipeline
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/systemctl reload nginx, /usr/bin/systemctl restart nginx, /bin/cp, /bin/mkdir, /bin/ln, /bin/rm" \
  > /etc/sudoers.d/deploy-nginx
chmod 440 /etc/sudoers.d/deploy-nginx

DEPLOY_HOME="/home/$DEPLOY_USER"
mkdir -p "$DEPLOY_HOME/.ssh"
chmod 700 "$DEPLOY_HOME/.ssh"

info ""
info "Cole a chave pública SSH para acesso ao usuário 'deploy' (opcional — runner não precisa de SSH externo):"
info "(gere com: ssh-keygen -t ed25519 -C 'github-actions-deploy-test' -f ~/.ssh/inventech_deploy_test)"
info ""
read -rp "Cole a chave pública (ed25519) aqui e pressione ENTER (deixe vazio para pular): " PUBKEY

if [[ -n "$PUBKEY" ]]; then
  echo "$PUBKEY" >> "$DEPLOY_HOME/.ssh/authorized_keys"
  chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
  info "Chave pública adicionada."
else
  warning "Nenhuma chave informada. Adicione manualmente em: $DEPLOY_HOME/.ssh/authorized_keys se precisar de acesso SSH direto."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Configura diretório da aplicação
# ─────────────────────────────────────────────────────────────────────────────
APP_DIR="/opt/inventech"
info "Criando diretório da aplicação em $APP_DIR..."
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Configura Firewall (UFW) — HTTP + SFTP
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH + SFTP'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 21/tcp    comment 'FTP (Samsung)'
ufw allow 40000:40100/tcp comment 'FTP passivo (Samsung)'
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
# 8. Usuário e diretórios SFTP para impressoras (Brother SFTP / Samsung FTP)
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando usuário SFTP para impressoras..."

SCANNER_USER="scanner"
SFTP_ROOT="/srv/scans"
SFTP_INCOMING="$SFTP_ROOT/incoming"

if id "$SCANNER_USER" &>/dev/null; then
  warning "Usuário '$SCANNER_USER' já existe, pulando criação."
else
  useradd -m -s /sbin/nologin "$SCANNER_USER"
fi

# O chroot exige que /srv/scans pertença ao root
mkdir -p "$SFTP_INCOMING"
chown root:root "$SFTP_ROOT"
chmod 755 "$SFTP_ROOT"
chown "$SCANNER_USER:$SCANNER_USER" "$SFTP_INCOMING"
chmod 755 "$SFTP_INCOMING"

info ""
read -rsp "Digite a senha para o usuário '$SCANNER_USER' (usada nas impressoras): " SCANNER_PASS
echo ""
echo "$SCANNER_USER:$SCANNER_PASS" | chpasswd
info "Senha do usuário scanner definida."

# Configura chroot SFTP no sshd_config
SSHD_CONF="/etc/ssh/sshd_config"
if grep -q "Match User $SCANNER_USER" "$SSHD_CONF"; then
  warning "Bloco 'Match User $SCANNER_USER' já existe no sshd_config, pulando."
else
  cat >> "$SSHD_CONF" << EOF

# ── SFTP chroot para impressoras ──────────────────────────────────
Match User $SCANNER_USER
    ChrootDirectory $SFTP_ROOT
    ForceCommand internal-sftp
    AllowTcpForwarding no
    X11Forwarding no
EOF
  info "Bloco SFTP chroot adicionado ao sshd_config."
fi

systemctl restart sshd
info "SSH reiniciado com configuração SFTP."

# ─────────────────────────────────────────────────────────────────────────────
# 9. Configura vsftpd (FTP passivo para Samsung M4070)
# ─────────────────────────────────────────────────────────────────────────────
info "Configurando vsftpd (FTP para Samsung)..."

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
# Modo passivo
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
pasv_address=$VM_IP
# Restringe ao usuário scanner
userlist_enable=YES
userlist_file=/etc/vsftpd.userlist
userlist_deny=NO
EOF

echo "$SCANNER_USER" > /etc/vsftpd.userlist

# O vsftpd usa o home do usuário como raiz do chroot
# Redireciona o home do scanner para /srv/scans
usermod -d "$SFTP_ROOT" "$SCANNER_USER"
chown root:root "$SFTP_ROOT"

systemctl enable vsftpd
systemctl restart vsftpd
info "vsftpd configurado."

# ─────────────────────────────────────────────────────────────────────────────
# 10. GitHub Actions — Self-hosted runner
# ─────────────────────────────────────────────────────────────────────────────
info ""
info "═══════════════════════════════════════════════════════════════"
info " GitHub Actions — Self-hosted Runner"
info " O runner roda como usuário 'deploy' e se conecta ao GitHub"
info " de saída — não precisa de porta aberta nem IP público."
info "═══════════════════════════════════════════════════════════════"
info ""

RUNNER_DIR="$DEPLOY_HOME/actions-runner"
mkdir -p "$RUNNER_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$RUNNER_DIR"

info "Baixando runner do GitHub Actions (versão mais recente)..."
RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest \
  | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
RUNNER_FILE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

curl -fsSL \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_FILE}" \
  -o "/tmp/${RUNNER_FILE}"

tar -xzf "/tmp/${RUNNER_FILE}" -C "$RUNNER_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$RUNNER_DIR"
rm "/tmp/${RUNNER_FILE}"

info "Runner baixado em: $RUNNER_DIR"
info ""
warning "PRÓXIMO PASSO MANUAL — Configure o runner:"
warning ""
warning "  1. Acesse: https://github.com/barbaro-wesley/InventechMonorepo/settings/actions/runners/new"
warning "  2. Selecione: Linux x64"
warning "  3. Copie o token de registro exibido (começa com AART...)"
warning "  4. Execute como usuário 'deploy':"
warning ""
warning "     su - deploy"
warning "     cd ~/actions-runner"
warning "     ./config.sh --url https://github.com/barbaro-wesley/InventechMonorepo \\"
warning "                 --token SEU_TOKEN_AQUI \\"
warning "                 --name inventech-test-vm \\"
warning "                 --labels self-hosted,linux \\"
warning "                 --unattended"
warning ""
warning "  5. Instale como serviço systemd (ainda como root):"
warning "     cd $RUNNER_DIR && sudo ./svc.sh install deploy && sudo ./svc.sh start"
warning ""

# ─────────────────────────────────────────────────────────────────────────────
# 11. Detecta IP interno
# ─────────────────────────────────────────────────────────────────────────────
info "IP interno detectado: $VM_IP"

# ─────────────────────────────────────────────────────────────────────────────
# 12. Cria template .env de teste
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

# ── Impressoras & Scans ─────────────────────────────────────────
SFTP_SCAN_BASE_DIR=/srv/scans/incoming
SFTP_HOST=${VM_IP}
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
info "  1. Configure o runner (instruções acima em amarelo)"
info "  2. Edite $APP_DIR/.env com as credenciais reais"
info "  3. Adicione ao GitHub (Settings → Secrets → Actions):"
info "     GHCR_TOKEN               = token com read:packages"
info "     NEXT_PUBLIC_API_URL_TEST = http://$VM_IP/api/v1"
info "     NEXT_PUBLIC_WS_URL_TEST  = http://$VM_IP"
info "  4. Faça push para a branch 'develop' para disparar o deploy"
info "     OU acione manualmente em Actions → Deploy — VM de Teste → Run workflow"
info ""
info "Senha do usuário scanner (para configurar nas impressoras): definida acima"
info "Diretório base SFTP: $SFTP_INCOMING"
info ""
