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
		sem:       make(chan struct{}, 1),
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

	ocrText, err := p.extractText(ctx, scanID, filePath, fileName)
	if err != nil {
		return err
	}

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

func (p *Processor) extractText(ctx context.Context, scanID, filePath, fileName string) (string, error) {
	text, err := p.converter.ExtractTextDirect(filePath)
	if err == nil && text != "" {
		log.Printf("[%s] direct text extraction succeeded (%d bytes)", fileName, len(text))
		return text, nil
	}
	if err != nil {
		log.Printf("[%s] pdftotext failed, falling back to OCR: %v", fileName, err)
	} else {
		log.Printf("[%s] no embedded text found, falling back to OCR", fileName)
	}

	imagePaths, err := p.converter.ConvertToImages(filePath)
	if err != nil {
		log.Printf("Failed to convert PDF: %v", err)
		p.updateScanError(ctx, scanID, filePath, err.Error())
		return "", err
	}
	defer p.converter.CleanupImages(imagePaths)

	ocrText, err := p.tesseract.ProcessImages(imagePaths)
	if err != nil {
		log.Printf("Failed to process OCR: %v", err)
		p.updateScanError(ctx, scanID, filePath, err.Error())
		return "", err
	}

	log.Printf("[%s] OCR text extracted (%d bytes)", fileName, len(ocrText))
	return ocrText, nil
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