# OCR Worker — Plano de Implementação

## Visão Geral

Migração completa do processamento de scans do NestJS para um serviço Go autônomo (`services/ocr-worker`). O NestJS passa a ser somente API de leitura/exibição.

### Fluxo após a implementação

```
Impressora (SFTP)
  └─► Pasta /srv/scans/incoming/<sftp_directory>/
          │
          ▼
  [Go OCR Worker] — detecta arquivo novo (fsnotify)
          │
          ├─► Converte PDF em imagens (pdftoppm)
          ├─► OCR por página (Tesseract, idioma: por)
          ├─► Extrai campos via regex
          │     ├─ paciente
          │     ├─ cpf
          │     ├─ prontuario
          │     └─ numero_atendimento
          ├─► Upload do arquivo original → MinIO (bucket: scans)
          ├─► INSERT em `scans` (status = PROCESSED ou ERROR)
          └─► INSERT em `scan_metadata` (ocr_status = SUCCESS ou FAILED)

  [NestJS API] — somente leitura
          ├─► GET /scans
          ├─► GET /scans/:id
          └─► GET /scans/:id/download (stream MinIO)
```

---

## Responsabilidades por serviço

| Responsabilidade | Go Worker | NestJS |
|---|---|---|
| Monitorar pasta SFTP | ✅ | ❌ (remover) |
| Converter PDF → imagem | ✅ | ❌ |
| OCR + extração de campos | ✅ | ❌ |
| Upload MinIO | ✅ | ❌ (remover de processFile) |
| Escrever `scans` no banco | ✅ | ❌ (remover de processFile) |
| Escrever `scan_metadata` | ✅ | ❌ |
| Listar/exibir scans | ❌ | ✅ |
| Download de arquivos | ❌ | ✅ |
| CRUD de impressoras | ❌ | ✅ |

---

## Fase 1 — Schema Prisma (NestJS controla as migrations)

### 1.1 Novos modelos a adicionar em `apps/api/prisma/schema.prisma`

```prisma
enum OcrStatus {
  PENDING
  SUCCESS
  FAILED
}

model ScanMetadata {
  id                String    @id @default(uuid())
  scanId            String    @unique @map("scan_id")
  ocrStatus         OcrStatus @default(PENDING) @map("ocr_status")
  paciente          String?
  cpf               String?
  prontuario        String?
  numeroAtendimento String?   @map("numero_atendimento")
  extractedAt       DateTime? @map("extracted_at")

  scan Scan @relation(fields: [scanId], references: [id], onDelete: Cascade)

  @@index([scanId])
  @@map("scan_metadata")
}
```

### 1.2 Adicionar relação no model `Scan` existente

```prisma
model Scan {
  // ... campos existentes mantidos ...
  metadata ScanMetadata?   // <- adicionar esta linha
}
```

### 1.3 Gerar e rodar a migration

```bash
cd apps/api
npx prisma migrate dev --name add_scan_metadata
```

---

## Fase 2 — Limpeza no NestJS

### 2.1 Remover `FileWatcherService` completamente

- Deletar: `apps/api/src/modules/scans/file-watcher.service.ts`
- Remover de `ScansModule` (`providers` e `imports`)

### 2.2 Remover `ScansService.processFile()`

- Deletar o método `processFile()` de `scans.service.ts`
- Deletar o método privado `moveToError()`

### 2.3 Atualizar `ScansModule`

```typescript
// scans.module.ts — remover FileWatcherService
@Module({
  providers: [ScansService], // sem FileWatcherService
  controllers: [ScansController],
})
```

### 2.4 Atualizar `ScansService.findAll()` e `findOne()`

Incluir `metadata` no select/include para retornar os dados extraídos pelo OCR:

```typescript
// findAll — adicionar no select da printer:
metadata: {
  select: {
    ocrStatus: true,
    paciente: true,
    cpf: true,
    prontuario: true,
    numeroAtendimento: true,
    extractedAt: true,
  },
},

// findOne — adicionar no include:
metadata: true,
```

---

## Fase 3 — Go OCR Worker

### 3.1 Estrutura de diretórios

```
services/
└── ocr-worker/
    ├── cmd/
    │   └── worker/
    │       └── main.go           # entrypoint: lê config, inicia watcher
    ├── internal/
    │   ├── config/
    │   │   └── config.go         # lê variáveis de ambiente
    │   ├── db/
    │   │   └── db.go             # conexão pgx, INSERT em scans e scan_metadata
    │   ├── storage/
    │   │   └── minio.go          # upload para MinIO
    │   ├── ocr/
    │   │   ├── pdf.go            # converte PDF → imagens (exec pdftoppm)
    │   │   └── tesseract.go      # roda Tesseract, retorna texto bruto
    │   ├── extractor/
    │   │   └── extractor.go      # regex: extrai paciente, cpf, prontuario, atendimento
    │   └── processor/
    │       └── processor.go      # orquestração: watcher → ocr → db → minio
    ├── go.mod
    ├── go.sum
    ├── Dockerfile
    └── .env.example
```

### 3.2 Dependências Go (`go.mod`)

```
github.com/jackc/pgx/v5          — PostgreSQL (sem ORM, SQL puro)
github.com/minio/minio-go/v7     — upload MinIO
github.com/otiai10/gosseract/v2  — bindings Tesseract OCR (CGO)
github.com/fsnotify/fsnotify     — inotify para detectar arquivos novos
github.com/joho/godotenv         — leitura de .env em desenvolvimento
```

> `gosseract` exige CGO habilitado e `libtesseract-dev` no container.
> `pdftoppm` é chamado via `exec.Command` (sem binding Go), instalado via `poppler-utils`.

### 3.3 Variáveis de ambiente (`.env.example`)

```env
# PostgreSQL — mesmo banco do NestJS
POSTGRES_DSN=postgres://user:pass@postgres:5432/dbname

# MinIO — mesmas credenciais
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=scans

# Diretório SFTP — mesmo volume compartilhado
SFTP_SCAN_BASE_DIR=/srv/scans/incoming

# OCR
OCR_LANG=por          # idioma Tesseract (português)
OCR_DPI=300           # resolução para conversão PDF→imagem
```

### 3.4 Lógica de processamento (`processor/processor.go`)

```
1. fsnotify detecta arquivo novo em /srv/scans/incoming/<dir>/
2. Aguarda 3s para estabilização (arquivo ainda sendo copiado via SFTP)
3. Verifica se arquivo ainda cresceu → se sim, aguarda mais
4. Lê printer_id e company_id consultando a tabela `printers` pelo sftp_directory
5. Se impressora não encontrada → move para _error/, para aqui
6. INSERT em `scans` com status = 'PENDING'
7. Converte PDF → imagens PNG (pdftoppm -r $OCR_DPI -png)
8. Para cada página: Tesseract → texto
9. Concatena textos de todas as páginas
10. Regex extrai campos (paciente, cpf, prontuario, numero_atendimento)
11. Upload arquivo original para MinIO:
    key = {company_id}/{printer_id}/{scan_id}/{filename}
12. UPDATE `scans` → status = 'PROCESSED', stored_key = key, processed_at = now()
13. INSERT `scan_metadata`:
    - ocr_status = 'SUCCESS' se algum campo foi extraído
    - ocr_status = 'FAILED' se OCR rodou mas nenhum campo reconhecido
14. Deleta arquivo local após upload bem-sucedido
15. Em caso de erro em qualquer passo → UPDATE scans status = 'ERROR', move para _error/
```

### 3.5 Regex de extração (`extractor/extractor.go`)

Padrões para os documentos do Hospital Cristo Redentor (ajustáveis por cliente):

```go
var patterns = map[string]*regexp.Regexp{
    "paciente":          regexp.MustCompile(`(?i)Paciente:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+)`),
    "cpf":               regexp.MustCompile(`CPF[:\s]+(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})`),
    "prontuario":        regexp.MustCompile(`(?i)Prontu[aá]rio[:\s]+(\d+)`),
    "numero_atendimento": regexp.MustCompile(`(?i)(?:R\.A\.|Atendimento)[:\s]+(\d+)`),
}
```

> Os regex são o ponto mais sensível — precisam ser validados contra PDFs reais.
> Adicionar logs do texto bruto extraído para facilitar ajuste inicial.

---

## Fase 4 — Dockerfile do Go Worker

```dockerfile
FROM golang:1.22-bookworm AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o ocr-worker ./cmd/worker

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-por \
    libtesseract-dev \
    poppler-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/ocr-worker .
CMD ["./ocr-worker"]
```

> Multi-stage: compila no `golang:1.22-bookworm`, roda no `debian:bookworm-slim`.
> `tesseract-ocr-por` = pacote de dados do idioma português.
> `poppler-utils` = provê o binário `pdftoppm`.

---

## Fase 5 — Docker Compose (`apps/api/docker-compose.yml`)

Adicionar o serviço `ocr-worker`:

```yaml
ocr-worker:
  build:
    context: ../../services/ocr-worker
    dockerfile: Dockerfile
  container_name: manutencao_ocr_worker
  restart: unless-stopped
  depends_on:
    postgres:
      condition: service_healthy
    minio:
      condition: service_healthy
  environment:
    POSTGRES_DSN: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    MINIO_ENDPOINT: minio:9000
    MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
    MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
    MINIO_USE_SSL: "false"
    MINIO_BUCKET: scans
    SFTP_SCAN_BASE_DIR: /srv/scans/incoming
    OCR_LANG: por
    OCR_DPI: "300"
  volumes:
    - sftp_scans:/srv/scans/incoming   # volume compartilhado com o servidor SFTP
  networks:
    - manutencao_network
```

> O volume `sftp_scans` deve ser o mesmo montado pelo servidor SFTP (OpenSSH/VSFTPD).
> O worker **não** expõe porta HTTP — é um daemon puro.

---

## Fase 6 — Checklist de implementação

### Prisma / NestJS
- [ ] Adicionar enum `OcrStatus` no schema.prisma
- [ ] Adicionar model `ScanMetadata` no schema.prisma
- [ ] Adicionar `metadata ScanMetadata?` no model `Scan`
- [ ] Rodar `npx prisma migrate dev --name add_scan_metadata`
- [ ] Deletar `file-watcher.service.ts`
- [ ] Remover `FileWatcherService` do `ScansModule`
- [ ] Remover `processFile()` e `moveToError()` do `ScansService`
- [ ] Atualizar `findAll()` para incluir `metadata` no select
- [ ] Atualizar `findOne()` para incluir `metadata` no include

### Go Worker
- [ ] Criar estrutura de diretórios em `services/ocr-worker/`
- [ ] Inicializar `go.mod` com módulo `github.com/inventech/ocr-worker`
- [ ] Implementar `config/config.go` (leitura de env vars)
- [ ] Implementar `db/db.go` (pgx, funções: InsertScan, UpdateScan, InsertMetadata, FindPrinterByDir)
- [ ] Implementar `storage/minio.go` (upload, verificar bucket)
- [ ] Implementar `ocr/pdf.go` (exec pdftoppm, retorna lista de caminhos de imagem)
- [ ] Implementar `ocr/tesseract.go` (gosseract, processa lista de imagens, retorna texto concatenado)
- [ ] Implementar `extractor/extractor.go` (regex patterns, retorna struct com campos extraídos)
- [ ] Implementar `processor/processor.go` (orquestração completa)
- [ ] Implementar `cmd/worker/main.go` (fsnotify, loop principal)
- [ ] Escrever `Dockerfile` com multi-stage build
- [ ] Escrever `.env.example`

### Docker Compose
- [ ] Adicionar serviço `ocr-worker` no `docker-compose.yml`
- [ ] Definir volume `sftp_scans` compartilhado
- [ ] Testar `docker compose up ocr-worker --build`

### Validação
- [ ] Testar com PDF digitalizado real (qualidade variada)
- [ ] Validar regex contra pelo menos 3 documentos diferentes
- [ ] Confirmar que `scan_metadata` é populado corretamente
- [ ] Confirmar que scans com OCR falho ainda aparecem na API com `ocr_status = FAILED`
- [ ] Testar download via NestJS após upload pelo Go worker

---

## Notas importantes

### Sobre o banco de dados compartilhado
O Go worker acessa o **mesmo PostgreSQL** do NestJS. As migrations são controladas exclusivamente pelo Prisma (NestJS). O Go worker usa **SQL puro via pgx** — sem ORM, sem migrations próprias.

### Sobre o OCR de documentos escaneados
- Qualidade mínima recomendada: **300 DPI**
- Documentos muito inclinados ou com ruído reduzem a precisão
- O campo `ocr_status = FAILED` sinaliza que o arquivo foi salvo mas os dados não foram extraídos — permite reprocessamento manual futuro
- Manter log do texto bruto em nível DEBUG para facilitar ajuste dos regex

### Sobre a chave de armazenamento MinIO
O Go worker usa o mesmo padrão já definido no NestJS:
```
{company_id}/{printer_id}/{scan_id}/{filename}
```
Isso garante que o endpoint de download do NestJS (`/scans/:id/download`) funcione sem mudanças.

### Ordem de implementação recomendada
1. Fase 1 (Prisma) → roda a migration primeiro, banco já atualizado
2. Fase 2 (NestJS cleanup) → remove código morto, API ainda funciona
3. Fase 3 + 4 (Go Worker + Dockerfile) → desenvolve e testa localmente
4. Fase 5 (Docker Compose) → integra tudo
