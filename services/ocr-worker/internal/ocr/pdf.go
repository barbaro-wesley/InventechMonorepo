package ocr

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
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

// ExtractTextDirect extracts the embedded text layer from a searchable PDF using pdftotext.
// Returns an empty string (no error) if the PDF has no text layer.
func (c *PDFConverter) ExtractTextDirect(pdfPath string) (string, error) {
	cmd := exec.Command("pdftotext", "-layout", "-enc", "UTF-8", pdfPath, "-")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("pdftotext failed: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

// ExtractTextDirectPage extracts embedded text from a single page (1-based).
// Returns ("", nil) when the page is beyond the last page of the PDF.
func (c *PDFConverter) ExtractTextDirectPage(pdfPath string, page int) (string, error) {
	p := strconv.Itoa(page)
	cmd := exec.Command("pdftotext", "-f", p, "-l", p, "-layout", "-enc", "UTF-8", pdfPath, "-")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("pdftotext page %d failed: %w", page, err)
	}
	return strings.TrimSpace(string(output)), nil
}

// ConvertPageToImage converts a single PDF page (1-based) to a PNG file.
// Returns the image path and a cleanup function. The caller must call cleanup() when done.
func (c *PDFConverter) ConvertPageToImage(pdfPath string, page int) (imagePath string, cleanup func(), err error) {
	tmpDir, err := os.MkdirTemp("", "ocr-page-*")
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temp dir: %w", err)
	}

	p := strconv.Itoa(page)
	outputPrefix := filepath.Join(tmpDir, "page")
	cmd := exec.Command(
		"pdftoppm",
		"-f", p, "-l", p,
		"-r", strconv.Itoa(c.dpi),
		"-png",
		pdfPath,
		outputPrefix,
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		os.RemoveAll(tmpDir)
		return "", nil, fmt.Errorf("pdftoppm page %d failed: %w\n%s", page, err, output)
	}

	matches, err := filepath.Glob(outputPrefix + "-*.png")
	if err != nil || len(matches) == 0 {
		os.RemoveAll(tmpDir)
		return "", nil, fmt.Errorf("no image generated for page %d", page)
	}

	return matches[0], func() { os.RemoveAll(tmpDir) }, nil
}