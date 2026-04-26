package db

import (
	"context"
	"fmt"
	"time"

	"github.com/inventech/ocr-worker/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	pool *pgxpool.Pool
}

type Printer struct {
	ID        string
	CompanyID string
	Name     string
	SftpDirectory string
}

type Scan struct {
	ID          string
	CompanyID  string
	PrinterID  string
	FileName   string
	StoredKey  string
	Bucket    string
	MimeType  string
	SizeBytes int
	Status    string
	ErrorMsg  *string
	ScannedAt time.Time
	ProcessedAt *time.Time
}

type ScanMetadata struct {
	ID                string
	ScanID            string
	OcrStatus         string
	Paciente          *string
	CPF               *string
	Prontuario        *string
	NumeroAtendimento *string
	ExtractedAt      *time.Time
}

func Connect(cfg *config.Config) (*DB, error) {
	ctx := context.Background()
	
	poolConfig, err := pgxpool.ParseConfig(cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("failed to parse postgres dsn: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	return &DB{pool: pool}, nil
}

func (db *DB) Close() {
	db.pool.Close()
}

func (db *DB) FindPrinterBySftpDirectory(ctx context.Context, sftpDirectory string) (*Printer, error) {
	query := `
		SELECT id, company_id, name, sftp_directory 
		FROM printers 
		WHERE sftp_directory = $1 AND is_active = true AND deleted_at IS NULL
		LIMIT 1
	`

	var printer Printer
	err := db.pool.QueryRow(ctx, query, sftpDirectory).Scan(
		&printer.ID,
		&printer.CompanyID,
		&printer.Name,
		&printer.SftpDirectory,
	)
	if err != nil {
		return nil, err
	}
	return &printer, nil
}

func (db *DB) InsertScan(ctx context.Context, scan *Scan) error {
	query := `
		INSERT INTO scans (id, company_id, printer_id, file_name, stored_key, bucket, mime_type, size_bytes, status, scanned_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := db.pool.Exec(ctx, query,
		scan.ID,
		scan.CompanyID,
		scan.PrinterID,
		scan.FileName,
		scan.StoredKey,
		scan.Bucket,
		scan.MimeType,
		scan.SizeBytes,
		scan.Status,
		scan.ScannedAt,
	)
	return err
}

func (db *DB) UpdateScanStatus(ctx context.Context, id, status string, storedKey string, processedAt *time.Time, errorMsg *string) error {
	query := `
		UPDATE scans 
		SET status = $2, stored_key = $3, processed_at = $4, error_msg = $5
		WHERE id = $1
	`

	_, err := db.pool.Exec(ctx, query, id, status, storedKey, processedAt, errorMsg)
	return err
}

func (db *DB) InsertScanMetadata(ctx context.Context, metadata *ScanMetadata) error {
	query := `
		INSERT INTO scan_metadata (id, scan_id, ocr_status, paciente, cpf, prontuario, numero_atendimento, extracted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := db.pool.Exec(ctx, query,
		metadata.ID,
		metadata.ScanID,
		metadata.OcrStatus,
		metadata.Paciente,
		metadata.CPF,
		metadata.Prontuario,
		metadata.NumeroAtendimento,
		metadata.ExtractedAt,
	)
	return err
}