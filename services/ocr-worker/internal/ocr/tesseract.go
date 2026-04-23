package ocr

import (
	"fmt"

	goss "github.com/otiai10/gosseract/v2"
)

type Tesseract struct {
	client *goss.Client
}

func NewTesseract(lang string) (*Tesseract, error) {
	client := goss.NewClient()
	if err := client.SetLanguage(lang); err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to set language: %w", err)
	}

	return &Tesseract{client: client}, nil
}

func (t *Tesseract) ProcessImage(imagePath string) (string, error) {
	if err := t.client.SetImage(imagePath); err != nil {
		return "", fmt.Errorf("failed to set image: %w", err)
	}

	text, err := t.client.Text()
	if err != nil {
		return "", fmt.Errorf("failed to process image: %w", err)
	}

	return text, nil
}

func (t *Tesseract) ProcessImages(imagePaths []string) (string, error) {
	var result string
	for _, imagePath := range imagePaths {
		text, err := t.ProcessImage(imagePath)
		if err != nil {
			return "", err
		}
		result += text + "\n"
	}
	return result, nil
}

func (t *Tesseract) Close() {
	if t.client != nil {
		t.client.Close()
	}
}