# Prompt para OpenCode — Corrigir OCR Worker (Go)

## Contexto

Temos um serviço Go em `services/ocr-worker/` que monitora uma pasta SFTP via fsnotify, converte PDFs em imagens com `pdftoppm`, roda OCR com Tesseract, extrai campos via regex e salva no PostgreSQL + MinIO. O código já existe mas tem bugs críticos de concorrência e lógica. Corrija **todos** os problemas descritos abaixo sem mudar a estrutura de arquivos existente.

---

## Arquivos a corrigir

### 1. `services/ocr-worker/internal/ocr/pdf.go` — PDF multi-página

**Problema:** O flag `-singlefile` no `pdftoppm` limita a conversão à **primeira página** do PDF. Documentos com múltiplas páginas têm OCR incompleto.

**Corrija assim:**
- Remover o flag `-singlefile`
- Usar `os.MkdirTemp("", "ocr-*")` como diretório de saída isolado (evita colisão entre processamentos paralelos)
- Usar `filepath.Glob` para coletar todas as páginas geradas (`page-*.png`), ordenadas
- `CleanupImages` deve remover o diretório temporário inteiro (`os.RemoveAll` no dir pai)

```go
package ocr

import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "sort"
)

type PDFConverter struct {
    dpi int
}

func NewPDFConverter(dpi int) *PDFConverter {
    return &PDFConverter{dpi: dpi}
}

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
        outputPrefix,
    )
    output, err := cmd.CombinedOutput()
    if err != nil {
        os.RemoveAll(tmpDir)
        return nil, fmt.Errorf("failed to convert pdf: %w\n%s", err, output)
    }

    matches, err := filepath.Glob(outputPrefix + "-*.png")
    if err != nil || len(matches) == 0 {
        os.RemoveAll(tmpDir)
        return nil, fmt.Errorf("no pages generated from PDF at %s", pdfPath)
    }

    sort.Strings(matches)
    return matches, nil
}

func (c *PDFConverter) CleanupImages(imagePaths []string) {
    if len(imagePaths) == 0 {
        return
    }
    os.RemoveAll(filepath.Dir(imagePaths[0]))
}
```

---

### 2. `services/ocr-worker/internal/storage/minio.go` — compilação quebrada

**Problema:** `UploadBuffer` usa `minio.NewReader` que não existe na API do minio-go v7. O método não é usado mas impede compilação.

**Corrija:** Substituir pela implementação correta com `bytes.NewReader`:

```go
func (m *MinIO) UploadBuffer(ctx context.Context, key string, buffer []byte, contentType string) error {
    reader := bytes.NewReader(buffer)
    _, err := m.client.PutObject(ctx, m.bucket, key, reader, int64(len(buffer)),
        minio.PutObjectOptions{ContentType: contentType},
    )
    return err
}
```

Adicionar `"bytes"` nos imports.

---

### 3. `services/ocr-worker/internal/processor/processor.go` — reescrever com todos os fixes

Este arquivo tem **4 bugs críticos e 2 menores** — reescreva-o completamente com as seguintes correções:

#### BUG A — `handleNewFile` bloqueia o loop de eventos
`handleNewFile` é chamado diretamente no loop do fsnotify, bloqueando com `time.Sleep(3s)` + OCR (minutos). Arquivos chegando nesse intervalo são ignorados.
**Fix:** Chamar `go p.handleNewFile(ctx, event.Name)` (goroutine separada).

#### BUG B — Sem verificação de crescimento do arquivo
O código dorme 3s fixos. Se o SFTP ainda estiver transferindo, processa PDF corrompido.
**Fix:** Implementar `waitForFileStable(path, timeout)` que verifica se o tamanho parou de crescer (polling a cada 3s, timeout de 30s).

#### BUG C — Tesseract não é thread-safe
Um único `gosseract.Client` é compartilhado. Com múltiplas goroutines, corrompe estado interno da lib C.
**Fix:** Adicionar campo `sem chan struct{}` (semáforo de capacidade 1) no `Processor`. Adquirir antes de `processFile`, liberar com `defer`.

#### BUG D — `updateScanError` usa path incorreto
```go
// ERRADO — scanID não é o path do arquivo
p.moveToError(ctx, fmt.Sprintf("%s/%s", p.cfg.SFTPScanBaseDir, scanID), errorMsg)
```
**Fix:** Adicionar parâmetro `filePath string` em `updateScanError` e passá-lo para `moveToError`.

#### MENOR E — Não monitora novos subdirectórios
Se uma nova impressora for adicionada após o start, seus arquivos nunca são detectados.
**Fix:** No `Start()`, adicionar também `p.cfg.SFTPScanBaseDir` ao watcher. No loop de eventos, quando o evento Create for um diretório, chamar `p.watcher.Add(event.Name)` ao invés de tentar processar como PDF.

#### MENOR F — Sem deduplicação
Eventos Create duplicados do fsnotify causariam dois scans do mesmo arquivo.
**Fix:** Usar `sync.Map` como `inProgress`. Usar `LoadOrStore` no início de `handleNewFile`; se já existe, retornar imediatamente. Remover com `defer` ao terminar.

**Código completo do processor.go corrigido:**

```go
package processor

import (
    "context"
    "fmt"
    "log"
    "os"
    "path/filepath"
    "strings"
    "sync"
    "time"

    "github.com/fsnotify/fsnotify"
    "github.com/google/uuid"

    "github.com/inventech/ocr-worker/internal/config"
    "github.com/inventech/ocr-worker/internal/db"
    "github.com/inventech/ocr-worker/internal/extractor"
    "github.com/inventech/ocr-worker/internal/ocr"
    "github.com/inventech/ocr-worker/internal/storage"
)

type Processor struct {
    cfg        *config.Config
    db         *db.DB
    storage    *storage.MinIO
    watcher    *fsnotify.Watcher
    converter  *ocr.PDFConverter
    tesseract  *ocr.Tesseract
    extractor  *extractor.Extractor
    sem        chan struct{}   // limita paralelismo do Tesseract (não thread-safe)
    inProgress sync.Map       // deduplicação por filePath
}

func NewProcessor(cfg *config.Config, database *db.DB, stor *storage.MinIO) (*Processor, error) {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return nil, fmt.Errorf("failed to create watcher: %w", err)
    }

    converter := ocr.NewPDFConverter(cfg.OCRDPI)
    tesseract, err := ocr.NewTesseract(cfg.OCRLang)
    if err != nil {
        watcher.Close()
        return nil, err
    }

    extr := extractor.NewExtractor()

    return &Processor{
        cfg:       cfg,
        db:        database,
        storage:   stor,
        watcher:   watcher,
        converter: converter,
        tesseract: tesseract,
        extractor: extr,
        sem:       make(chan struct{}, 1), // 1 = serial (Tesseract não é thread-safe)
    }, nil
}

func (p *Processor) Close() {
    if p.watcher != nil {
        p.watcher.Close()
    }
    if p.tesseract != nil {
        p.tesseract.Close()
    }
    p.db.Close()
}

func (p *Processor) Start(ctx context.Context) error {
    // Observa o diretório base para detectar novos subdirectórios (novas impressoras)
    if err := p.watcher.Add(p.cfg.SFTPScanBaseDir); err != nil {
        log.Printf("Warning: failed to watch base dir %s: %v", p.cfg.SFTPScanBaseDir, err)
    }

    // Observa os subdirectórios já existentes
    entries, err := os.ReadDir(p.cfg.SFTPScanBaseDir)
    if err != nil {
        return fmt.Errorf("failed to read scan directory: %w", err)
    }

    for _, entry := range entries {
        if entry.IsDir() {
            dirPath := filepath.Join(p.cfg.SFTPScanBaseDir, entry.Name())
            log.Printf("Watching directory: %s", dirPath)
            if err := p.watcher.Add(dirPath); err != nil {
                log.Printf("Warning: failed to watch %s: %v", dirPath, err)
            }
        }
    }

    log.Printf("OCR Worker started, watching: %s", p.cfg.SFTPScanBaseDir)

    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case event, ok := <-p.watcher.Events:
            if !ok {
                continue
            }
            if event.Op&fsnotify.Create == fsnotify.Create {
                info, err := os.Stat(event.Name)
                if err != nil {
                    continue
                }
                if info.IsDir() {
                    // Nova impressora adicionada: começar a monitorar sem restart
                    log.Printf("New directory detected, watching: %s", event.Name)
                    p.watcher.Add(event.Name)
                } else {
                    // Novo arquivo: processar em goroutine separada (não bloqueia o loop)
                    go p.handleNewFile(ctx, event.Name)
                }
            }
        case err, ok := <-p.watcher.Errors:
            if !ok {
                continue
            }
            log.Printf("Watcher error: %v", err)
        }
    }
}

func (p *Processor) handleNewFile(ctx context.Context, filePath string) {
    if !strings.HasSuffix(strings.ToLower(filePath), ".pdf") {
        return
    }

    // Deduplicação: evita processar o mesmo arquivo duas vezes
    if _, loaded := p.inProgress.LoadOrStore(filePath, struct{}{}); loaded {
        log.Printf("Already processing, skipping: %s", filePath)
        return
    }
    defer p.inProgress.Delete(filePath)

    log.Printf("New file detected: %s", filePath)

    // Aguarda o arquivo estabilizar (término da transferência SFTP)
    if err := waitForFileStable(filePath, 30*time.Second); err != nil {
        log.Printf("File did not stabilize, skipping: %s — %v", filePath, err)
        return
    }

    sftpDir := filepath.Base(filepath.Dir(filePath))

    // Adquire semáforo: Tesseract (CGO) não é thread-safe
    p.sem <- struct{}{}
    defer func() { <-p.sem }()

    if err := p.processFile(ctx, filePath, sftpDir); err != nil {
        log.Printf("Error processing file %s: %v", filePath, err)
    }
}

// waitForFileStable espera até o arquivo parar de crescer ou timeout ser atingido.
func waitForFileStable(filePath string, timeout time.Duration) error {
    deadline := time.Now().Add(timeout)
    var prevSize int64 = -1

    for time.Now().Before(deadline) {
        info, err := os.Stat(filePath)
        if err != nil {
            return fmt.Errorf("file disappeared: %w", err)
        }
        if info.Size() == prevSize {
            return nil // tamanho estável
        }
        prevSize = info.Size()
        time.Sleep(3 * time.Second)
    }
    return fmt.Errorf("file not stable after %v", timeout)
}

func (p *Processor) processFile(ctx context.Context, filePath, sftpDirectory string) error {
    printer, err := p.db.FindPrinterBySftpDirectory(ctx, sftpDirectory)
    if err != nil {
        log.Printf("Printer not found for directory: %s", sftpDirectory)
        return p.moveToError(filePath, "printer not found")
    }

    fileName := filepath.Base(filePath)
    scanID := uuid.New().String()

    fileInfo, err := os.Stat(filePath)
    if err != nil {
        return fmt.Errorf("failed to stat file: %w", err)
    }

    mimeType := detectMimeType(fileName)
    sizeBytes := int(fileInfo.Size())

    now := time.Now()
    scan := &db.Scan{
        ID:        scanID,
        CompanyID: printer.CompanyID,
        PrinterID: printer.ID,
        FileName:  fileName,
        StoredKey: "",
        Bucket:    p.storage.GetBucket(),
        MimeType:  mimeType,
        SizeBytes: sizeBytes,
        Status:    "PENDING",
        ScannedAt: now,
    }

    if err := p.db.InsertScan(ctx, scan); err != nil {
        return fmt.Errorf("failed to insert scan: %w", err)
    }

    imagePaths, err := p.converter.ConvertToImages(filePath)
    if err != nil {
        log.Printf("Failed to convert PDF: %v", err)
        p.updateScanError(ctx, scanID, filePath, err.Error())
        return err
    }
    defer p.converter.CleanupImages(imagePaths)

    ocrText, err := p.tesseract.ProcessImages(imagePaths)
    if err != nil {
        log.Printf("Failed to process OCR: %v", err)
        p.updateScanError(ctx, scanID, filePath, err.Error())
        return err
    }

    log.Printf("[DEBUG] OCR text (%d bytes) for %s:\n%s", len(ocrText), fileName, ocrText)

    extracted := p.extractor.Extract(ocrText)

    ocrStatus := "FAILED"
    if extracted.Paciente != nil || extracted.CPF != nil || extracted.Prontuario != nil || extracted.NumeroAtendimento != nil {
        ocrStatus = "SUCCESS"
    }

    storedKey := fmt.Sprintf("%s/%s/%s/%s", printer.CompanyID, printer.ID, scanID, fileName)
    if err := p.storage.UploadFile(ctx, storedKey, filePath, fileInfo.Size(), mimeType); err != nil {
        log.Printf("Failed to upload to MinIO: %v", err)
        p.updateScanError(ctx, scanID, filePath, err.Error())
        return err
    }

    processedAt := time.Now()
    if err := p.db.UpdateScanStatus(ctx, scanID, "PROCESSED", storedKey, &processedAt, nil); err != nil {
        return fmt.Errorf("failed to update scan: %w", err)
    }

    metadata := &db.ScanMetadata{
        ID:                uuid.New().String(),
        ScanID:            scanID,
        OcrStatus:         ocrStatus,
        Paciente:          extracted.Paciente,
        CPF:               extracted.CPF,
        Prontuario:        extracted.Prontuario,
        NumeroAtendimento: extracted.NumeroAtendimento,
        ExtractedAt:       &processedAt,
    }

    if err := p.db.InsertScanMetadata(ctx, metadata); err != nil {
        log.Printf("Failed to insert metadata: %v", err)
    }

    os.Remove(filePath)

    log.Printf("Successfully processed scan: %s [ocr_status=%s, printer=%s]", fileName, ocrStatus, printer.Name)

    return nil
}

func (p *Processor) moveToError(filePath, errorMsg string) error {
    errorDir := filepath.Join(filepath.Dir(filePath), "..", "_error")
    os.MkdirAll(errorDir, 0755)

    newPath := filepath.Join(errorDir, filepath.Base(filePath))
    if err := os.Rename(filePath, newPath); err != nil {
        log.Printf("Failed to move file to error dir: %v", err)
    }
    return nil
}

func (p *Processor) updateScanError(ctx context.Context, scanID, filePath, errorMsg string) {
    errorMsgP := errorMsg
    processedAt := time.Now()
    p.db.UpdateScanStatus(ctx, scanID, "ERROR", "", &processedAt, &errorMsgP)
    p.moveToError(filePath, errorMsg)
}

func detectMimeType(fileName string) string {
    ext := strings.ToLower(filepath.Ext(fileName))
    switch ext {
    case ".pdf":
        return "application/pdf"
    case ".jpg", ".jpeg":
        return "image/jpeg"
    case ".png":
        return "image/png"
    case ".tif", ".tiff":
        return "image/tiff"
    default:
        return "application/octet-stream"
    }
}
```

---

### 4. `apps/api/docker-compose.yml` — adicionar healthcheck no ocr-worker

Dentro do serviço `ocr-worker`, adicionar após `networks`:

```yaml
    healthcheck:
      test: ["CMD", "pgrep", "ocr-worker"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

---

## Resumo das mudanças

| Arquivo | O que muda |
|---------|-----------|
| `internal/ocr/pdf.go` | Remove `-singlefile`, usa tmpDir isolado, processa todas as páginas |
| `internal/storage/minio.go` | Corrige `UploadBuffer` com `bytes.NewReader` |
| `internal/processor/processor.go` | Reescrita completa: goroutines, semáforo, deduplicação, verificação de estabilidade, path correto no `updateScanError`, watch de novos dirs |
| `apps/api/docker-compose.yml` | Adiciona healthcheck no `ocr-worker` |

**Não alterar:** `config/config.go`, `db/db.go`, `extractor/extractor.go`, `ocr/tesseract.go`, `cmd/worker/main.go`, `Dockerfile`, `.env.example`.
