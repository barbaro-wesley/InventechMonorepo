package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/inventech/ocr-worker/internal/config"
	"github.com/inventech/ocr-worker/internal/db"
	"github.com/inventech/ocr-worker/internal/processor"
	"github.com/inventech/ocr-worker/internal/storage"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if present
	godotenv.Load()

	cfg := config.Load()

	log.Printf("Connecting to PostgreSQL: %s", cfg.PostgresDSN[:20]+"...")
	database, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Println("Connected to PostgreSQL")

	log.Printf("Connecting to MinIO: %s", cfg.MinIOEndpoint)
	stor, err := storage.NewMinIO(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to MinIO: %v", err)
	}
	log.Println("Connected to MinIO")

	ctx := context.Background()
	
	proc, err := processor.NewProcessor(cfg, database, stor)
	if err != nil {
		log.Fatalf("Failed to create processor: %v", err)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutting down...")
		proc.Close()
		os.Exit(0)
	}()

	log.Println("Starting OCR Worker...")
	if err := proc.Start(ctx); err != nil {
		log.Fatalf("Processor error: %v", err)
	}
}