package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type PDFConverter struct {
	dpi int
}

func NewPDFConverter(dpi int) *PDFConverter {
	return &PDFConverter{dpi: dpi}
}

func (c *PDFConverter) ConvertToImages(pdfPath string) ([]string, error) {
	outputDir := filepath.Dir(pdfPath)
	baseName := filepath.Base(pdfPath)
	baseName = baseName[:len(baseName)-4] // Remove .pdf extension

	cmd := exec.Command(
		"pdftoppm",
		"-r", fmt.Sprintf("%d", c.dpi),
		"-png",
		"-singlefile",
		pdfPath,
		filepath.Join(outputDir, baseName),
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to convert pdf: %w\n%s", err, output)
	}

	// pdftoppm outputs the first page as <baseName>-0001.png
	imagePath := filepath.Join(outputDir, baseName+"-0001.png")
	if _, err := os.Stat(imagePath); err != nil {
		return nil, fmt.Errorf("failed to find converted image: %w", err)
	}

	return []string{imagePath}, nil
}

func (c *PDFConverter) CleanupImages(imagePaths []string) {
	for _, path := range imagePaths {
		os.Remove(path)
	}
}