package extractor

import (
	"regexp"
	"strings"
)

type ExtractedData struct {
	Paciente          *string
	CPF              *string
	Prontuario        *string
	NumeroAtendimento *string
}

type Extractor struct {
	patterns map[string]*regexp.Regexp
}

func NewExtractor() *Extractor {
	return &Extractor{
		patterns: map[string]*regexp.Regexp{
			"paciente":          regexp.MustCompile(`(?i)Paciente:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+)`),
			"cpf":              regexp.MustCompile(`(?i)CPF[:\s]+(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})`),
			"prontuario":         regexp.MustCompile(`(?i)Prontu[aá]rio[:\s]+(\d+)`),
			"numero_atendimento": regexp.MustCompile(`(?i)(?:R\.A\.|Atendimento)[:\s]+(\d+)`),
		},
	}
}

func (e *Extractor) Extract(text string) *ExtractedData {
	data := &ExtractedData{}

	// Extrai paciente
	if match := e.patterns["paciente"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		if value != "" {
			data.Paciente = &value
		}
	}

	// Extrai CPF
	if match := e.patterns["cpf"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		value = normalizeCPF(value)
		if value != "" {
			data.CPF = &value
		}
	}

	// Extrai prontuário
	if match := e.patterns["prontuario"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		if value != "" {
			data.Prontuario = &value
		}
	}

	// Extrai número de atendimento
	if match := e.patterns["numero_atendimento"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		if value != "" {
			data.NumeroAtendimento = &value
		}
	}

	return data
}

func normalizeCPF(cpf string) string {
	re := regexp.MustCompile(`[\.\s\-]`)
	return re.ReplaceAllString(cpf, "")
}