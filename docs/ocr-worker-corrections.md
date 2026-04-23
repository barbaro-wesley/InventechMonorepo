# OCR Worker — Correções e Pendências

## Status geral

| Fase | Status |
|------|--------|
| Fase 1 — Schema Prisma | ✅ Completo |
| Fase 2 — Limpeza NestJS | ✅ Completo |
| Fase 3 — Go Worker (estrutura/config/db/storage/extractor) | ✅ Completo |
| Fase 3 — Go Worker (processor: lógica de concorrência) | ❌ Com bugs críticos |
| Fase 3 — Go Worker (ocr/pdf: multi-página) | ❌ Incompleto |
| Fase 4 — Dockerfile | ✅ Completo |
| Fase 5 — Docker Compose | ⚠️ Falta healthcheck |
| Fase 6 — Validação | ⏳ Não testado |

---

## Bugs críticos

### BUG 1 — `processor.go`: `handleNewFile` bloqueia o loop de eventos

**Arquivo:** `services/ocr-worker/internal/processor/processor.go:107`

O método `handleNewFile` é chamado diretamente dentro do loop de eventos do fsnotify, o que bloqueia o canal por `time.Sleep(3s)` + todo o tempo de OCR (pode levar minutos). Durante esse tempo, novos eventos de arquivo não são lidos.

**Solução:** Processar cada arquivo em goroutine separada, com um semáforo para limitar paralelismo e proteger o Tesseract.

```go
// No Start(), trocar:
p.handleNewFile(ctx, event.Name)

// Por:
go p.handleNewFile(ctx, event.Name)
```

Mas isso sozinho não é suficiente — veja BUG 5.

---

### BUG 2 — `processor.go`: Verificação de crescimento de arquivo não implementada

**Arquivo:** `services/ocr-worker/internal/processor/processor.go:116`

O doc especifica (step 3 do fluxo):
> "Verifica se arquivo ainda cresceu → se sim, aguarda mais"

O código atual apenas dorme 3s fixos e segue em frente. Se o arquivo SFTP ainda estiver sendo transferido, o OCR lerá um PDF incompleto/corrompido.

**Solução:** Verificar tamanho do arquivo antes e depois do sleep:

```go
func waitForFileStable(filePath string, timeout time.Duration) error {
    deadline := time.Now().Add(timeout)
    var prevSize int64 = -1
    for time.Now().Before(deadline) {
        info, err := os.Stat(filePath)
        if err != nil {
            return err
        }
        if info.Size() == prevSize {
            return nil // estável
        }
        prevSize = info.Size()
        time.Sleep(3 * time.Second)
    }
    return fmt.Errorf("arquivo não estabilizou em %v", timeout)
}
```

Usar com timeout de ~30s:
```go
if err := waitForFileStable(filePath, 30*time.Second); err != nil {
    log.Printf("Arquivo instável: %v", err)
    return
}
```

---

### BUG 3 — `processor.go`: `updateScanError` usa path incorreto

**Arquivo:** `services/ocr-worker/internal/processor/processor.go:250-255`

```go
// ERRADO — scanID não tem relação com o caminho do arquivo
p.moveToError(ctx, fmt.Sprintf("%s/%s", p.cfg.SFTPScanBaseDir, scanID), errorMsg)
```

O path construído (`basedir/scanID`) nunca vai existir. O arquivo original não é movido para `_error/` em caso de falha — fica no diretório de entrada e seria processado novamente ou ficaria perdido.

**Solução:** Passar `filePath` original como parâmetro:

```go
func (p *Processor) updateScanError(ctx context.Context, scanID, filePath, errorMsg string) {
    errorMsgP := errorMsg
    processedAt := time.Now()
    p.db.UpdateScanStatus(ctx, scanID, "ERROR", "", &processedAt, &errorMsgP)
    p.moveToError(ctx, filePath, errorMsg)
}
```

Atualizar todas as chamadas em `processFile()` para passar `filePath`.

---

### BUG 4 — `ocr/pdf.go`: `-singlefile` processa apenas a primeira página

**Arquivo:** `services/ocr-worker/internal/ocr/pdf.go:23`

O flag `-singlefile` do `pdftoppm` limita a conversão à primeira página do PDF. Para documentos hospitalares com múltiplas páginas (ex: exame de 3 páginas), o OCR só vê a página 1.

**Solução:** Remover `-singlefile` e usar glob para coletar todas as páginas geradas:

```go
func (c *PDFConverter) ConvertToImages(pdfPath string) ([]string, error) {
    tmpDir, err := os.MkdirTemp("", "ocr-*")
    if err != nil {
        return nil, fmt.Errorf("failed to create temp dir: %w", err)
    }

    outputPrefix := filepath.Join(tmpDir, "page")

    cmd := exec.Command(
        "pdftoppm",
        "-r", fmt.Sprintf("%d", c.dpi),
        "-png",
        pdfPath,
        outputPrefix, // sem -singlefile
    )
    output, err := cmd.CombinedOutput()
    if err != nil {
        os.RemoveAll(tmpDir)
        return nil, fmt.Errorf("failed to convert pdf: %w\n%s", err, output)
    }

    matches, err := filepath.Glob(outputPrefix + "-*.png")
    if err != nil || len(matches) == 0 {
        os.RemoveAll(tmpDir)
        return nil, fmt.Errorf("no pages generated from PDF")
    }
    sort.Strings(matches)
    return matches, nil
}

func (c *PDFConverter) CleanupImages(imagePaths []string) {
    if len(imagePaths) == 0 {
        return
    }
    // Remove o tmpDir inteiro
    os.RemoveAll(filepath.Dir(imagePaths[0]))
}
```

> Usar `os.MkdirTemp` isola as imagens de cada PDF em diretório próprio — evita colisão entre scanners simultâneos.

---

### BUG 5 — Tesseract não é thread-safe: um único client para todo o processo

**Arquivo:** `services/ocr-worker/internal/ocr/tesseract.go` e `processor/processor.go`

O `gosseract.Client` chama `libtesseract` via CGO. A biblioteca C **não é thread-safe** quando múltiplas goroutines chamam o mesmo client ao mesmo tempo. Com `go p.handleNewFile(...)` sem proteção, dois PDFs chegando juntos causam corrompimento de estado ou panic.

**Solução:** Usar um semáforo (canal bufferizado) para limitar paralelismo a 1 (ou N conforme CPU):

```go
type Processor struct {
    // ... campos existentes ...
    sem chan struct{} // semáforo de concorrência
}

func NewProcessor(...) (*Processor, error) {
    // ...
    return &Processor{
        // ...
        sem: make(chan struct{}, 1), // 1 = serial, 2 = paralelo c/ 2 instâncias Tesseract
    }, nil
}

func (p *Processor) handleNewFile(ctx context.Context, filePath string) {
    // ... verificações iniciais ...
    
    p.sem <- struct{}{}        // adquire slot
    defer func() { <-p.sem }() // libera slot ao terminar
    
    if err := p.processFile(ctx, filePath, sftpDir); err != nil {
        log.Printf("Error processing file: %v", err)
    }
}
```

Para suportar N paralelos com segurança, criar N instâncias de `Tesseract` (pool) ao invés de uma só.

---

## Problemas menores

### MENOR 1 — `processor.go`: Não monitora novos subdirectórios criados após o start

Se uma nova impressora for cadastrada e seu diretório SFTP criado depois que o worker já iniciou, nenhum arquivo dessa impressora será detectado até o próximo restart.

**Solução:** Observar também o diretório base (`SFTPScanBaseDir`) e, ao detectar criação de subdirectório, adicioná-lo ao watcher:

```go
case event, ok := <-p.watcher.Events:
    if event.Op&fsnotify.Create == fsnotify.Create {
        info, err := os.Stat(event.Name)
        if err == nil && info.IsDir() {
            p.watcher.Add(event.Name)
            log.Printf("New directory detected, now watching: %s", event.Name)
        } else {
            go p.handleNewFile(ctx, event.Name)
        }
    }
```

Adicionar o diretório base ao watcher no `Start()`:
```go
p.watcher.Add(p.cfg.SFTPScanBaseDir)
```

---

### MENOR 2 — `processor.go`: Sem proteção contra processar o mesmo arquivo duas vezes

Alguns sistemas de arquivos (especialmente via rede/SFTP) podem disparar múltiplos eventos `Create` para o mesmo arquivo. Sem deduplicação, o arquivo seria inserido duas vezes no banco.

**Solução:** Usar um mapa de arquivos em processamento protegido por mutex:

```go
type Processor struct {
    // ...
    inProgress sync.Map // key: filePath, value: struct{}
}

func (p *Processor) handleNewFile(ctx context.Context, filePath string) {
    if _, loaded := p.inProgress.LoadOrStore(filePath, struct{}{}); loaded {
        log.Printf("Already processing: %s, skipping", filePath)
        return
    }
    defer p.inProgress.Delete(filePath)
    // ... continua processamento ...
}
```

---

### MENOR 3 — `storage/minio.go`: método `UploadBuffer` não compila

**Arquivo:** `services/ocr-worker/internal/storage/minio.go:51`

```go
// ERRO DE COMPILAÇÃO — minio.NewReader não existe na API minio-go v7
func (m *MinIO) UploadBuffer(...) error {
    _, err := m.client.PutObject(ctx, m.bucket, key, minio.NewReader(buffer, ...))
```

O método `UploadBuffer` não é usado em lugar nenhum. Ou remover ou corrigir usando `bytes.NewReader`:

```go
import "bytes"

func (m *MinIO) UploadBuffer(ctx context.Context, key string, buffer []byte, contentType string) error {
    reader := bytes.NewReader(buffer)
    _, err := m.client.PutObject(ctx, m.bucket, key, reader, int64(len(buffer)),
        minio.PutObjectOptions{ContentType: contentType},
    )
    return err
}
```

---

### MENOR 4 — Docker Compose: falta healthcheck no `ocr-worker`

O serviço `ocr-worker` não tem healthcheck. Como é um daemon que não expõe HTTP, o healthcheck pode verificar se o processo Go ainda está rodando.

**Adicionar ao `docker-compose.yml`:**
```yaml
ocr-worker:
  # ... configurações existentes ...
  healthcheck:
    test: ["CMD", "pgrep", "ocr-worker"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

---

### MENOR 5 — Prisma: migration `add_scan_metadata` precisa ser rodada

O schema já está correto, mas a migration precisa ser executada:

```bash
cd apps/api
npx prisma migrate dev --name add_scan_metadata
```

---

## Checklist de correções por prioridade

### Alta prioridade (corrigir antes de qualquer teste)
- [ ] BUG 3: Corrigir `updateScanError` para usar `filePath` correto
- [ ] BUG 4: Remover `-singlefile` do `pdftoppm` para processar PDFs multi-página
- [ ] BUG 1 + BUG 5: Processar arquivos em goroutines com semáforo para não bloquear o loop e proteger o Tesseract
- [ ] BUG 2: Implementar verificação de estabilidade do arquivo antes de processar

### Média prioridade (antes de produção)
- [ ] MENOR 1: Monitorar novos subdirectórios dinamicamente
- [ ] MENOR 2: Deduplicação com `sync.Map` para evitar processar mesmo arquivo duas vezes
- [ ] MENOR 3: Corrigir ou remover `UploadBuffer`

### Baixa prioridade
- [ ] MENOR 4: Adicionar healthcheck no Docker Compose
- [ ] MENOR 5: Confirmar que a migration foi executada

---

## Diagrama do fluxo correto de concorrência

```
fsnotify loop (goroutine única)
  │
  ├─ evento Create (arquivo PDF)
  │     └─► go handleNewFile()  ◄── goroutine separada (não bloqueia o loop)
  │               │
  │               ├─ LoadOrStore(filePath)  ◄── dedup: evita duplo processamento
  │               ├─ waitForFileStable()   ◄── espera arquivo terminar de chegar
  │               ├─ sem <- struct{}{}     ◄── adquire semáforo (limita paralelismo)
  │               ├─ processFile()         ◄── OCR + DB + MinIO
  │               └─ <-sem                ◄── libera semáforo
  │
  └─ evento Create (novo diretório)
        └─► watcher.Add(dir)  ◄── monitora nova impressora sem restart
```
