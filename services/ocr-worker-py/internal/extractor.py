import re
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Padrões regex calibrados para os documentos do ERP do Hospital Cristo
# Redentor (HCR): Prescrição Médica, Ficha de Exame e Boletim de Atendimento.
#
# Mudanças em relação à versão anterior:
#
# 1. _PATTERN_NUMERO_ATENDIMENTO — adicionado suporte a "N.Intern" (ponto de
#    abreviação) que os documentos de Prescrição Médica usam no cabeçalho.
#    O padrão anterior só cobria "No Intern" / "Nº Intern" (o/º), não o ponto.
#    Também coberto: N.Atendimento, Nº Atendimento, R.A., RA, Registro de
#    Atendimento, Atendimento, Número Interno, Número de Atendimento.
#
# 2. _PATTERN_PACIENTE — separador agora exige ao menos um caractere de
#    pontuação (:) para evitar falsos positivos ("Responsável: O paciente"
#    no Boletim de Atendimento). A lógica de parada (\s{2,}|\n|\r|$) é
#    mantida, o que corta corretamente antes do próximo campo na mesma linha.
#
# 3. _PATTERN_CPF — sem alteração; funcionou em todos os formatos testados
#    (com e sem máscara, com e sem espaços).
#
# 4. _PATTERN_PRONTUARIO — sem alteração; funcionou em todos os formatos
#    testados (com espaço e sem espaço após o rótulo).
#
# 5. ExtractedData.is_confident — nova propriedade que retorna True quando
#    pelo menos 2 campos foram extraídos com sucesso. Use isso para decidir
#    se o resultado é confiável antes de persistir no ERP.
# ---------------------------------------------------------------------------

_PATTERN_PACIENTE = re.compile(
    r"(?i)"
    r"(?:Nome(?:\s+do\s+Paciente)?|Paciente)"   # rótulo
    r"\s*[\:\.\;\-]\s*"                          # separador obrigatório (evita "O paciente")
    r"([A-Za-zÀ-Úà-ú][A-Za-zÀ-Úà-ú\s\.\'\-]+?)"
    r"(?=\s{2,}|\n|\r|$)"                        # para antes de espaços duplos ou quebra
)

_PATTERN_CPF = re.compile(
    r"(?i)CPF[\s\:\.\;\-]*(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})"
)

_PATTERN_PRONTUARIO = re.compile(
    r"(?i)(?:Prontu[aá]rio|Pront\.?|N[oº]?\s*Prontu[aá]rio)"
    r"[\s\:\.\;\-]+"
    r"([A-Za-z0-9\-\.]*\d+[A-Za-z0-9\-\.]*)"
)

# Cobre todos os formatos encontrados nos documentos HCR:
#   N.Intern  → Prescrição Médica (ponto de abreviação)
#   No Intern / Nº Intern / Nº Internação → variantes escritas por extenso
#   Atendimento / No Atendimento / N.Atendimento → Boletim de Atendimento
#   R.A. / RA → Ficha de Exame (Registro de Atendimento)
#   Número Interno / Número de Atendimento → variantes longas
_PATTERN_NUMERO_ATENDIMENTO = re.compile(
    r"(?i)(?:"
    r"R\.?\s*A\.?"                                           # R.A. / RA
    r"|Registro\s*(?:de\s*)?Atendimento"                     # Registro de Atendimento
    r"|N[oº\.]?\s*Intern(?:[oa]|[oa]ção)?"                  # N.Intern / No Interno / Nº Internação
    r"|N[oº\.]?\s*Atendimento"                              # No Atendimento / N.Atendimento
    r"|N[úu]mero(?:\s*Interno|(?:\s*de\s*)?Atendimento)?"   # Número Interno / Número de Atendimento
    r"|N[úu]m\.?\s*Intern[oa]?"                             # Num. Interno
    r"|Atendimento"                                          # Atendimento (standalone no Boletim)
    r")[\s\:\.\;\-]+"
    r"([A-Za-z0-9\-\.]*\d+[A-Za-z0-9\-\.]*)"
)

_NORMALIZE_CPF = re.compile(r"[.\s\-]")


@dataclass
class ExtractedData:
    paciente: Optional[str] = field(default=None)
    cpf: Optional[str] = field(default=None)
    prontuario: Optional[str] = field(default=None)
    numero_atendimento: Optional[str] = field(default=None)

    @property
    def has_patient_data(self) -> bool:
        """Retrocompatível: True se o nome do paciente foi extraído."""
        return self.paciente is not None

    @property
    def is_confident(self) -> bool:
        """True se pelo menos 2 campos foram extraídos com sucesso.
        Use este flag para decidir se o resultado é confiável antes de
        persistir no ERP (equivale ao requisito de ≥ 2 dados)."""
        filled = sum(
            v is not None
            for v in (self.paciente, self.cpf, self.prontuario, self.numero_atendimento)
        )
        return filled >= 2

    @property
    def filled_count(self) -> int:
        """Número de campos extraídos."""
        return sum(
            v is not None
            for v in (self.paciente, self.cpf, self.prontuario, self.numero_atendimento)
        )


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
        """Preenche apenas os campos nulos em dst a partir de text.
        Retorna True quando dst.is_confident (≥ 2 campos preenchidos)."""
        src = self.extract(text)
        if dst.paciente is None:
            dst.paciente = src.paciente
        if dst.cpf is None:
            dst.cpf = src.cpf
        if dst.prontuario is None:
            dst.prontuario = src.prontuario
        if dst.numero_atendimento is None:
            dst.numero_atendimento = src.numero_atendimento
        return dst.is_confident