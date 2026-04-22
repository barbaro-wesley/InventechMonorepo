# Funcionalidade: Impressoras & Digitalização (Scan to Server)

Branch: `printer_feature`

---

## Visão geral

Impressoras com scanner (Brother L6902, L6912, Samsung M4070) enviam arquivos digitalizados via SFTP direto para o servidor Linux. A API NestJS detecta os arquivos automaticamente, faz upload para o MinIO e salva os registros no Postgres vinculados ao tenant (empresa).

```
[Impressora] → SFTP (LAN) → [/srv/scans/incoming/{slug}/] → [FileWatcher] → [MinIO + Postgres]
```

Cada impressora é vinculada a um **Centro de Custo** existente no sistema, permitindo rastrear as digitalizações por setor/departamento.

---

## 1. Configuração do servidor Linux (fazer uma vez)

> Se estiver usando a VM de teste, o `server-setup-test.sh` já faz tudo desta seção automaticamente.

### 1.1 — Criar usuário SFTP dedicado

```bash
sudo useradd -m -s /sbin/nologin scanner
sudo passwd scanner
# escolha uma senha forte — esta é a senha que você vai colocar nas impressoras
```

### 1.2 — Criar diretório base

```bash
sudo mkdir -p /srv/scans/incoming
sudo chown scanner:scanner /srv/scans/incoming
sudo chmod 755 /srv/scans/incoming
```

### 1.3 — Configurar o SSH para aceitar SFTP nesse diretório (chroot por segurança)

Edite `/etc/ssh/sshd_config` e adicione no final:

```
Match User scanner
    ChrootDirectory /srv/scans
    ForceCommand internal-sftp
    AllowTcpForwarding no
    X11Forwarding no
```

Depois ajuste as permissões do chroot (o chroot exige que o dono seja root):

```bash
sudo chown root:root /srv/scans
sudo chmod 755 /srv/scans
sudo chown scanner:scanner /srv/scans/incoming
sudo systemctl restart sshd
```

### 1.4 — Testar conexão SFTP

```bash
sftp scanner@192.168.0.70
# deve entrar e listar /incoming/
```

---

## 2. Variáveis de ambiente (`.env` da API)

Adicione estas duas linhas no `.env` do servidor:

```env
SFTP_SCAN_BASE_DIR=/srv/scans/incoming
SFTP_HOST=192.168.0.70
```

> `SFTP_HOST` é usado apenas para exibir a configuração sugerida quando você cadastra uma impressora. Não afeta o funcionamento do watcher.

---

## 3. Aplicar a migration no banco

```bash
cd apps/api
npx prisma migrate deploy
```

Isso cria as tabelas `printers` e `scans` no Postgres.

---

## 4. Fluxo de cadastro de uma nova impressora (via API)

Antes de cadastrar uma impressora, você precisa do `id` do Centro de Custo correspondente (busque via `GET /cost-centers`).

### POST /printers

```json
{
  "name": "Brother RH",
  "ipAddress": "192.168.0.169",
  "brand": "Brother",
  "model": "L6902DW",
  "costCenterId": "uuid-do-centro-de-custo",
  "notes": "Impressora do setor de Recursos Humanos"
}
```

**O que acontece automaticamente:**
1. A API valida que o `costCenterId` pertence à mesma empresa
2. Gera um slug único a partir do nome: `brother-rh`
3. Cria o diretório `/srv/scans/incoming/brother-rh/` no servidor
4. Retorna o campo `sftpConfig` com os dados para configurar na impressora:

```json
{
  "id": "...",
  "name": "Brother RH",
  "costCenter": { "id": "...", "name": "Recursos Humanos", "code": "CC-01" },
  "sftpConfig": {
    "host": "192.168.0.70",
    "port": 22,
    "username": "scanner",
    "remoteDirectory": "/incoming/brother-rh"
  }
}
```

> Use exatamente os dados de `sftpConfig` no painel web da impressora.

### GET /printers (filtros disponíveis)

```
GET /printers                          → todas as impressoras
GET /printers?isActive=true            → somente ativas
GET /printers?costCenterId=uuid-do-cc  → somente de um centro de custo
```

---

## 5. Configuração nas impressoras

### Brother L6902DW / L6912DW

1. Acesse o painel web da impressora: `http://192.168.0.169`
2. Vá em **Scan → Scan to FTP/SFTP/Network/SharePoint**
3. Clique em **SFTP** → **Create New Profile**
4. Preencha:
   - **Host Address:** `192.168.0.70`
   - **Port:** `22`
   - **Username:** `scanner`
   - **Password:** senha criada no passo 1.1
   - **Store Directory:** valor de `sftpConfig.remoteDirectory` (ex: `/incoming/brother-rh`)
   - **File Name:** deixe o padrão (data/hora automático)
   - **File Type:** PDF (recomendado)
5. Salve e teste com o botão **Test**

### Samsung M4070

1. Acesse o painel web: `http://IP_DA_IMPRESSORA`
2. Vá em **Scan → Scan to FTP**
3. Preencha os mesmos dados acima
   - Samsung não suporta SFTP nativo — use **FTP** (porta 21)

> **Atenção Samsung:** Veja seção 6 abaixo.

---

## 6. Samsung M4070 — configurar FTP (alternativa ao SFTP)

> O `server-setup-test.sh` já instala e configura o vsftpd automaticamente.

Em produção, caso precise configurar manualmente:

```bash
sudo apt install vsftpd -y
```

Edite `/etc/vsftpd.conf`:

```
local_enable=YES
write_enable=YES
local_umask=022
chroot_local_user=YES
allow_writeable_chroot=YES
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
```

```bash
sudo systemctl restart vsftpd
sudo ufw allow 21/tcp
sudo ufw allow 40000:40100/tcp
```

### 6.1 — Liberar o usuário `scanner` para o vsftpd

O usuário `scanner` foi criado com shell `/sbin/nologin` (segurança). O `vsftpd` por padrão **nega login para usuários cujo shell não está listado em `/etc/shells`**, o que faz o login FTP falhar.

**Solução:** adicionar `/sbin/nologin` ao `/etc/shells`:

```bash
echo "/sbin/nologin" | sudo tee -a /etc/shells
```

> Isso libera o `scanner` para autenticar via FTP/vsftpd sem comprometer a segurança — login interativo via SSH ainda é bloqueado. Não é necessário criar um segundo usuário FTP.

Para confirmar se o problema existe antes de aplicar:

```bash
cat /etc/shells | grep nologin
# Se não retornar nada, o vsftpd está rejeitando o scanner
```

### 6.2 — Corrigir "Acesso negado" ao escrever via FTP

O `vsftpd` com `chroot_local_user=YES` aprisiona o usuário no seu **home directory**. O `scanner` foi criado com home em `/home/scanner`, mas os arquivos precisam ir para `/srv/scans/incoming` — por isso o FTP autentica mas retorna "acesso negado" ao tentar enviar arquivos.

**Solução:** mudar o home do `scanner` para `/srv/scans` (mesmo chroot do SFTP):

```bash
sudo usermod -d /srv/scans scanner
```

Confirme as permissões do diretório destino:

```bash
sudo chown scanner:scanner /srv/scans/incoming
sudo chmod 755 /srv/scans/incoming
```

Reinicie os dois serviços:

```bash
sudo systemctl restart vsftpd
sudo systemctl restart sshd
```

Teste FTP:

```bash
ftp 192.168.0.70
# usuário: scanner / senha: a mesma definida no passo 1.1
# após login, deve conseguir entrar em: cd incoming/nome-da-impressora
```

> Com esta configuração, tanto SFTP quanto FTP caem em `/srv/scans` como raiz e o usuário escreve normalmente em `incoming/`. O SFTP continua funcionando — o `ChrootDirectory /srv/scans` no sshd_config já era esse mesmo caminho.

A impressora Samsung deve usar:
- **Protocol:** FTP
- **Port:** 21
- **Store Directory:** `/incoming/nome-da-impressora` (sem `/srv/scans` — já está dentro do chroot)
- **Username / Password:** mesmos do SFTP

---

## 7. Endpoints da API

### Impressoras

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| GET | `/printers` | `printer:list` | Listar (filtros: `isActive`, `costCenterId`) |
| GET | `/printers/:id` | `printer:read` | Buscar por ID (inclui `sftpConfig` e `costCenter`) |
| POST | `/printers` | `printer:create` | Cadastrar (cria diretório automaticamente) |
| PATCH | `/printers/:id` | `printer:update` | Atualizar dados |
| DELETE | `/printers/:id` | `printer:delete` | Soft delete + desativa |

### Scans

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| GET | `/scans` | `scan:list` | Listar scans (filtros: `printerId`, `status`) |
| GET | `/scans/:id` | `scan:read` | Detalhes do scan |
| GET | `/scans/:id/download` | `scan:download` | Redirect para presigned URL (1h) |
| DELETE | `/scans/:id` | `scan:delete` | Remove arquivo do MinIO + registro |

---

## 8. Permissões por role (padrão)

| Permissão | SA | CA | CM | TEC |
|---|---|---|---|---|
| `printer:list/read` | ✓ | ✓ | ✓ | — |
| `printer:create/delete` | ✓ | ✓ | — | — |
| `printer:update` | ✓ | ✓ | ✓ | — |
| `scan:list/read/download` | ✓ | ✓ | ✓ | ✓ |
| `scan:delete` | ✓ | ✓ | ✓ | — |

---

## 9. Estrutura de diretórios no servidor

```
/srv/
└── scans/               ← chroot root do usuário scanner
    └── incoming/        ← diretório base (SFTP_SCAN_BASE_DIR)
        ├── brother-rh/       ← impressora "Brother RH" (CC: Recursos Humanos)
        ├── samsung-financeiro/ ← impressora "Samsung Financeiro" (CC: Financeiro)
        └── _error/           ← arquivos que falharam no processamento
```

---

## 10. Estrutura dos arquivos criados

```
apps/api/src/modules/
├── printers/
│   ├── dto/printer.dto.ts       — CreatePrinterDto, UpdatePrinterDto, ListPrintersDto
│   ├── printers.service.ts      — CRUD + validação CC + geração de slug + criação de diretório
│   ├── printers.controller.ts   — Endpoints REST
│   └── printers.module.ts
└── scans/
    ├── dto/scan.dto.ts           — ListScansDto
    ├── scans.service.ts          — processFile() + CRUD + MinIO + presigned URL
    ├── file-watcher.service.ts   — chokidar: monitora /srv/scans/incoming/**
    ├── scans.controller.ts       — Endpoints REST
    └── scans.module.ts

apps/api/prisma/
├── schema.prisma                 — modelos Printer, Scan, enum ScanStatus
└── migrations/20260420000000_add_printers_and_scans/migration.sql
```

---

## 11. Banco de dados — modelos

### Printer
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `companyId` | UUID | Tenant (empresa) |
| `costCenterId` | UUID? | FK → `cost_centers` (setor/departamento) |
| `name` | String | Nome amigável |
| `ipAddress` | String | IP da impressora na rede |
| `model` | String? | Ex: L6902DW |
| `brand` | String? | Ex: Brother |
| `sftpDirectory` | String (unique) | Slug do diretório SFTP gerado a partir do nome |
| `isActive` | Boolean | Ativa/inativa |
| `deletedAt` | DateTime? | Soft delete |

### Scan
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `companyId` | UUID | Tenant |
| `printerId` | UUID | FK → Printer |
| `fileName` | String | Nome original do arquivo |
| `storedKey` | String | Caminho no MinIO |
| `bucket` | String | Sempre `scans` |
| `mimeType` | String | `application/pdf`, `image/jpeg` etc |
| `sizeBytes` | Int | Tamanho em bytes |
| `status` | Enum | `PENDING` → `PROCESSED` ou `ERROR` |
| `errorMsg` | String? | Mensagem de erro se falhou |
| `scannedAt` | DateTime | Quando o arquivo chegou |
| `processedAt` | DateTime? | Quando foi processado |

---

## 12. Checklist de deploy

- [ ] Criar usuário `scanner` no Linux (ou rodar `server-setup-test.sh`)
- [ ] Configurar chroot no `/etc/ssh/sshd_config`
- [ ] Criar `/srv/scans/incoming/` com permissões corretas
- [ ] Adicionar `SFTP_SCAN_BASE_DIR` e `SFTP_HOST` no `.env`
- [ ] Rodar `npx prisma migrate deploy`
- [ ] Buscar IDs dos Centros de Custo via `GET /cost-centers`
- [ ] Cadastrar cada impressora via `POST /printers` com o `costCenterId` correto
- [ ] Usar o `sftpConfig` retornado para configurar cada impressora no painel dela
- [ ] Testar digitalização e verificar em `GET /scans`
- [ ] (Samsung) Verificar se vsftpd está ativo: `systemctl status vsftpd`
