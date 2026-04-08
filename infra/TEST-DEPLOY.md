# Guia de Deploy — VM de Teste Interna
**Acesso:** IP interno da VM (sem domínio, sem SSL)  
**Stack:** Docker + Nginx (HTTP) — igual à produção, sem Let's Encrypt

> Os arquivos de produção (`DEPLOY.md`, `server-setup.sh`, `nginx/inventech.conf`, `ci.yml`) **não foram alterados**.  
> Este guia e os scripts `*-test` são exclusivos para o ambiente de teste.

---

## Diferenças em relação à produção

| Produção | Teste |
|----------|-------|
| Domínio `intranet.hcrmarau.com.br` | IP interno (ex: `192.168.1.50`) |
| HTTPS com Let's Encrypt | HTTP simples (porta 80) |
| Branch `main` dispara deploy | Branch `develop` + dispatch manual |
| Secrets `SSH_HOST`, `SSH_USER`, etc. | Secrets `SSH_HOST_TEST`, `SSH_USER_TEST`, etc. |
| GitHub Environment `production` | GitHub Environment `staging` |
| Tag de imagem: SHA curto | Tag de imagem: `staging` |

---

## ETAPA 1 — Gerar chaves SSH para o deploy de teste

Na sua máquina local:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy-test" -f ~/.ssh/inventech_deploy_test
cat ~/.ssh/inventech_deploy_test.pub  # você vai colar isso no servidor
```

---

## ETAPA 2 — Configurar o servidor de teste

Acesse a VM como root (via IP interno):

```bash
ssh root@<IP_DA_VM>
```

Baixe e execute o script de setup (sem Let's Encrypt):

```bash
curl -fsSL https://raw.githubusercontent.com/barbaro-wesley/InventechMonorepo/develop/infra/scripts/server-setup-test.sh -o server-setup-test.sh
bash server-setup-test.sh
```

O script vai:
- Instalar Docker, Nginx, Fail2Ban
- Criar o usuário `deploy`
- Configurar firewall (portas 22 e 80)
- Pedir a chave pública SSH (cole `~/.ssh/inventech_deploy_test.pub`)
- Criar o template `.env` em `/opt/inventech/.env`

**Anote o IP interno** exibido no final do script.

---

## ETAPA 3 — Adicionar Secrets no GitHub

Acesse: GitHub → Repositório → **Settings** → **Secrets and variables** → **Actions**

| Nome do Secret | Valor |
|----------------|-------|
| `SSH_HOST_TEST` | IP interno da VM (ex: `192.168.1.50`) |
| `SSH_USER_TEST` | `deploy` |
| `SSH_PRIVATE_KEY_TEST` | Conteúdo de `~/.ssh/inventech_deploy_test` (chave **privada**) |
| `GHCR_TOKEN` | Token GitHub com `read:packages` (pode reusar o de produção) |
| `NEXT_PUBLIC_API_URL_TEST` | `http://<IP_DA_VM>/api/v1` |
| `NEXT_PUBLIC_WS_URL_TEST` | `http://<IP_DA_VM>` |

---

## ETAPA 4 — Criar o ambiente "staging" no GitHub

1. GitHub → Repositório → **Settings** → **Environments** → **New environment**
2. Nome: `staging`
3. Sem restrições de branch (para aceitar `develop` e dispatch manual)

---

## ETAPA 5 — Preencher o `.env` na VM

Acesse como `deploy`:

```bash
ssh -i ~/.ssh/inventech_deploy_test deploy@<IP_DA_VM>
nano /opt/inventech/.env
```

Substitua os `TROQUE_POR_*` por valores reais. Gere senhas com:

```bash
openssl rand -hex 32    # para JWT_ACCESS_SECRET e JWT_REFRESH_SECRET
openssl rand -base64 32 # para POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD
```

O campo `ALLOWED_ORIGINS` já deve ter sido preenchido com o IP pelo script de setup.  
Atualize também `DATABASE_URL` com a mesma senha definida em `POSTGRES_PASSWORD`.

Verifique:
```bash
grep "TROQUE_POR" /opt/inventech/.env
# Não deve retornar nada
```

---

## ETAPA 6 — Disparar o primeiro deploy

**Opção A — Push para `develop`:**
```bash
git checkout develop
git push origin develop
```

**Opção B — Dispatch manual (sem precisar fazer push):**

GitHub → Repositório → **Actions** → **Deploy — VM de Teste** → **Run workflow**

O pipeline vai:
1. Fazer lint e type check
2. Buildar as imagens com tag `staging` e publicar no GHCR
3. Conectar à VM via SSH e subir os containers
4. Rodar migrations do banco
5. Configurar e recarregar o Nginx

---

## ETAPA 7 — Verificar se tudo subiu

Na VM (como `deploy`):

```bash
# Status dos containers
docker compose -f /opt/inventech/docker-compose.prod.yml ps

# Health da API
curl -s http://localhost:3000/api/v1/health/ping

# Status do Nginx
sudo nginx -t
sudo systemctl status nginx
```

No navegador da rede interna:
```
http://<IP_DA_VM>
```

---

## Comandos úteis na VM de teste

```bash
# Logs em tempo real
docker logs inventech_api -f
docker logs inventech_web -f

# Reiniciar um container
docker restart inventech_api

# Parar tudo
docker compose -f /opt/inventech/docker-compose.prod.yml down

# Ver uso de recursos
docker stats

# Ver IP da VM
hostname -I
```

---

## Checklist

- [ ] Chave SSH `inventech_deploy_test` gerada
- [ ] Script `server-setup-test.sh` executado na VM
- [ ] Acesso SSH com usuário `deploy` testado
- [ ] 5 secrets `*_TEST` + `GHCR_TOKEN` adicionados no GitHub
- [ ] Ambiente `staging` criado no GitHub
- [ ] `/opt/inventech/.env` preenchido sem placeholders
- [ ] Deploy disparado (push `develop` ou dispatch manual)
- [ ] Todos os containers `healthy`
- [ ] Aplicação acessível via `http://<IP_DA_VM>`
