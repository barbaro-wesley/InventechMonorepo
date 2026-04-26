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

	if match := e.patterns["paciente"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		if value != "" {
			data.Paciente = &value
		}
	}

	if match := e.patterns["cpf"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		value = normalizeCPF(value)
		if value != "" {
			data.CPF = &value
		}
	}

	if match := e.patterns["prontuario"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		if value != "" {
			data.Prontuario = &value
		}
	}

	if match := e.patterns["numero_atendimento"].FindStringSubmatch(text); len(match) > 1 {
		value := strings.TrimSpace(match[1])
		if value != "" {
			data.NumeroAtendimento = &value
		}
	}

	return data
}

// ExtractInto preenche apenas os campos ainda nulos em dst a partir de text.
// Retorna true se dst passou a ter dados de paciente após a operação.
func (e *Extractor) ExtractInto(dst *ExtractedData, text string) bool {
	src := e.Extract(text)
	if dst.Paciente == nil {
		dst.Paciente = src.Paciente
	}
	if dst.CPF == nil {
		dst.CPF = src.CPF
	}
	if dst.Prontuario == nil {
		dst.Prontuario = src.Prontuario
	}
	if dst.NumeroAtendimento == nil {
		dst.NumeroAtendimento = src.NumeroAtendimento
	}
	return dst.Paciente != nil
}

// HasPatientData retorna true quando pelo menos o nome do paciente foi encontrado.
// Esse é o critério de parada antecipada — dados secundários são bonus.
func (d *ExtractedData) HasPatientData() bool {
	return d.Paciente != nil
}

func normalizeCPF(cpf string) string {
	re := regexp.MustCompile(`[\.\s\-]`)
	return re.ReplaceAllString(cpf, "")
}