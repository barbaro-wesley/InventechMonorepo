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

A impressora Samsung deve usar:
- **Protocol:** FTP
- **Port:** 21
- **Remaining fields:** mesmos da Brother

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
