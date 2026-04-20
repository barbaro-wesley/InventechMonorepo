# Guia de Deploy — VM de Teste Interna
**Acesso:** IP interno da VM (sem domínio, sem SSL)  
**Stack:** Docker + Nginx (HTTP) + Self-hosted GitHub Actions Runner

> Os arquivos de produção (`DEPLOY.md`, `server-setup.sh`, `nginx/inventech.conf`, `ci.yml`) **não foram alterados**.  
> Este guia e os scripts `*-test` são exclusivos para o ambiente de teste.

---

## Por que Self-hosted Runner (e não SSH externo)?

A VM tem **IP interno** (ex: `192.168.0.70`) — o GitHub Actions na nuvem não consegue alcançá-la via SSH. A solução é um **self-hosted runner**: um agente instalado na própria VM que se conecta **de saída** para o GitHub. Não precisa abrir nenhuma porta extra nem ter IP público.

```
GitHub Actions (nuvem)
    ↑ runner faz polling de saída
[VM interna 192.168.0.70]
    └── ~/actions-runner/  ← agente rodando como serviço
```

O job `deploy` no workflow já usa `runs-on: self-hosted` exatamente por isso.

---

## Diferenças em relação à produção

| Produção | Teste |
|----------|-------|
| Domínio `intranet.hcrmarau.com.br` | IP interno (ex: `192.168.0.70`) |
| HTTPS com Let's Encrypt | HTTP simples (porta 80) |
| Branch `main` dispara deploy | Branch `develop` + dispatch manual |
| Secrets `SSH_HOST`, `SSH_USER`, etc. | Sem secrets de SSH (runner local) |
| GitHub Environment `production` | GitHub Environment `develop` |
| Tag de imagem: SHA curto | Tag de imagem: `staging` |
| Runner: `ubuntu-latest` (nuvem) | Runner: `self-hosted` (VM) |

---

## ETAPA 1 — Configurar o servidor de teste

Acesse a VM como root (via IP interno):

```bash
ssh root@<IP_DA_VM>
```

Baixe e execute o script de setup:

```bash
curl -fsSL https://raw.githubusercontent.com/barbaro-wesley/InventechMonorepo/develop/infra/scripts/server-setup-test.sh -o server-setup-test.sh
bash server-setup-test.sh
```

O script faz **tudo automaticamente**:
- Instala Docker, Nginx, vsftpd, Fail2Ban
- Cria o usuário `deploy` (com permissão sudo restrita para nginx)
- Configura firewall (portas 22, 80, 21, 40000-40100)
- Cria o usuário `scanner` + diretório SFTP `/srv/scans/incoming/`
- Configura chroot SFTP no SSH (Brother) e vsftpd (Samsung)
- Baixa o binário do self-hosted runner em `~/actions-runner/`
- Cria o template `.env` em `/opt/inventech/.env`

**Anote o IP interno** exibido no final do script.

---

## ETAPA 2 — Configurar o Self-hosted Runner

Esta etapa é manual e requer um token gerado no GitHub.

### 2.1 — Gerar o token de registro

1. Acesse: `https://github.com/barbaro-wesley/InventechMonorepo/settings/actions/runners/new`
2. Selecione **Linux** / **x64**
3. Copie o token exibido em "Configure" (começa com `AART...`, válido por 1 hora)

### 2.2 — Registrar o runner na VM

Acesse a VM como usuário `deploy`:

```bash
su - deploy
# ou: ssh deploy@<IP_DA_VM>
```

```bash
cd ~/actions-runner

./config.sh \
  --url https://github.com/barbaro-wesley/InventechMonorepo \
  --token SEU_TOKEN_AQUI \
  --name inventech-test-vm \
  --labels self-hosted,linux \
  --unattended
```

### 2.3 — Instalar como serviço systemd (como root)

```bash
exit  # volta para root
cd /home/deploy/actions-runner
./svc.sh install deploy
./svc.sh start
```

### 2.4 — Verificar se o runner está online

```bash
./svc.sh status
```

No GitHub: `https://github.com/barbaro-wesley/InventechMonorepo/settings/actions/runners`  
O runner deve aparecer como **Idle** (verde).

---

## ETAPA 3 — Adicionar Secrets no GitHub

Acesse: GitHub → Repositório → **Settings** → **Secrets and variables** → **Actions**

| Nome do Secret | Valor |
|----------------|-------|
| `GHCR_TOKEN` | Token GitHub com `read:packages` (pode reusar o de produção) |
| `NEXT_PUBLIC_API_URL_TEST` | `http://<IP_DA_VM>/api/v1` |
| `NEXT_PUBLIC_WS_URL_TEST` | `http://<IP_DA_VM>` |

> Não são necessários secrets de SSH — o runner roda direto na VM.

---

## ETAPA 4 — Criar o ambiente "develop" no GitHub

1. GitHub → Repositório → **Settings** → **Environments** → **New environment**
2. Nome: `develop`
3. Sem restrições de branch

---

## ETAPA 5 — Preencher o `.env` na VM

```bash
su - deploy
nano /opt/inventech/.env
```

Substitua os `TROQUE_POR_*` por valores reais:

```bash
# Gere senhas fortes:
openssl rand -hex 32    # para JWT_ACCESS_SECRET e JWT_REFRESH_SECRET
openssl rand -base64 32 # para POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_PASSWORD
```

Verifique se não sobrou nenhum placeholder:
```bash
grep "TROQUE_POR" /opt/inventech/.env
# Não deve retornar nada
```

Os campos `SFTP_SCAN_BASE_DIR` e `SFTP_HOST` já foram preenchidos automaticamente pelo script de setup.

---

## ETAPA 6 — Disparar o primeiro deploy

**Opção A — Push para `develop`:**
```bash
git checkout develop
git push origin develop
```

**Opção B — Dispatch manual:**

GitHub → Repositório → **Actions** → **Deploy — VM de Teste** → **Run workflow**

O pipeline vai:
1. Lint e type check (roda na nuvem: `ubuntu-latest`)
2. Build das imagens com tag `staging` e push no GHCR (roda na nuvem)
3. Deploy: copia arquivos, puxa imagens, roda migrations, sobe containers, configura Nginx (roda no **self-hosted runner** da VM)

---

## ETAPA 7 — Verificar se tudo subiu

```bash
# Status dos containers
docker compose -f /opt/inventech/docker-compose.prod.yml ps

# Health da API
curl -s http://localhost:3000/api/v1/health/ping

# Status do Nginx
sudo nginx -t && sudo systemctl status nginx
```

No navegador da rede interna:
```
http://<IP_DA_VM>
```

---

## ETAPA 8 — Configurar impressoras na rede

Após o deploy, cadastre cada impressora via API:

```bash
curl -X POST http://<IP_DA_VM>/api/v1/printers \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Brother RH",
    "ipAddress": "192.168.0.169",
    "brand": "Brother",
    "model": "L6902DW",
    "sector": "RH"
  }'
```

A resposta inclui o campo `sftpConfig` com os dados exatos para configurar no painel da impressora:

```json
{
  "sftpConfig": {
    "host": "192.168.0.70",
    "port": 22,
    "username": "scanner",
    "remoteDirectory": "/incoming/rh-brother-rh"
  }
}
```

Consulte o guia completo em `docs/printer-feature.md`.

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

# Status do runner
cd ~/actions-runner && ./svc.sh status

# Verificar scans recebidos
ls -la /srv/scans/incoming/

# Ver usuário scanner
id scanner
```

---

## Checklist

- [ ] Script `server-setup-test.sh` executado na VM
- [ ] Token de runner gerado no GitHub e runner configurado (`./config.sh`)
- [ ] Runner instalado como serviço (`./svc.sh install && start`)
- [ ] Runner aparece como **Idle** em GitHub → Settings → Actions → Runners
- [ ] 3 secrets adicionados no GitHub (`GHCR_TOKEN`, `NEXT_PUBLIC_API_URL_TEST`, `NEXT_PUBLIC_WS_URL_TEST`)
- [ ] Ambiente `develop` criado no GitHub
- [ ] `/opt/inventech/.env` preenchido sem placeholders
- [ ] Deploy disparado (push `develop` ou dispatch manual)
- [ ] Todos os containers `healthy`
- [ ] Aplicação acessível via `http://<IP_DA_VM>`
- [ ] Impressoras cadastradas via `POST /printers` e configuradas no painel delas
