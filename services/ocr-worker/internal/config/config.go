package config

import (
	"os"
	"strconv"
)

type Config struct {
	PostgresDSN      string
	MinIOEndpoint     string
	MinIOAccessKey   string
	MinIOSecretKey   string
	MinIOUseSSL       bool
	MinIOBucket      string
	SFTPScanBaseDir  string
	OCRLang          string
	OCRDPI           int
}

func Load() *Config {
	return &Config{
		PostgresDSN:     getEnv("POSTGRES_DSN", "postgres://user:pass@postgres:5432/dbname"),
		MinIOEndpoint:   getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinIOAccessKey:  getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey:  getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinIOUseSSL:     getEnvBool("MINIO_USE_SSL", false),
		MinIOBucket:     getEnv("MINIO_BUCKET", "scans"),
		SFTPScanBaseDir: getEnv("SFTP_SCAN_BASE_DIR", "/srv/scans/incoming"),
		OCRLang:         getEnv("OCR_LANG", "por"),
		OCRDPI:          getEnvInt("OCR_DPI", 300),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		return value == "true" || value == "1"
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}