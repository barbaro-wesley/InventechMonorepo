import re
from dataclasses import dataclass, field
from typing import Optional

# Mirrors the regex patterns from the Go extractor (internal/extractor/extractor.go)
_PATTERN_PACIENTE = re.compile(r"(?i)Paciente:\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+)")
_PATTERN_CPF = re.compile(r"(?i)CPF[:\s]+(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})")
_PATTERN_PRONTUARIO = re.compile(r"(?i)Prontu[aá]rio[:\s]+(\d+)")
_PATTERN_NUMERO_ATENDIMENTO = re.compile(r"(?i)(?:R\.A\.|Atendimento)[:\s]+(\d+)")
_NORMALIZE_CPF = re.compile(r"[.\s\-]")


@dataclass
class ExtractedData:
    paciente: Optional[str] = field(default=None)
    cpf: Optional[str] = field(default=None)
    prontuario: Optional[str] = field(default=None)
    numero_atendimento: Optional[str] = field(default=None)

    @property
    def has_patient_data(self) -> bool:
        return self.paciente is not None


class Extractor:
    def extract(self, text: str) -> ExtractedData:
        data = ExtractedData()

        if m := _PATTERN_PACIENTE.search(text):
            value = m.group(1).strip()
            if value:
                data.paciente = value

        if m := _PATTERN_CPF.search(text):
            value = _NORMALIZE_CPF.sub("", m.group(1).strip())
            if value:
                data.cpf = value

        if m := _PATTERN_PRONTUARIO.search(text):
            value = m.group(1).strip()
            if value:
                data.prontuario = value

        if m := _PATTERN_NUMERO_ATENDIMENTO.search(text):
            value = m.group(1).strip()
            if value:
                data.numero_atendimento = value

        return data

    def extract_into(self, dst: ExtractedData, text: str) -> bool:
        """Fills only null fields in dst from text. Returns True once dst has patient data."""
        src = self.extract(text)
        if dst.paciente is None:
            dst.paciente = src.paciente
        if dst.cpf is None:
            dst.cpf = src.cpf
        if dst.prontuario is None:
            dst.prontuario = src.prontuario
        if dst.numero_atendimento is None:
            dst.numero_atendimento = src.numero_atendimento
        return dst.paciente is not None
