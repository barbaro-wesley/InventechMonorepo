# UI Spec — Gerenciamento de Impressoras & Scans

---

## 1. Página: Impressoras (`/printers`)

### Layout geral
Seguir o mesmo padrão das outras páginas do sistema (equipamentos, ordens de serviço).

### Cabeçalho da página
- Título: **"Impressoras"**
- Botão primário: **"+ Nova Impressora"** (abre drawer lateral)
- Filtros inline:
  - Dropdown **Centro de Custo** (busca `GET /cost-centers`)
  - Toggle **Somente ativas**

### Listagem (tabela)

| Coluna | Dados |
|---|---|
| Nome | `printer.name` |
| IP | `printer.ipAddress` |
| Marca / Modelo | `printer.brand` + `printer.model` |
| Centro de Custo | `printer.costCenter.name` + badge com `code` |
| Scans | `printer._count.scans` (número com ícone) |
| Status | Badge **Ativa** (verde) / **Inativa** (cinza) |
| Ações | Ícones: Editar · Desativar/Ativar · Excluir |

### Ação de linha — clique na linha
Abre um **drawer de detalhes** com:
- Dados completos da impressora
- Card destacado **"Configuração SFTP"** com fundo diferenciado:
  ```
  Host:             192.168.0.70
  Porta:            22
  Usuário:          scanner
  Diretório remoto: /incoming/brother-rh
  ```
  Botão **"Copiar configuração"** (copia tudo em formato texto)
- Aba **"Scans recentes"** com os últimos 10 scans dessa impressora

---

## 2. Drawer: Nova Impressora / Editar

### Campos do formulário

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| Nome | Text | Sim | Ex: "Brother RH" |
| IP da Impressora | Text | Sim | Validar formato IP |
| Marca | Text | Não | Ex: Brother, Samsung |
| Modelo | Text | Não | Ex: L6902DW |
| Centro de Custo | Select (busca) | Não | `GET /cost-centers` |
| Observações | Textarea | Não | |

### Após criar (resposta da API)
Exibir um **modal/alerta de sucesso** com o card SFTP:
```
Impressora cadastrada!

Configure o seguinte no painel da impressora:

  Protocolo:  SFTP
  Host:       192.168.0.70
  Porta:      22
  Usuário:    scanner
  Diretório:  /incoming/brother-rh

[Copiar] [Fechar]
```
> Esse modal é importante — é a única vez que o usuário vê o diretório gerado de forma destacada.

---

## 3. Página: Scans (`/scans`)

### Cabeçalho
- Título: **"Digitalizações"**
- Filtros:
  - Select **Impressora** (lista `GET /printers`)
  - Select **Status** (`PENDING` / `PROCESSED` / `ERROR`)
  - Date range (scannedAt)

### Listagem (tabela)

| Coluna | Dados |
|---|---|
| Arquivo | Ícone PDF/imagem + `scan.fileName` |
| Impressora | `scan.printer.name` |
| Centro de Custo | `scan.printer.costCenter.name` |
| Tamanho | `scan.sizeBytes` formatado (KB/MB) |
| Status | Badge colorido: Processado (verde) / Pendente (amarelo) / Erro (vermelho) |
| Data | `scan.scannedAt` formatado |
| Ações | Download · Excluir |

### Ação Download
`GET /scans/:id/download` → redireciona para presigned URL (abre o arquivo direto).

### Badge de Erro
Ao hover no badge **Erro**, exibir tooltip com `scan.errorMsg`.

---

## 4. Permissões — o que mostrar por role

| Elemento | SA | CA | CM | TEC |
|---|---|---|---|---|
| Menu "Impressoras" | ✓ | ✓ | ✓ | — |
| Botão "Nova Impressora" | ✓ | ✓ | — | — |
| Editar impressora | ✓ | ✓ | ✓ | — |
| Excluir impressora | ✓ | ✓ | — | — |
| Menu "Digitalizações" | ✓ | ✓ | ✓ | ✓ |
| Botão Download | ✓ | ✓ | ✓ | ✓ |
| Excluir scan | ✓ | ✓ | ✓ | — |

---

## 5. Navegação

Adicionar no menu lateral (sidebar), dentro de um grupo novo ou junto com Equipamentos:

```
Impressoras       → /printers
Digitalizações    → /scans
```

---

## 6. Endpoints utilizados pela UI

| Ação | Endpoint |
|---|---|
| Listar impressoras | `GET /printers?isActive=true&costCenterId=...` |
| Detalhe + sftpConfig | `GET /printers/:id` |
| Criar | `POST /printers` |
| Editar | `PATCH /printers/:id` |
| Excluir | `DELETE /printers/:id` |
| Listar centros de custo | `GET /cost-centers` |
| Listar scans | `GET /scans?printerId=...&status=...` |
| Download scan | `GET /scans/:id/download` |
| Excluir scan | `DELETE /scans/:id` |
