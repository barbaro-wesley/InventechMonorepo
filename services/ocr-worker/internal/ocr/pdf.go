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