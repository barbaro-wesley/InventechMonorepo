import re
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Padrões regex calibrados para os documentos do ERP do Hospital Cristo
# Redentor (HCR): Prescrição Médica, Ficha de Exame e Boletim de Atendimento.
#
# Lógica de parada (usada pelo processor/_extract_sync):
#   - extract_into retorna True quando a página atual sozinha contribuiu >= 3
#     campos → sinal para parar e não varrer páginas seguintes.
#   - Se nenhuma página sozinha atingiu 3 campos, o processor continua
#     acumulando via extract_into e ao final aceita se filled_count >= 2.
#   - Isso evita tanto paradas prematuras (resultado pobre) quanto varreduras
#     desnecessárias de documentos com cabeçalho rico na primeira página.
# ---------------------------------------------------------------------------

_PATTERN_PACIENTE = re.compile(
    r"(?i)"
    r"(?:Nome(?:\s+do\s+Paciente)?|Paciente)"
    r"[\s\:\.\;\-]+"
    r"([A-Za-zÀ-Úà-ú][A-Za-zÀ-Úà-ú \.'\-]*[A-Za-zÀ-Úà-ú])"
    r"(?=\t|\s{2,}|\n|\r|$)"
)

_PATTERN_CPF = re.compile(
    r"(?i)CPF[\s\:\.\;\-]*(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})"
)

_PATTERN_PRONTUARIO = re.compile(
    r"(?i)(?:Prontu[aá]rio|Pront\.?|N[oº]?\s*Prontu[aá]rio)"
    r"[\s\:\.\;\-]+"
    r"([A-Za-z0-9\-\.]*\d+[A-Za-z0-9\-\.]*)"
)

# N.Intern, R.A. e Atendimento são sinônimos — o ERP usa os três nomes:
#   N.Intern / No Intern / Nº Internação → Prescrição Médica
#   R.A. / Registro de Atendimento       → Ficha de Exame
#   Atendimento / No Atendimento         → Boletim de Atendimento
_PATTERN_NUMERO_ATENDIMENTO = re.compile(
    r"(?i)(?:"
    r"R\.?\s*A\.?"
    r"|Registro\s*(?:de\s*)?Atendimento"
    r"|N[oº\.]?\s*Intern(?:[oa]|[oa]ção)?"
    r"|N[oº\.]?\s*Atendimento"
    r"|N[úu]mero(?:\s*Interno|(?:\s*de\s*)?Atendimento)?"
    r"|N[úu]m\.?\s*Intern[oa]?"
    r"|Atendimento"
    r")[\s\:\.\;\-]+"
    r"([A-Za-z0-9\-\.]*\d+[A-Za-z0-9\-\.]*)"
)

_NORMALIZE_CPF = re.compile(r"[.\s\-]")

# Campos mínimos para parar imediatamente ao processar uma página.
_STOP_THRESHOLD = 3

# Campos mínimos para considerar o resultado válido ao final de todas as páginas.
_MIN_CONFIDENT = 2


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
        """True se o resultado acumulado tem campos suficientes para persistir."""
        return self.filled_count >= _MIN_CONFIDENT

    @property
    def filled_count(self) -> int:
        """Número de campos preenchidos (0–4)."""
        return sum(
            v is not None
            for v in (self.paciente, self.cpf, self.prontuario, self.numero_atendimento)
        )


class Extractor:
    def extract(self, text: str) -> ExtractedData:
        """Extrai todos os campos de um bloco de texto e retorna um novo ExtractedData."""
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
        """Preenche apenas os campos nulos em dst com o que for encontrado em text.

        Retorna True se a página atual sozinha contribuiu >= _STOP_THRESHOLD campos
        para dst — sinal para o processor parar e não varrer páginas seguintes.

        O processor deve checar dst.is_confident ao final do loop para decidir
        se o resultado acumulado (possivelmente de várias páginas) é válido.
        """
        src = self.extract(text)

        gained = 0
        if dst.paciente is None and src.paciente is not None:
            dst.paciente = src.paciente
            gained += 1
        if dst.cpf is None and src.cpf is not None:
            dst.cpf = src.cpf
            gained += 1
        if dst.prontuario is None and src.prontuario is not None:
            dst.prontuario = src.prontuario
            gained += 1
        if dst.numero_atendimento is None and src.numero_atendimento is not None:
            dst.numero_atendimento = src.numero_atendimento
            gained += 1

        # Para imediatamente se esta página sozinha trouxe campos suficientes.
        return gained >= _STOP_THRESHOLD