package processor

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
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
	cfg      *config.Config
	db       *db.DB
	storage  *storage.MinIO
	watcher  *fsnotify.Watcher
	converter *ocr.PDFConverter
	tesseract *ocr.Tesseract
	extractor *extractor.Extractor
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
		cfg:      cfg,
		db:       database,
		storage:  stor,
		watcher:  watcher,
		converter: converter,
		tesseract: tesseract,
		extractor: extr,
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
	// Add all subdirectories in scan base dir
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
				p.handleNewFile(ctx, event.Name)
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
	// Check if it's a PDF
	if !strings.HasSuffix(strings.ToLower(filePath), ".pdf") {
		return
	}

	log.Printf("New file detected: %s", filePath)

	// Wait for file to stabilize (3 seconds)
	time.Sleep(3 * time.Second)

	// Check if file still exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Printf("File no longer exists: %s", filePath)
		return
	}

	// Get sftp directory from path
	sftpDir := filepath.Base(filepath.Dir(filePath))

	// Process the file
	if err := p.processFile(ctx, filePath, sftpDir); err != nil {
		log.Printf("Error processing file: %v", err)
	}
}

func (p *Processor) processFile(ctx context.Context, filePath, sftpDirectory string) error {
	// Lookup printer
	printer, err := p.db.FindPrinterBySftpDirectory(ctx, sftpDirectory)
	if err != nil {
		log.Printf("Printer not found for directory: %s", sftpDirectory)
		return p.moveToError(ctx, filePath, "printer not found")
	}

	fileName := filepath.Base(filePath)
	scanID := uuid.New().String()

	// Get file info
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	}

	mimeType := detectMimeType(fileName)
	sizeBytes := int(fileInfo.Size())

	// Insert scan with PENDING
	now := time.Now()
	scan := &db.Scan{
		ID:          scanID,
		CompanyID:   printer.CompanyID,
		PrinterID:  printer.ID,
		FileName:   fileName,
		StoredKey:  "",
		Bucket:    p.storage.GetBucket(),
		MimeType:  mimeType,
		SizeBytes: sizeBytes,
		Status:    "PENDING",
		ScannedAt: now,
	}

	if err := p.db.InsertScan(ctx, scan); err != nil {
		return fmt.Errorf("failed to insert scan: %w", err)
	}

	// Convert PDF to images
	imagePaths, err := p.converter.ConvertToImages(filePath)
	if err != nil {
		log.Printf("Failed to convert PDF: %v", err)
		p.updateScanError(ctx, scanID, err.Error())
		return err
	}
	defer p.converter.CleanupImages(imagePaths)

	// Run OCR
	ocrText, err := p.tesseract.ProcessImages(imagePaths)
	if err != nil {
		log.Printf("Failed to process OCR: %v", err)
		p.updateScanError(ctx, scanID, err.Error())
		return err
	}

	log.Printf("OCR text length: %d bytes", len(ocrText))

	// Extract fields
	extracted := p.extractor.Extract(ocrText)

	// Determine OCR status
	ocrStatus := "FAILED"
	if extracted.Paciente != nil || extracted.CPF != nil || extracted.Prontuario != nil || extracted.NumeroAtendimento != nil {
		ocrStatus = "SUCCESS"
	}

	// Upload to MinIO
	storedKey := fmt.Sprintf("%s/%s/%s/%s", printer.CompanyID, printer.ID, scanID, fileName)
	if err := p.storage.UploadFile(ctx, storedKey, filePath, fileInfo.Size(), mimeType); err != nil {
		log.Printf("Failed to upload to MinIO: %v", err)
		p.updateScanError(ctx, scanID, err.Error())
		return err
	}

	// Update scan status
	processedAt := time.Now()
	if err := p.db.UpdateScanStatus(ctx, scanID, "PROCESSED", storedKey, &processedAt, nil); err != nil {
		return fmt.Errorf("failed to update scan: %w", err)
	}

	// Insert scan metadata
	metadata := &db.ScanMetadata{
		ID:                uuid.New().String(),
		ScanID:            scanID,
		OcrStatus:         ocrStatus,
		Paciente:          extracted.Paciente,
		CPF:              extracted.CPF,
		Prontuario:        extracted.Prontuario,
		NumeroAtendimento: extracted.NumeroAtendimento,
		ExtractedAt:      &processedAt,
	}

	if err := p.db.InsertScanMetadata(ctx, metadata); err != nil {
		log.Printf("Failed to insert metadata: %v", err)
	}

	// Delete local file
	os.Remove(filePath)

	log.Printf("Successfully processed scan: %s [%s]", fileName, printer.Name)

	return nil
}

func (p *Processor) moveToError(ctx context.Context, filePath, errorMsg string) error {
	errorDir := filepath.Join(filepath.Dir(filePath), "..", "_error")
	os.MkdirAll(errorDir, 0755)
	
	newPath := filepath.Join(errorDir, filepath.Base(filePath))
	if err := os.Rename(filePath, newPath); err != nil {
		log.Printf("Failed to move file to error: %v", err)
	}
	
	return nil
}

func (p *Processor) updateScanError(ctx context.Context, scanID, errorMsg string) {
	errorMsgP := errorMsg
	processedAt := time.Now()
	p.db.UpdateScanStatus(ctx, scanID, "ERROR", "", &processedAt, &errorMsgP)
	p.moveToError(ctx, fmt.Sprintf("%s/%s", p.cfg.SFTPScanBaseDir, scanID), errorMsg)
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