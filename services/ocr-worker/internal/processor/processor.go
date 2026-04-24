package processor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
	sem        chan struct{}
	inProgress sync.Map
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
		sem:       make(chan struct{}, 3),
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
	if err := p.watcher.Add(p.cfg.SFTPScanBaseDir); err != nil {
		log.Printf("Warning: failed to watch base dir %s: %v", p.cfg.SFTPScanBaseDir, err)
	}

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
					log.Printf("New directory detected, watching: %s", event.Name)
					p.watcher.Add(event.Name)
				} else {
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

	if _, loaded := p.inProgress.LoadOrStore(filePath, struct{}{}); loaded {
		log.Printf("Already processing, skipping: %s", filePath)
		return
	}
	defer p.inProgress.Delete(filePath)

	log.Printf("New file detected: %s", filePath)

	if err := waitForFileStable(filePath, 30*time.Second); err != nil {
		log.Printf("File did not stabilize, skipping: %s — %v", filePath, err)
		return
	}

	sftpDir := filepath.Base(filepath.Dir(filePath))

	p.sem <- struct{}{}
	defer func() { <-p.sem }()

	if err := p.processFile(ctx, filePath, sftpDir); err != nil {
		log.Printf("Error processing file %s: %v", filePath, err)
	}
}

func waitForFileStable(filePath string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var prevSize int64 = -1

	for time.Now().Before(deadline) {
		info, err := os.Stat(filePath)
		if err != nil {
			return fmt.Errorf("file disappeared: %w", err)
		}
		if info.Size() == prevSize {
			return nil
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

	extracted, err := p.extractData(filePath, fileName)
	if err != nil {
		return err
	}

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

	p.notifyAPI(ctx, scanID, printer.CompanyID, "PROCESSED")

	return nil
}

// notifyAPI chama o webhook da API NestJS para acionar o evento WebSocket.
// Falhas são apenas logadas — não interrompem o fluxo.
func (p *Processor) notifyAPI(ctx context.Context, scanID, companyID, status string) {
	if p.cfg.WebhookURL == "" || p.cfg.WebhookSecret == "" {
		return
	}

	payload, _ := json.Marshal(map[string]string{
		"scanId":    scanID,
		"companyId": companyID,
		"status":    status,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.cfg.WebhookURL, bytes.NewReader(payload))
	if err != nil {
		log.Printf("Webhook: failed to build request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-webhook-secret", p.cfg.WebhookSecret)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Webhook: request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("Webhook: unexpected status %d for scan %s", resp.StatusCode, scanID)
		return
	}

	log.Printf("Webhook: notified API for scan %s [%s]", scanID, status)
}

const maxPages = 20 // limite de segurança para PDFs muito grandes

// extractData processa o PDF página a página e para assim que encontrar
// os dados do paciente, evitando OCR desnecessário nas páginas restantes.
func (p *Processor) extractData(filePath, fileName string) (*extractor.ExtractedData, error) {
	result := &extractor.ExtractedData{}

	for page := 1; page <= maxPages; page++ {
		// ── 1. Tenta extração direta do texto embutido ────────────────────────
		text, err := p.converter.ExtractTextDirectPage(filePath, page)
		if err != nil {
			// pdftotext falhou nesta página — tenta OCR diretamente
			log.Printf("[%s] pdftotext page %d failed, trying OCR: %v", fileName, page, err)
		} else if text != "" {
			found := p.extractor.ExtractInto(result, text)
			log.Printf("[%s] page %d: direct text (%d bytes), paciente=%v", fileName, page, len(text), result.Paciente != nil)
			if found {
				log.Printf("[%s] paciente encontrado na página %d via texto direto — parando", fileName, page)
				return result, nil
			}
			// Tem texto mas não achou paciente — continua para próxima página
			continue
		} else {
			// Página vazia no texto direto = fim do PDF (todas as páginas foram processadas)
			// ou PDF sem camada de texto — neste caso tenta OCR nesta página
			log.Printf("[%s] page %d: sem texto embutido, tentando OCR", fileName, page)
		}

		// ── 2. Fallback OCR para esta página ─────────────────────────────────
		imagePath, cleanup, err := p.converter.ConvertPageToImage(filePath, page)
		if err != nil {
			// Página não existe (além do final do PDF) — encerra loop
			log.Printf("[%s] page %d: não foi possível converter — fim do PDF ou erro: %v", fileName, page, err)
			break
		}

		ocrText, err := p.tesseract.ProcessImage(imagePath)
		cleanup()

		if err != nil {
			log.Printf("[%s] page %d: OCR falhou: %v", fileName, page, err)
			continue
		}

		found := p.extractor.ExtractInto(result, ocrText)
		log.Printf("[%s] page %d: OCR (%d bytes), paciente=%v", fileName, page, len(ocrText), result.Paciente != nil)
		if found {
			log.Printf("[%s] paciente encontrado na página %d via OCR — parando", fileName, page)
			return result, nil
		}
	}

	return result, nil
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