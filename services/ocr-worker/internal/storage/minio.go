package storage

import (
	"bytes"
	"context"
	"fmt"

	"github.com/inventech/ocr-worker/internal/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIO struct {
	client *minio.Client
	bucket string
}

func NewMinIO(cfg *config.Config) (*MinIO, error) {
	endpoint := cfg.MinIOEndpoint
	useSSL := cfg.MinIOUseSSL

	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	return &MinIO{
		client: minioClient,
		bucket: cfg.MinIOBucket,
	}, nil
}

func (m *MinIO) BucketExists(ctx context.Context) (bool, error) {
	return m.client.BucketExists(ctx, m.bucket)
}

func (m *MinIO) MakeBucket(ctx context.Context) error {
	return m.client.MakeBucket(ctx, m.bucket, minio.MakeBucketOptions{})
}

func (m *MinIO) UploadFile(ctx context.Context, key string, filePath string, fileSize int64, contentType string) error {
	_, err := m.client.FPutObject(ctx, m.bucket, key, filePath, minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

func (m *MinIO) UploadBuffer(ctx context.Context, key string, buffer []byte, contentType string) error {
	reader := bytes.NewReader(buffer)
	_, err := m.client.PutObject(ctx, m.bucket, key, reader, int64(len(buffer)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	return err
}

func (m *MinIO) RemoveObject(ctx context.Context, key string) error {
	return m.client.RemoveObject(ctx, m.bucket, key, minio.RemoveObjectOptions{})
}

func (m *MinIO) GetBucket() string {
	return m.bucket
}