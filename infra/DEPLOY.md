# Guia de Deploy — Produção
**Servidor:** `intranet.hcrmarau.com.br`  
**Usuário atual:** `root` → vamos criar o usuário `deploy`  
**Stack:** Docker + Nginx (proxy reverso) + Let's Encrypt

---

## Visão geral do que vai mudar no servidor

| Antes | Depois |
|-------|--------|
| React estático em `/var/www/html` | Container Docker (Web) na porta 3001 |
| API Node em `/opt/intranet_hcr/api` com PM2 | Container Docker (API) na porta 3000 |
| Nginx servindo arquivos e proxy manual | Nginx apenas como proxy reverso |
| Secrets no código / config da app | `/opt/inventech/.env` com permissão restrita |

---

## ETAPA 1 — Preparar a máquina local (seu computador)

### 1.1 Gerar par de chaves SSH dedicado para o deploy

No seu computador (não no servidor):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/inventech_deploy
```

Isso gera dois arquivos:
- `~/.ssh/inventech_deploy` → **chave privada** (vai para o GitHub Secrets)
- `~/.ssh/inventech_deploy.pub` → **chave pública** (vai para o servidor)

Visualize a chave pública para usar no próximo passo:
```bash
cat ~/.ssh/inventech_deploy.pub
```

### 1.2 Gerar os secrets de produção

Rode cada comando abaixo e **anote o resultado** — você vai precisar deles:

```bash
# JWT — dois valores diferentes
openssl rand -hex 32   # fdeaf7ab5a1145fac7b27923afb8661889388a4847f071a25a188888e3608ee4  # → JWT_ACCESS_SECRET
openssl rand -hex 32   # e15d0c6a749a9b13ec7cf6a7033dd70e5e2e562496396974476cf781c46dd804  # → JWT_REFRESH_SECRET

# Banco de dados
openssl rand -base64 32 # 53ae52766de7157cead7f6e82131d88d7d8d9eb02156f8c3cbd05bf6378c4b4d  # → POSTGRES_PASSWORD

# Redis
openssl rand -base64 32  # 028771e44e59760214bc094f27930cdfc4fbf302293e1a534c6b9c3c012fe552  # → REDIS_PASSWORD

# MinIO
openssl rand -base64 32  # 1ca8870a0d93685d46b26fd07212cae42bc082386bea037e5af144c4832a92ad # → MINIO_ROOT_PASSWORD
```

> Guarde esses valores em um gerenciador de senhas (Bitwarden, KeePass, etc.).  
> Você **não consegue** recuperá-los depois se perder.

---

## ETAPA 2 — Configurar o GitHub

### 2.1 Criar um Token GitHub (GHCR_TOKEN)

1. Acesse: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Clique em **Generate new token (classic)**
3. Nome: `inventech-deploy`
4. Selecione as permissões:
   - [x] `write:packages`
   - [x] `read:packages`
   - [x] `delete:packages`
5. Clique em **Generate token**
6. **Copie o token** — ele só aparece uma vez

### 2.2 Adicionar Secrets no repositório

Acesse: GitHub → Repositório **InventechMonorepo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Adicione um por um:

| Nome do Secret | Valor |
|----------------|-------|
| `SSH_HOST` | IP interno ou hostname do servidor |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Conteúdo de `~/.ssh/inventech_deploy` (chave **privada**) |
| `GHCR_TOKEN` | Token gerado no passo 2.1 |
| `NEXT_PUBLIC_API_URL` | `https://intranet.hcrmarau.com.br/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `https://intranet.hcrmarau.com.br` |

### 2.3 Criar o ambiente "production" no GitHub

1. Acesse: GitHub → Repositório → **Settings** → **Environments** → **New environment**
2. Nome: `production`
3. Em **Deployment branches**, selecione: **Selected branches** → adicione `main`
4. (Opcional) Marque **Required reviewers** e adicione seu usuário — assim todo deploy precisa da sua aprovação

---

## ETAPA 3 — Configurar o servidor (rodar como root, uma única vez)

### 3.1 Acessar o servidor

```bash
ssh root@intranet.hcrmarau.com.br
```

### 3.2 Rodar o script de setup

O script faz tudo automaticamente:
- Atualiza o sistema
- Instala Docker, Nginx, Certbot, Fail2Ban
- Cria o usuário `deploy`
- Configura o firewall (UFW)
- Emite/renova o certificado Let's Encrypt
- Desabilita login root via SSH

```bash
# No servidor, como root:
curl -fsSL https://raw.githubusercontent.com/barbaro-wesley/InventechMonorepo/main/infra/scripts/server-setup.sh -o server-setup.sh
bash server-setup.sh
```

Durante o script ele vai pedir:
- **A chave pública SSH** → cole o conteúdo de `~/.ssh/inventech_deploy.pub` (da etapa 1.1)

> **ATENÇÃO:** Após o script terminar, o login como `root` via SSH será desabilitado.  
> A partir daí use sempre: `ssh deploy@intranet.hcrmarau.com.br`

### 3.3 Testar o acesso com o novo usuário

Antes de fechar a sessão root, abra **outro terminal** e teste:

```bash
ssh -i ~/.ssh/inventech_deploy deploy@intranet.hcrmarau.com.br
```

Se conseguir entrar, pode fechar a sessão root com segurança.

---

## ETAPA 4 — Preencher as credenciais de produção no servidor

Acesse como usuário `deploy`:

```bash
ssh -i ~/.ssh/inventech_deploy deploy@intranet.hcrmarau.com.br
```

Edite o arquivo `.env` de produção:

```bash
nano /opt/inventech/.env
```

Substitua **todos** os valores `TROQUE_POR_*` pelos valores gerados na etapa 1.2.

Campos que precisam de atenção especial:

```env
# Use os valores gerados com openssl rand
JWT_ACCESS_SECRET=<valor gerado>
JWT_REFRESH_SECRET=<valor gerado>
POSTGRES_PASSWORD=<valor gerado>
REDIS_PASSWORD=<valor gerado>
MINIO_ROOT_PASSWORD=<valor gerado>

# Atualize a DATABASE_URL com a mesma senha do POSTGRES_PASSWORD
DATABASE_URL=postgresql://manutencao_user:<POSTGRES_PASSWORD>@postgres:5432/manutencao_db?schema=public

# Domínio real
ALLOWED_ORIGINS=https://intranet.hcrmarau.com.br

# Suas credenciais de e-mail
MAIL_USER=seu_email@gmail.com
MAIL_PASSWORD=<app_password_gmail>
```

Salve com `Ctrl+O`, `Enter`, `Ctrl+X`.

Verifique se não sobrou nenhum placeholder:
```bash
grep "TROQUE_POR" /opt/inventech/.env
# Não deve retornar nada
```

---

## ETAPA 5 — Primeiro deploy manual

Ainda como usuário `deploy` no servidor:

```bash
bash /opt/inventech/infra/scripts/first-deploy.sh
```

O script vai:
1. Parar PM2 e processos da aplicação antiga
2. Desativar o site Nginx antigo
3. Fazer login no GHCR e baixar as imagens Docker
4. Subir PostgreSQL, Redis e MinIO
5. Rodar as migrations do banco (`prisma migrate deploy`)
6. Subir a API e o Web
7. Instalar e ativar o Nginx com o novo config

Durante o script ele vai pedir:
- **Seu usuário GitHub** (ex: `barbaro-wesley`)
- **Um token GitHub** com permissão `read:packages` (pode usar o mesmo GHCR_TOKEN da etapa 2.1)

### 5.1 Verificar se tudo subiu

```bash
# Ver status de todos os containers
docker compose -f /opt/inventech/docker-compose.prod.yml ps

# Verificar API
curl -s http://localhost:3000/api/v1/health/ping

# Verificar Web
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001

# Ver logs da API (últimas 50 linhas)
docker logs inventech_api --tail 50

# Ver logs do Web
docker logs inventech_web --tail 50
```

### 5.2 Verificar Nginx

```bash
sudo nginx -t              # testa a configuração
sudo systemctl status nginx
```

Acesse pelo navegador: `https://intranet.hcrmarau.com.br`

---

## ETAPA 6 — Confirmar e limpar

Depois de confirmar que a nova aplicação está funcionando corretamente:

```bash
# Apaga os arquivos da aplicação antiga (faça só quando tiver certeza)
sudo rm -rf /var/www/html
sudo rm -rf /opt/intranet_hcr
```

---

## ETAPA 7 — A partir de agora: deploys automáticos

Todo **push para a branch `main`** vai disparar o pipeline automaticamente:

```
push → main
  └── GitHub Actions
        ├── Lint & Type check
        ├── Build imagem API   → ghcr.io/.../inventech-api:<sha>
        ├── Build imagem Web   → ghcr.io/.../inventech-web:<sha>
        └── Deploy via SSH
              ├── Copia docker-compose.prod.yml para o servidor
              ├── Baixa as novas imagens
              ├── Roda migrations
              ├── Sobe containers (sem downtime)
              └── Remove imagens antigas
```

Para acompanhar: GitHub → Repositório → **Actions**

---

## Referência rápida — comandos úteis no servidor

```bash
# Ver status dos containers
docker compose -f /opt/inventech/docker-compose.prod.yml ps

# Ver logs em tempo real
docker logs inventech_api -f
docker logs inventech_web -f

# Reiniciar um container
docker restart inventech_api

# Parar tudo
docker compose -f /opt/inventech/docker-compose.prod.yml down

# Ver uso de disco/memória
docker stats

# Verificar certificado SSL
certbot certificates

# Testar renovação do certificado (não renova de verdade)
certbot renew --dry-run
```

---

## Checklist final

- [ ] **Etapa 1** — Chaves SSH geradas e secrets anotados
- [ ] **Etapa 2** — GitHub Secrets configurados (6 no total)
- [ ] **Etapa 2.3** — Ambiente `production` criado no GitHub
- [ ] **Etapa 3** — Script de setup rodado no servidor
- [ ] **Etapa 3.3** — Acesso SSH com usuário `deploy` testado
- [ ] **Etapa 4** — `/opt/inventech/.env` preenchido sem placeholders
- [ ] **Etapa 5** — Primeiro deploy executado
- [ ] **Etapa 5.1** — Todos os containers `healthy`
- [ ] **Etapa 5.2** — Site acessível via `https://intranet.hcrmarau.com.br`
- [ ] **Etapa 6** — Arquivos antigos removidos (quando confirmar que tudo funciona)
