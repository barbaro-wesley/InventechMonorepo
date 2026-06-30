import { Injectable } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CompaniesService } from '../companies/companies.service'
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface'

// Tipos de filtro para os relatórios

export interface ReportTemplate {
  companyName: string
  document: string | null
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  headerTitle: string
  footerText: string
  email: string
  phone: string
  address: string
}

export interface ReportFilters {
  clientId?: string
  groupId?: string
  technicianId?: string
  /** Comma-separated status values */
  status?: string
  /** Comma-separated priority values */
  priority?: string
  /** Comma-separated maintenance type values */
  maintenanceType?: string
  /** Which date field to filter: 'createdAt' | 'startedAt' | 'completedAt' | 'approvedAt' */
  dateField?: string
  dateFrom?: string
  dateTo?: string
  /** Group rows by: 'status' | 'priority' | 'maintenanceType' | 'client' | 'group' | 'technician' */
  groupBy?: string
}

export interface EquipmentReportFilters {
  status?: string
  criticality?: string
  typeId?: string
  locationId?: string
  costCenterId?: string
  /** 'status' | 'criticality' | 'type' | 'location' | 'costCenter' */
  groupBy?: string
  /** 'name' | 'status' | 'criticality' | 'type' | 'costCenter' — secondary sort within groups (or primary when no grouping) */
  orderBy?: string
  columns?: string[]
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
  ) { }

  // ─────────────────────────────────────────
  // Helpers compartilhados
  // ─────────────────────────────────────────

  /** Baixa o logo da empresa como Buffer (PNG/JPG). Retorna null se falhar. */
  private async fetchLogoBuffer(logoUrl: string | null): Promise<Buffer | null> {
    if (!logoUrl) return null
    try {
      const { default: https } = await import('https')
      const { default: http } = await import('http')
      return await new Promise<Buffer>((resolve, reject) => {
        const lib = logoUrl.startsWith('https') ? https : http
        lib.get(logoUrl, (res) => {
          if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }).on('error', reject)
      })
    } catch {
      return null
    }
  }

  /**
   * Desenha o cabeçalho corporativo no PDF (síncrono — logo já é Buffer).
   *
   *  ┌── accent bar (3pt, primaryColor) ──────────────────────────────────────────┐
   *  │                                                                            │
   *  │  [LOGO]   NOME DA EMPRESA (15pt bold, escuro)    ┌── report panel ──────┐ │
   *  │           CNPJ: XX.XXX.XXX/0001-XX               │ TÍTULO RELATÓRIO     │ │ ← primaryColor
   *  │           Rua X, 123 · Bairro · Cidade/UF        │ 04/04/2026           │ │
   *  │                                                   └─────────────────────┘ │
   *  │                                                                            │
   *  └── separator (0.75pt, slate) ───────────────────────────────────────────────┘
   *
   * Retorna a posição Y logo após o cabeçalho (início da tabela de dados).
   */
  private drawPdfHeader(
    doc: any,
    template: ReportTemplate,
    title: string,
    subtitle: string,
    logoBuffer: Buffer | null,
  ): number {
    const ML = 40
    const W = doc.page.width - 80
    const TOP = 18

    // ── Accent bar ─────────────────────────────────────────
    doc.rect(ML, TOP, W, 3).fill(template.primaryColor)

    const bodyTop = TOP + 3 + 10
    const subParts = subtitle.split(/[·]/).map((s) => s.trim()).filter(Boolean)
    const BODY_H = Math.max(80, 32 + Math.max(3, subParts.length) * 11 + 8)
    const LOGO_SIZE = 62

    // ── Proporções: 62% empresa · 38% painel relatório ──────
    const INFO_W = Math.floor(W * 0.62)
    const PANEL_GAP = 14
    const panelX = ML + INFO_W + PANEL_GAP
    const panelW = W - INFO_W - PANEL_GAP

    // ── Logo ────────────────────────────────────────────────
    let nameX = ML
    if (logoBuffer) {
      try {
        const ly = bodyTop + Math.floor((BODY_H - LOGO_SIZE) / 2)
        doc.image(logoBuffer, ML, ly, { fit: [LOGO_SIZE, LOGO_SIZE] })
        nameX = ML + LOGO_SIZE + 12
      } catch { /* formato não suportado */ }
    }

    // ── Identidade da empresa ────────────────────────────────
    const tW = INFO_W - (nameX - ML) - 8
    let ty = bodyTop + 10

    // Nome
    doc.fillColor('#0F172A').fontSize(15).font('Helvetica-Bold')
      .text(template.companyName, nameX, ty, { width: tW, lineBreak: false, ellipsis: true })
    ty += 20

    // CNPJ
    if (template.document) {
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
        .text(`CNPJ: ${template.document}`, nameX, ty, { width: tW, lineBreak: false })
      ty += 13
    }

    // Endereço (pode ter 1 ou 2 linhas — limitamos a 1 com ellipsis)
    if (template.address) {
      const lines = template.address.split(' · ')
      const line1 = lines.slice(0, 2).join(' · ')
      const line2 = lines.slice(2).join(' · ')
      doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
        .text(line1, nameX, ty, { width: tW, lineBreak: false, ellipsis: !line2 })
      if (line2) {
        ty += 11
        doc.text(line2, nameX, ty, { width: tW, lineBreak: false, ellipsis: true })
      }
    }

    // ── Painel do relatório (fundo primaryColor, lado direito) ─
    doc.rect(panelX, bodyTop, panelW, BODY_H).fill(template.primaryColor)

    // Barra lateral interna de destaque (secondaryColor, 3pt)
    doc.rect(panelX, bodyTop, 3, BODY_H).fill(template.secondaryColor)

    // Cores de texto calculadas automaticamente pelo contraste do fundo
    const panelTextColor = this.getContrastColor(template.primaryColor)
    const panelSubColor = panelTextColor === '#FFFFFF' ? '#CBD5E1' : '#6B7280'

    // Título do relatório (em caixa alta)
    const pTextX = panelX + 14
    const pTextW = panelW - 20
    doc.fillColor(panelTextColor).fontSize(9.5).font('Helvetica-Bold')
      .text(title.toUpperCase(), pTextX, bodyTop + 14, { width: pTextW, lineBreak: true })

    // Subtítulo — quebramos por · e exibimos uma linha por item
    let sy = bodyTop + 14 + 18
    subParts.forEach((part) => {
      if (sy < bodyTop + BODY_H - 8) {
        doc.fillColor(panelSubColor).fontSize(7.5).font('Helvetica')
          .text(part, pTextX, sy, { width: pTextW, lineBreak: false })
        sy += 11
      }
    })

    // ── Separator ────────────────────────────────────────────
    const endY = bodyTop + BODY_H + 10
    doc.rect(ML, endY, W, 0.75).fill('#CBD5E1')

    return endY + 8
  }

  /**
   * Desenha o rodapé corporativo na posição Y indicada.
   */
  private drawPdfFooter(doc: any, template: ReportTemplate, y: number): void {
    const ML = 40
    const W = doc.page.width - 80

    // Temporarily disable auto-page creation — writing text near the bottom
    // margin causes PDFKit to auto-create blank pages.
    const _origAddPage = doc.addPage
    doc.addPage = function () { return this }

    doc.rect(ML, y, W, 0.5).fill('#E2E8F0')
    const parts = [template.companyName, template.footerText].filter(Boolean).join('  ·  ')
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
      .text(parts, ML, y + 5, { width: W / 2, lineBreak: false, ellipsis: true })
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    doc.text(`Emitido em ${now}`, ML, y + 5, { width: W - 4, align: 'right', lineBreak: false })

    doc.addPage = _origAddPage
  }

  // ─────────────────────────────────────────
  // Contraste automático de texto (WCAG)
  // ─────────────────────────────────────────

  /** Retorna '#FFFFFF' para fundos escuros e '#1F2937' para fundos claros. */
  private getContrastColor(hex: string): string {
    const h = hex.replace('#', '')
    if (h.length !== 6) return '#FFFFFF'
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const toLinear = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
    return L > 0.179 ? '#1F2937' : '#FFFFFF'
  }

  /** Versão ARGB para ExcelJS (ex: 'FFFFFFFF' ou 'FF1F2937'). */
  private getContrastArgb(hex: string): string {
    return this.getContrastColor(hex) === '#FFFFFF' ? 'FFFFFFFF' : 'FF1F2937'
  }

  // ─────────────────────────────────────────
  // Usuários distintos vinculados a alguma OS
  // ─────────────────────────────────────────
  async getServiceOrderAssignees(companyId: string) {
    const rows = await this.prisma.serviceOrderTechnician.findMany({
      where: { serviceOrder: { companyId, deletedAt: null } },
      select: { technician: { select: { id: true, name: true } } },
      distinct: ['technicianId'],
      orderBy: { technician: { name: 'asc' } },
    })
    return rows.map((r) => r.technician)
  }

  // ─────────────────────────────────────────
  // Busca dados das OS para os relatórios
  // ─────────────────────────────────────────
  async getServiceOrdersData(companyId: string, filters: ReportFilters) {
    const dateField = ['startedAt', 'completedAt', 'approvedAt'].includes(filters.dateField ?? '')
      ? filters.dateField!
      : 'createdAt'

    const statuses = filters.status?.split(',').map((s) => s.trim()).filter(Boolean)
    const priorities = filters.priority?.split(',').map((s) => s.trim()).filter(Boolean)
    const maintTypes = filters.maintenanceType?.split(',').map((s) => s.trim()).filter(Boolean)

    const where: any = {
      companyId,
      deletedAt: null,
      ...(filters.clientId && { clientId: filters.clientId }),
      ...(filters.groupId && { groupId: filters.groupId }),
      ...(statuses?.length && { status: { in: statuses as any[] } }),
      ...(priorities?.length && { priority: { in: priorities as any[] } }),
      ...(maintTypes?.length && { maintenanceType: { in: maintTypes as any[] } }),
      ...((filters.dateFrom || filters.dateTo) && {
        [dateField]: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
        },
      }),
      ...(filters.technicianId && {
        technicians: { some: { technicianId: filters.technicianId } },
      }),
    }

    return this.prisma.serviceOrder.findMany({
      where,
      select: {
        number: true,
        title: true,
        maintenanceType: true,
        status: true,
        priority: true,
        resolution: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        approvedAt: true,
        client: { select: { name: true } },
        equipment: { select: { name: true, brand: true, model: true, serialNumber: true } },
        group: { select: { name: true } },
        requester: { select: { name: true } },
        technicians: {
          where: { releasedAt: null },
          select: { role: true, technician: { select: { name: true } } },
        },
      },
      orderBy: { number: 'asc' },
    })
  }

  // ─────────────────────────────────────────
  // Gera Excel (XLSX) das OS
  // ─────────────────────────────────────────
  async exportServiceOrdersExcel(companyId: string, filters: ReportFilters): Promise<Buffer> {
    const ExcelJS = await import('exceljs')
    const [orders, template, technicianRec] = await Promise.all([
      this.getServiceOrdersData(companyId, filters),
      this.companiesService.getReportTemplate(companyId),
      filters.technicianId
        ? this.prisma.user.findUnique({ where: { id: filters.technicianId }, select: { name: true } })
        : Promise.resolve(null),
    ])

    const workbook = new ExcelJS.default.Workbook()
    workbook.creator = template.companyName || 'Sistema de Manutenção'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Ordens de Serviço', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    })

    // ── Cabeçalho com estilo ──
    const headerStyle: Partial<import('exceljs').Style> = {
      font: { bold: true, color: { argb: this.getContrastArgb(template.primaryColor) }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.primaryColor.replace('#', '') } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
      },
    }

    const columns = [
      { header: 'Nº OS', key: 'number', width: 8 },
      { header: 'Título', key: 'title', width: 35 },
      { header: 'Cliente', key: 'client', width: 25 },
      { header: 'Equipamento', key: 'equipment', width: 28 },
      { header: 'Tipo', key: 'type', width: 18 },
      { header: 'Grupo', key: 'group', width: 15 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Prioridade', key: 'priority', width: 12 },
      { header: 'Técnico(s)', key: 'technicians', width: 25 },
      { header: 'Solicitante', key: 'requester', width: 20 },
      { header: 'Criada em', key: 'createdAt', width: 16 },
      { header: 'Iniciada em', key: 'startedAt', width: 16 },
      { header: 'Concluída em', key: 'completedAt', width: 16 },
      { header: 'Tempo (h)', key: 'hours', width: 11 },
      { header: 'Resolução', key: 'resolution', width: 40 },
    ]

    sheet.columns = columns
    sheet.getRow(1).height = 28

    // Aplica estilo no cabeçalho
    sheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle)
    })

    const statusLabels: Record<string, string> = {
      OPEN: 'Aberta',
      AWAITING_PICKUP: 'Aguard. técnico',
      IN_PROGRESS: 'Em andamento',
      COMPLETED: 'Concluída',
      COMPLETED_APPROVED: 'Aprovada',
      COMPLETED_REJECTED: 'Reprovada',
      CANCELLED: 'Cancelada',
    }

    const typeLabels: Record<string, string> = {
      PREVENTIVE: 'Preventiva',
      CORRECTIVE: 'Corretiva',
      INITIAL_ACCEPTANCE: 'Aceitação inicial',
      EXTERNAL_SERVICE: 'Serviço externo',
      TECHNOVIGILANCE: 'Tecnovigilância',
      TRAINING: 'Treinamento',
      IMPROPER_USE: 'Uso inadequado',
      DEACTIVATION: 'Desativação',
    }

    const priorityLabels: Record<string, string> = {
      LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente',
    }

    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    const statusOrder: Record<string, number> = {
      OPEN: 0, AWAITING_PICKUP: 1, IN_PROGRESS: 2, COMPLETED: 3,
      COMPLETED_APPROVED: 4, COMPLETED_REJECTED: 5, CANCELLED: 6,
    }

    const fmt = (d: Date | null) => d
      ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : '-'

    const calcHours = (start: Date | null, end: Date | null) => {
      if (!start || !end) return '-'
      const h = (new Date(end).getTime() - new Date(start).getTime()) / 3600000
      return h.toFixed(1)
    }

    const statusColors: Record<string, string> = {
      'Aprovada': 'FF16A34A',
      'Concluída': 'FF2563EB',
      'Em andamento': 'FFD97706',
      'Aguard. técnico': 'FF9333EA',
      'Reprovada': 'FFDC2626',
      'Cancelada': 'FF6B7280',
      'Aberta': 'FF374151',
    }

    // ── Extrair chave de quebra para cada OS ──
    const groupBy = filters.groupBy
    const getGroupKey = (os: (typeof orders)[number]): string => {
      switch (groupBy) {
        case 'status': return statusLabels[os.status] ?? os.status
        case 'priority': return priorityLabels[os.priority] ?? os.priority
        case 'maintenanceType': return typeLabels[os.maintenanceType] ?? os.maintenanceType
        case 'client': return os.client?.name ?? 'Sem cliente'
        case 'group': return os.group?.name ?? 'Sem grupo'
        case 'technician': return os.technicians.find((t) => t.role === 'LEAD')?.technician.name
          ?? os.technicians[0]?.technician.name
          ?? 'Sem técnico'
        default: return ''
      }
    }

    // ── Ordenar por grupo (mantém sub-ordem por número) ──
    const sortedOrders = groupBy
      ? [...orders].sort((a, b) => {
        const ka = getGroupKey(a)
        const kb = getGroupKey(b)
        if (groupBy === 'priority') {
          return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
        }
        if (groupBy === 'status') {
          return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
        }
        return ka.localeCompare(kb, 'pt-BR')
      })
      : orders

    // ── Estilo da linha de cabeçalho de grupo ──
    const groupHeaderArgb = 'FF' + template.primaryColor.replace('#', '')
    const groupHeaderStyle = {
      font: { bold: true, color: { argb: this.getContrastArgb(template.primaryColor) }, size: 10 },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: groupHeaderArgb } },
      alignment: { vertical: 'middle' as const },
    }

    // ── Dados com quebras ──
    let currentGroup = ''
    let groupRowCount = 0
    let groupHoursSum = 0
    let groupStartRow = 2
    let zIdx = 0

    const flushGroupSubtotal = (groupLabel: string, count: number, avgH: number) => {
      if (!groupBy || count === 0) return
      const subtotalRow = sheet.addRow([
        `  ↳ Subtotal — ${groupLabel}: ${count} OS  ·  Tempo médio: ${avgH > 0 ? avgH.toFixed(1) + 'h' : '-'}`,
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      ])
      subtotalRow.font = { bold: true, italic: true, size: 9 }
      subtotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }
      subtotalRow.height = 16
    }

    sortedOrders.forEach((os) => {
      const groupKey = getGroupKey(os)

      // Quebra de grupo
      if (groupBy && groupKey !== currentGroup) {
        if (currentGroup !== '') {
          const hoursNums = sortedOrders
            .slice(groupStartRow - 2, groupStartRow - 2 + groupRowCount)
            .map((o) => {
              if (!o.startedAt || !o.completedAt) return 0
              return (new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime()) / 3600000
            })
            .filter((h) => h > 0)
          const avgH = hoursNums.length ? hoursNums.reduce((a, b) => a + b, 0) / hoursNums.length : 0
          flushGroupSubtotal(currentGroup, groupRowCount, avgH)
        }
        // Cabeçalho do novo grupo
        const hRow = sheet.addRow([`  ${groupKey}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
        hRow.height = 22
        hRow.eachCell((cell) => { Object.assign(cell, groupHeaderStyle) })
        currentGroup = groupKey
        groupRowCount = 0
        groupStartRow = sheet.rowCount + 1
        zIdx = 0
      }

      const row = sheet.addRow({
        number: os.number,
        title: os.title,
        client: os.client?.name ?? '-',
        equipment: [os.equipment?.name, os.equipment?.brand, os.equipment?.model]
          .filter(Boolean).join(' — '),
        type: typeLabels[os.maintenanceType] ?? os.maintenanceType,
        group: os.group?.name ?? '-',
        status: statusLabels[os.status] ?? os.status,
        priority: priorityLabels[os.priority] ?? os.priority,
        technicians: os.technicians.map((t) =>
          `${t.technician.name}${t.role === 'LEAD' ? ' (L)' : ''}`
        ).join(', ') || '-',
        requester: os.requester?.name ?? '-',
        createdAt: fmt(os.createdAt),
        startedAt: fmt(os.startedAt),
        completedAt: fmt(os.completedAt),
        hours: calcHours(os.startedAt, os.completedAt),
        resolution: os.resolution ?? '-',
      })

      if (zIdx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }
        })
      }
      row.height = 18

      const statusCell = row.getCell(7)
      const color = statusColors[statusCell.value as string]
      if (color) statusCell.font = { bold: true, color: { argb: color } }

      groupRowCount++
      zIdx++
    })

    // Subtotal do último grupo
    if (groupBy && currentGroup !== '') {
      const hoursNums = sortedOrders
        .slice(sortedOrders.length - groupRowCount)
        .map((o) => {
          if (!o.startedAt || !o.completedAt) return 0
          return (new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime()) / 3600000
        })
        .filter((h) => h > 0)
      const avgH = hoursNums.length ? hoursNums.reduce((a, b) => a + b, 0) / hoursNums.length : 0
      flushGroupSubtotal(currentGroup, groupRowCount, avgH)
    }

    // ── Linha de total geral ──
    const totalRow = sheet.addRow([
      `${template.companyName} — Total geral: ${orders.length} OS`, '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    ])
    totalRow.font = { bold: true, italic: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }

    // ── Resumo de filtros aplicados ──
    const excelFilterParts: string[] = []
    if (filters.status) {
      const vals = filters.status.split(',').map((s) => statusLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) excelFilterParts.push(`Status: ${vals.join(', ')}`)
    }
    if (filters.priority) {
      const vals = filters.priority.split(',').map((s) => priorityLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) excelFilterParts.push(`Prioridade: ${vals.join(', ')}`)
    }
    if (filters.maintenanceType) {
      const vals = filters.maintenanceType.split(',').map((s) => typeLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) excelFilterParts.push(`Tipo: ${vals.join(', ')}`)
    }
    if (filters.groupBy) {
      const gbLabels: Record<string, string> = {
        status: 'Status', priority: 'Prioridade', maintenanceType: 'Tipo',
        client: 'Cliente', group: 'Grupo', technician: 'Técnico',
      }
      excelFilterParts.push(`Agrupado por: ${gbLabels[filters.groupBy] ?? filters.groupBy}`)
    }
    const excelClientName = filters.clientId ? orders.find((o) => o.client?.name)?.client?.name : null
    if (excelClientName) excelFilterParts.push(`Cliente: ${excelClientName}`)
    const excelGroupName = filters.groupId ? orders.find((o) => o.group?.name)?.group?.name : null
    if (excelGroupName) excelFilterParts.push(`Grupo: ${excelGroupName}`)
    if (technicianRec?.name) excelFilterParts.push(`Técnico: ${technicianRec.name}`)
    if (filters.dateFrom || filters.dateTo) {
      const dateFieldLabels: Record<string, string> = {
        createdAt: 'Abertura', startedAt: 'Início', completedAt: 'Conclusão', approvedAt: 'Aprovação',
      }
      const fieldLabel = dateFieldLabels[filters.dateField ?? 'createdAt'] ?? 'Data'
      const from = filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString('pt-BR') : null
      const to = filters.dateTo ? new Date(filters.dateTo).toLocaleDateString('pt-BR') : null
      excelFilterParts.push(`${fieldLabel}: ${[from && `de ${from}`, to && `até ${to}`].filter(Boolean).join(' ')}`)
    }
    if (excelFilterParts.length > 0) {
      const fr = sheet.addRow([`Filtros aplicados: ${excelFilterParts.join('  ·  ')}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
      fr.font = { italic: true, size: 8, color: { argb: 'FF475569' } }
      fr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      fr.height = 16
      sheet.mergeCells(fr.number, 1, fr.number, 15)
    }

    // ── Auto-filtro e freeze ──
    sheet.autoFilter = { from: 'A1', to: 'O1' }
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  // ─────────────────────────────────────────
  // Gera PDF das OS usando HTML → puppeteer-like (sem deps pesadas)
  // Usamos uma abordagem leve com html-pdf ou PDFKit
  // ─────────────────────────────────────────
  async exportServiceOrdersPdf(companyId: string, filters: ReportFilters): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default
    const [orders, template, technicianRec] = await Promise.all([
      this.getServiceOrdersData(companyId, filters),
      this.companiesService.getReportTemplate(companyId),
      filters.technicianId
        ? this.prisma.user.findUnique({ where: { id: filters.technicianId }, select: { name: true } })
        : Promise.resolve(null),
    ])
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    })
    const buffers: Buffer[] = []
    doc.on('data', (chunk: Buffer) => buffers.push(chunk))

    const W = doc.page.width - 80
    const blue = template.primaryColor
    const lightBlue = template.secondaryColor
    const gray = '#6B7280'
    const dateStr = new Date().toLocaleDateString('pt-BR')

    const statusLabels: Record<string, string> = {
      OPEN: 'Aberta', AWAITING_PICKUP: 'Ag. técnico', IN_PROGRESS: 'Em andamento',
      COMPLETED: 'Concluída', COMPLETED_APPROVED: 'Aprovada',
      COMPLETED_REJECTED: 'Reprovada', CANCELLED: 'Cancelada',
    }
    const typeLabels: Record<string, string> = {
      PREVENTIVE: 'Preventiva', CORRECTIVE: 'Corretiva',
      INITIAL_ACCEPTANCE: 'Aceitação', EXTERNAL_SERVICE: 'Ext.',
      TECHNOVIGILANCE: 'Tecnovig.', TRAINING: 'Treinamento',
      IMPROPER_USE: 'Uso inad.', DEACTIVATION: 'Desativação',
    }
    const priorityLabels: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' }
    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    const statusOrder: Record<string, number> = {
      OPEN: 0, AWAITING_PICKUP: 1, IN_PROGRESS: 2, COMPLETED: 3,
      COMPLETED_APPROVED: 4, COMPLETED_REJECTED: 5, CANCELLED: 6,
    }

    const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'

    const groupBy = filters.groupBy
    const getGroupKey = (os: (typeof orders)[number]): string => {
      switch (groupBy) {
        case 'status': return statusLabels[os.status] ?? os.status
        case 'priority': return priorityLabels[os.priority] ?? os.priority
        case 'maintenanceType': return typeLabels[os.maintenanceType] ?? os.maintenanceType
        case 'client': return os.client?.name ?? 'Sem cliente'
        case 'group': return os.group?.name ?? 'Sem grupo'
        case 'technician': return os.technicians.find((t) => t.role === 'LEAD')?.technician.name
          ?? os.technicians[0]?.technician.name ?? 'Sem técnico'
        default: return ''
      }
    }

    const sortedOrders = groupBy
      ? [...orders].sort((a, b) => {
        if (groupBy === 'priority') return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
        if (groupBy === 'status') return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
        return getGroupKey(a).localeCompare(getGroupKey(b), 'pt-BR')
      })
      : orders

    // ── Cabeçalho ──
    const filterParts: string[] = []
    if (filters.status) {
      const vals = filters.status.split(',').map((s) => statusLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) filterParts.push(`Status: ${vals.join(', ')}`)
    }
    if (filters.priority) {
      const vals = filters.priority.split(',').map((s) => priorityLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) filterParts.push(`Prioridade: ${vals.join(', ')}`)
    }
    if (filters.maintenanceType) {
      const vals = filters.maintenanceType.split(',').map((s) => typeLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) filterParts.push(`Tipo: ${vals.join(', ')}`)
    }
    if (groupBy) {
      const gbLabels: Record<string, string> = {
        status: 'Status', priority: 'Prioridade', maintenanceType: 'Tipo',
        client: 'Cliente', group: 'Grupo', technician: 'Técnico',
      }
      filterParts.push(`Agrupado por: ${gbLabels[groupBy] ?? groupBy}`)
    }
    const clientNameFilter = filters.clientId ? orders.find((o) => o.client?.name)?.client?.name : null
    if (clientNameFilter) filterParts.push(`Cliente: ${clientNameFilter}`)
    const groupNameFilter = filters.groupId ? orders.find((o) => o.group?.name)?.group?.name : null
    if (groupNameFilter) filterParts.push(`Grupo: ${groupNameFilter}`)
    if (technicianRec?.name) filterParts.push(`Técnico: ${technicianRec.name}`)
    if (filters.dateFrom || filters.dateTo) {
      const dateFieldLabels: Record<string, string> = {
        createdAt: 'Abertura', startedAt: 'Início', completedAt: 'Conclusão', approvedAt: 'Aprovação',
      }
      const fieldLabel = dateFieldLabels[filters.dateField ?? 'createdAt'] ?? 'Data'
      const from = filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString('pt-BR') : null
      const to = filters.dateTo ? new Date(filters.dateTo).toLocaleDateString('pt-BR') : null
      filterParts.push(`${fieldLabel}: ${[from && `de ${from}`, to && `até ${to}`].filter(Boolean).join(' ')}`)
    }
    const subtitle = `Gerado em: ${dateStr}  ·  Total: ${orders.length} OS${filterParts.length > 0 ? '  ·  ' + filterParts.join('  ·  ') : ''}`
    let y = this.drawPdfHeader(doc, template, template.headerTitle || 'Relatório de Ordens de Serviço', subtitle, logoBuffer)

    // ── Colunas da tabela ──
    const cols = [
      { label: 'Nº', w: 35 },
      { label: 'Título', w: 160 },
      { label: 'Cliente', w: 100 },
      { label: 'Tipo', w: 70 },
      { label: 'Status', w: 75 },
      { label: 'Técnico', w: 100 },
      { label: 'Criada', w: 65 },
      { label: 'Concluída', w: 65 },
    ]

    const drawTableHeader = (atY: number) => {
      let x = 40
      doc.rect(40, atY, W, 20).fill(lightBlue)
      doc.fillColor(this.getContrastColor(template.secondaryColor)).fontSize(8).font('Helvetica-Bold')
      cols.forEach((col) => {
        doc.text(col.label, x + 3, atY + 6, { width: col.w - 6, ellipsis: true })
        x += col.w
      })
      return atY + 20
    }

    y = drawTableHeader(y)
    let rowIdx = 0
    let currentGroup = ''
    let groupCount = 0
    let groupAvgHours: number[] = []

    const drawGroupSubtotal = (label: string, count: number, avgHrs: number[]) => {
      if (!groupBy) return
      const avg = avgHrs.length ? (avgHrs.reduce((a, b) => a + b, 0) / avgHrs.length).toFixed(1) + 'h' : '-'
      const subtotalH = 14
      if (y > doc.page.height - 80) { doc.addPage(); y = drawTableHeader(40); rowIdx = 0 }
      doc.rect(40, y, W, subtotalH).fill('#F1F5F9')
      doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold')
        .text(`  ↳ ${label}: ${count} OS  ·  Tempo médio: ${avg}`, 43, y + 4, { width: W - 6, lineBreak: false })
      y += subtotalH
    }

    sortedOrders.forEach((os) => {
      const groupKey = getGroupKey(os)

      if (groupBy && groupKey !== currentGroup) {
        if (currentGroup !== '') drawGroupSubtotal(currentGroup, groupCount, groupAvgHours)

        // Cabeçalho do grupo
        if (y > doc.page.height - 100) { doc.addPage(); y = drawTableHeader(40); rowIdx = 0 }
        const ghH = 20
        doc.rect(40, y, W, ghH).fill(blue)
        doc.fillColor(this.getContrastColor(template.primaryColor)).fontSize(9).font('Helvetica-Bold')
          .text(`  ${groupKey}`, 43, y + 6, { width: W - 6, lineBreak: false })
        y += ghH
        currentGroup = groupKey
        groupCount = 0
        groupAvgHours = []
        rowIdx = 0
      }

      if (y > doc.page.height - 80) { doc.addPage(); y = drawTableHeader(40); rowIdx = 0 }

      const rowH = 20
      doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')
      doc.fillColor('#1F2937').fontSize(7.5).font('Helvetica')
      let x = 40

      const cells = [
        String(os.number), os.title, os.client?.name ?? '-',
        typeLabels[os.maintenanceType] ?? '-', statusLabels[os.status] ?? '-',
        os.technicians[0]?.technician.name ?? '-', fmt(os.createdAt), fmt(os.completedAt),
      ]
      cells.forEach((text, i) => {
        doc.text(text, x + 3, y + 6, { width: cols[i].w - 6, ellipsis: true, lineBreak: false })
        x += cols[i].w
      })
      y += rowH
      rowIdx++
      groupCount++
      if (os.startedAt && os.completedAt) {
        groupAvgHours.push((new Date(os.completedAt).getTime() - new Date(os.startedAt).getTime()) / 3600000)
      }
    })

    if (groupBy && currentGroup !== '') drawGroupSubtotal(currentGroup, groupCount, groupAvgHours)

    // ── Rodapé ──
    this.drawPdfFooter(doc, template, y + 12)

    doc.end()
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  // ─────────────────────────────────────────
  // RELATÓRIO DE EQUIPAMENTOS
  // ─────────────────────────────────────────

  private getEquipmentSortField(orderBy?: string): any {
    switch (orderBy) {
      case 'status': return { status: 'asc' as const }
      case 'criticality': return { criticality: 'asc' as const }
      case 'type': return { type: { name: 'asc' as const } }
      case 'costCenter': return { costCenter: { name: 'asc' as const } }
      default: return { name: 'asc' as const }
    }
  }

  private equipmentOrderBy(groupBy?: string, orderBy?: string): any {
    const secondarySort = this.getEquipmentSortField(orderBy)
    const byName = { name: 'asc' as const }

    switch (groupBy) {
      case 'status': return [{ status: 'asc' }, secondarySort]
      case 'criticality': return [{ criticality: 'asc' }, secondarySort]
      case 'type': return [{ type: { name: 'asc' } }, secondarySort]
      case 'location': return [{ location: { name: 'asc' } }, secondarySort]
      case 'costCenter': return [{ costCenter: { name: 'asc' } }, secondarySort]
      default: return [secondarySort, byName]
    }
  }

  private getEquipmentGroupValue(eq: any, groupBy?: string): string {
    switch (groupBy) {
      case 'status': return eq.status ?? ''
      case 'criticality': return eq.criticality ?? ''
      case 'type': return eq.type?.name ?? 'Sem tipo'
      case 'location': return eq.location?.name ?? 'Sem local'
      case 'costCenter': return eq.costCenter?.name ?? 'Sem centro de custo'
      default: return ''
    }
  }

  async getEquipmentData(companyId: string, filters: EquipmentReportFilters) {
    return this.prisma.equipment.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(filters.status && { status: { in: filters.status.split(',') } as any }),
        ...(filters.criticality && { criticality: { in: filters.criticality.split(',') } as any }),
        ...(filters.typeId && { typeId: { in: filters.typeId.split(',') } }),
        ...(filters.locationId && { locationId: { in: filters.locationId.split(',') } }),
        ...(filters.costCenterId && { costCenterId: { in: filters.costCenterId.split(',') } }),
      },
      select: {
        patrimonyNumber: true,
        serialNumber: true,
        anvisaNumber: true,
        invoiceNumber: true,
        name: true,
        brand: true,
        model: true,
        status: true,
        criticality: true,
        purchaseValue: true,
        purchaseDate: true,
        warrantyStart: true,
        warrantyEnd: true,
        currentValue: true,
        voltage: true,
        power: true,
        btus: true,
        ipAddress: true,
        operatingSystem: true,
        observations: true,
        location: { select: { name: true } },
        type: { select: { name: true, group: { select: { name: true } } } },
        subtype: { select: { name: true } },
        costCenter: { select: { name: true, code: true } },
      },
      orderBy: this.equipmentOrderBy(filters.groupBy, filters.orderBy),
    })
  }

  async exportEquipmentExcel(companyId: string, filters: EquipmentReportFilters): Promise<Buffer> {
    const ExcelJS = await import('exceljs')
    const [items, template] = await Promise.all([
      this.getEquipmentData(companyId, filters),
      this.companiesService.getReportTemplate(companyId),
    ])

    const statusLabels: Record<string, string> = {
      ACTIVE: 'Ativo', INACTIVE: 'Inativo',
      UNDER_MAINTENANCE: 'Em manutenção', SCRAPPED: 'Descartado', BORROWED: 'Emprestado',
    }
    const critLabels: Record<string, string> = {
      LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica',
    }
    const groupByLabels: Record<string, Record<string, string>> = {
      status: statusLabels,
      criticality: critLabels,
    }
    const fmt = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'
    const fmtMoney = (v: any) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'

    // ── Column registry ──
    type EqRow = Awaited<ReturnType<typeof this.getEquipmentData>>[number]
    const COLUMN_DEFS: Record<string, { header: string; width: number; getValue: (eq: EqRow) => string | number }> = {
      patrimony:     { header: 'Patrimônio',      width: 14, getValue: (eq) => eq.patrimonyNumber ?? '-' },
      serial:        { header: 'Nº Série',         width: 16, getValue: (eq) => eq.serialNumber ?? '-' },
      anvisaNumber:  { header: 'Nº ANVISA',        width: 14, getValue: (eq) => eq.anvisaNumber ?? '-' },
      invoiceNumber: { header: 'Nº NF',            width: 14, getValue: (eq) => eq.invoiceNumber ?? '-' },
      name:          { header: 'Nome',             width: 32, getValue: (eq) => eq.name },
      brand:         { header: 'Marca/Modelo',     width: 22, getValue: (eq) => [eq.brand, eq.model].filter(Boolean).join(' / ') || '-' },
      type:          { header: 'Tipo',             width: 20, getValue: (eq) => [eq.type?.name, eq.subtype?.name].filter(Boolean).join(' › ') || '-' },
      group:         { header: 'Grupo',            width: 18, getValue: (eq) => eq.type?.group?.name ?? '-' },
      location:      { header: 'Local',            width: 20, getValue: (eq) => eq.location?.name ?? '-' },
      costCenter:    { header: 'Centro de Custo',  width: 20, getValue: (eq) => eq.costCenter ? `${eq.costCenter.code ? eq.costCenter.code + ' — ' : ''}${eq.costCenter.name}` : '-' },
      status:        { header: 'Status',           width: 16, getValue: (eq) => statusLabels[eq.status] ?? eq.status },
      criticality:   { header: 'Criticidade',      width: 12, getValue: (eq) => critLabels[eq.criticality] ?? eq.criticality },
      purchaseValue: { header: 'Vlr. Compra',      width: 14, getValue: (eq) => fmtMoney(eq.purchaseValue) },
      currentValue:  { header: 'Vlr. Atual',       width: 14, getValue: (eq) => fmtMoney(eq.currentValue) },
      purchaseDate:  { header: 'Dt. Compra',       width: 12, getValue: (eq) => fmt(eq.purchaseDate) },
      warrantyEnd:   { header: 'Garantia até',     width: 12, getValue: (eq) => fmt(eq.warrantyEnd) },
      warrantyStart: { header: 'Garantia desde',   width: 12, getValue: (eq) => fmt(eq.warrantyStart) },
      voltage:       { header: 'Tensão',           width: 10, getValue: (eq) => eq.voltage ?? '-' },
      power:         { header: 'Potência',         width: 10, getValue: (eq) => eq.power ?? '-' },
      btus:          { header: 'BTUs',             width: 10, getValue: (eq) => eq.btus ?? '-' },
      ipAddress:     { header: 'IP',               width: 14, getValue: (eq) => eq.ipAddress ?? '-' },
      operatingSystem: { header: 'S.O.',           width: 16, getValue: (eq) => eq.operatingSystem ?? '-' },
      observations:  { header: 'Observações',      width: 30, getValue: (eq) => eq.observations ?? '-' },
    }

    const DEFAULT_COLUMNS = ['patrimony', 'name', 'brand', 'type', 'location', 'costCenter', 'status', 'criticality', 'warrantyEnd']
    const selectedKeys = (filters.columns?.length ? filters.columns : DEFAULT_COLUMNS)
      .filter((k) => k in COLUMN_DEFS)

    const workbook = new ExcelJS.default.Workbook()
    workbook.creator = template.companyName

    const sheet = workbook.addWorksheet('Inventário de Equipamentos', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    })

    const primaryArgb = 'FF' + template.primaryColor.replace('#', '')
    const secondaryArgb = 'FF' + template.secondaryColor.replace('#', '')

    const headerStyle: Partial<import('exceljs').Style> = {
      font: { bold: true, color: { argb: this.getContrastArgb(template.primaryColor) }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }

    sheet.columns = selectedKeys.map((k) => ({
      header: COLUMN_DEFS[k].header,
      key: k,
      width: COLUMN_DEFS[k].width,
    }))

    sheet.getRow(1).height = 28
    sheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle))

    const critColors: Record<string, string> = {
      'Crítica': 'FFDC2626', 'Alta': 'FFD97706', 'Média': 'FF2563EB', 'Baixa': 'FF16A34A',
    }

    let lastGroupValue = ''
    let dataRowCount = 0

    items.forEach((eq) => {
      // ── Group header row ──
      if (filters.groupBy && filters.groupBy !== 'none') {
        const groupRaw = this.getEquipmentGroupValue(eq, filters.groupBy)
        const groupLabel = groupByLabels[filters.groupBy]?.[groupRaw] ?? groupRaw

        if (groupLabel !== lastGroupValue) {
          lastGroupValue = groupLabel
          const groupRow = sheet.addRow([groupLabel, ...Array(selectedKeys.length - 1).fill('')])
          groupRow.height = 20
          groupRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } }
            cell.font = { bold: true, color: { argb: this.getContrastArgb(template.primaryColor) }, size: 10 }
          })
        }
      }

      const rowData: Record<string, any> = {}
      selectedKeys.forEach((k) => { rowData[k] = COLUMN_DEFS[k].getValue(eq) })
      const row = sheet.addRow(rowData)

      if (dataRowCount % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondaryArgb } }
        })
      }
      row.height = 18
      dataRowCount++

      // Criticidade colorida
      const critIdx = selectedKeys.indexOf('criticality')
      if (critIdx >= 0) {
        const critCell = row.getCell(critIdx + 1)
        const c = critColors[critCell.value as string]
        if (c) critCell.font = { bold: true, color: { argb: c } }
      }

      // Status em manutenção/descartado em vermelho
      const statusIdx = selectedKeys.indexOf('status')
      if (statusIdx >= 0) {
        const statusCell = row.getCell(statusIdx + 1)
        if (['Em manutenção', 'Descartado'].includes(statusCell.value as string)) {
          statusCell.font = { bold: true, color: { argb: 'FFDC2626' } }
        }
      }
    })

    const totalRow = sheet.addRow([
      `${template.companyName} — Total: ${items.length} equipamento(s)`,
      ...Array(selectedKeys.length - 1).fill(''),
    ])
    totalRow.font = { bold: true, italic: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondaryArgb } }

    const eqExcelFilterParts: string[] = []
    if (filters.status) {
      const eqStatusLabels: Record<string, string> = {
        ACTIVE: 'Ativo', INACTIVE: 'Inativo', UNDER_MAINTENANCE: 'Em manutenção', SCRAPPED: 'Descartado', BORROWED: 'Emprestado',
      }
      const vals = filters.status.split(',').map((s) => eqStatusLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) eqExcelFilterParts.push(`Status: ${vals.join(', ')}`)
    }
    if (filters.criticality) {
      const eqCritLabels: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' }
      const vals = filters.criticality.split(',').map((s) => eqCritLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) eqExcelFilterParts.push(`Criticidade: ${vals.join(', ')}`)
    }
    if (filters.typeId) {
      const typeNames = [...new Set(items.map((eq) => eq.type?.name).filter(Boolean))]
      if (typeNames.length) eqExcelFilterParts.push(`Tipo: ${typeNames.join(', ')}`)
    }
    if (filters.locationId) {
      const locationNames = [...new Set(items.map((eq) => eq.location?.name).filter(Boolean))]
      if (locationNames.length) eqExcelFilterParts.push(`Local: ${locationNames.join(', ')}`)
    }
    if (filters.costCenterId) {
      const ccNames = [...new Set(items.map((eq) => eq.costCenter?.name).filter(Boolean))]
      if (ccNames.length) eqExcelFilterParts.push(`Centro Custo: ${ccNames.join(', ')}`)
    }
    if (filters.groupBy && filters.groupBy !== 'none') {
      const gbLabels: Record<string, string> = {
        status: 'Status', criticality: 'Criticidade', type: 'Tipo', location: 'Local', costCenter: 'Centro Custo',
      }
      eqExcelFilterParts.push(`Agrupado por: ${gbLabels[filters.groupBy] ?? filters.groupBy}`)
    }
    if (eqExcelFilterParts.length > 0) {
      const fr = sheet.addRow([`Filtros aplicados: ${eqExcelFilterParts.join('  ·  ')}`, ...Array(selectedKeys.length - 1).fill('')])
      fr.font = { italic: true, size: 8, color: { argb: 'FF475569' } }
      fr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      fr.height = 16
      sheet.mergeCells(fr.number, 1, fr.number, selectedKeys.length)
    }

    const lastCol = String.fromCharCode(64 + selectedKeys.length)
    sheet.autoFilter = { from: 'A1', to: `${lastCol}1` }
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  async exportEquipmentPdf(companyId: string, filters: EquipmentReportFilters): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default
    const [items, template] = await Promise.all([
      this.getEquipmentData(companyId, filters),
      this.companiesService.getReportTemplate(companyId),
    ])
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } })
    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))

    {
      const W = doc.page.width - 80
      const blue = template.primaryColor
      const gray = '#6B7280'
      const dateStr = new Date().toLocaleDateString('pt-BR')

      const statusLabels: Record<string, string> = {
        ACTIVE: 'Ativo', INACTIVE: 'Inativo', UNDER_MAINTENANCE: 'Em manut.',
        SCRAPPED: 'Descartado', BORROWED: 'Emprestado',
      }
      const critLabels: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica' }
      const groupByLabels: Record<string, Record<string, string>> = { status: statusLabels, criticality: critLabels }
      const fmt = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'
      const fmtMoney = (v: any) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'

      type EqRow = Awaited<ReturnType<typeof this.getEquipmentData>>[number]

      // ── Column registry for PDF ──
      const PDF_COL_WIDTHS: Record<string, number> = {
        patrimony: 62,     serial: 72,        anvisaNumber: 64,  invoiceNumber: 60,
        name: 150,         brand: 100,        type: 90,          group: 80,
        location: 85,      costCenter: 85,    status: 70,        criticality: 58,
        purchaseValue: 70, currentValue: 68,  purchaseDate: 56,  warrantyEnd: 58,
        warrantyStart: 60, voltage: 48,       power: 48,         btus: 42,
        ipAddress: 70,     operatingSystem: 72, observations: 130,
      }
      const COLUMN_DEFS: Record<string, { label: string; getValue: (eq: EqRow) => string }> = {
        patrimony:      { label: 'Patrimônio',     getValue: (eq) => eq.patrimonyNumber ?? '-' },
        serial:         { label: 'Nº Série',        getValue: (eq) => eq.serialNumber ?? '-' },
        anvisaNumber:   { label: 'ANVISA',          getValue: (eq) => eq.anvisaNumber ?? '-' },
        invoiceNumber:  { label: 'Nº NF',           getValue: (eq) => eq.invoiceNumber ?? '-' },
        name:           { label: 'Nome',            getValue: (eq) => eq.name },
        brand:          { label: 'Marca/Modelo',    getValue: (eq) => [eq.brand, eq.model].filter(Boolean).join(' ') || '-' },
        type:           { label: 'Tipo',            getValue: (eq) => [eq.type?.name, eq.subtype?.name].filter(Boolean).join(' › ') || '-' },
        group:          { label: 'Grupo',           getValue: (eq) => eq.type?.group?.name ?? '-' },
        location:       { label: 'Local',           getValue: (eq) => eq.location?.name ?? '-' },
        costCenter:     { label: 'Centro Custo',    getValue: (eq) => eq.costCenter?.name ?? '-' },
        status:         { label: 'Status',          getValue: (eq) => statusLabels[eq.status] ?? eq.status },
        criticality:    { label: 'Criticidade',     getValue: (eq) => critLabels[eq.criticality] ?? eq.criticality },
        purchaseValue:  { label: 'Vlr. Compra',     getValue: (eq) => fmtMoney(eq.purchaseValue) },
        currentValue:   { label: 'Vlr. Atual',      getValue: (eq) => fmtMoney(eq.currentValue) },
        purchaseDate:   { label: 'Dt. Compra',      getValue: (eq) => fmt(eq.purchaseDate) },
        warrantyEnd:    { label: 'Garantia até',    getValue: (eq) => fmt(eq.warrantyEnd) },
        warrantyStart:  { label: 'Garantia desde',  getValue: (eq) => fmt(eq.warrantyStart) },
        voltage:        { label: 'Tensão',          getValue: (eq) => eq.voltage ?? '-' },
        power:          { label: 'Potência',        getValue: (eq) => eq.power ?? '-' },
        btus:           { label: 'BTUs',            getValue: (eq) => eq.btus != null ? String(eq.btus) : '-' },
        ipAddress:      { label: 'IP',              getValue: (eq) => eq.ipAddress ?? '-' },
        operatingSystem:{ label: 'S.O.',            getValue: (eq) => eq.operatingSystem ?? '-' },
        observations:   { label: 'Observações',     getValue: (eq) => eq.observations ?? '-' },
      }

      const DEFAULT_COLUMNS = ['patrimony', 'name', 'brand', 'type', 'location', 'costCenter', 'status', 'criticality', 'warrantyEnd']
      const selectedKeys = (filters.columns?.length ? filters.columns : DEFAULT_COLUMNS)
        .filter((k) => k in COLUMN_DEFS)

      // Calculate column widths scaled to page width
      const totalRaw = selectedKeys.reduce((sum, k) => sum + (PDF_COL_WIDTHS[k] ?? 70), 0)
      const scale = W / totalRaw
      const cols = selectedKeys.map((k) => ({
        key: k,
        label: COLUMN_DEFS[k].label,
        w: Math.floor((PDF_COL_WIDTHS[k] ?? 70) * scale),
      }))

      // ── Header ──
      const eqFilterParts: string[] = []
      if (filters.status) {
        const vals = filters.status.split(',').map((s) => statusLabels[s.trim()] ?? s.trim()).filter(Boolean)
        if (vals.length) eqFilterParts.push(`Status: ${vals.join(', ')}`)
      }
      if (filters.criticality) {
        const vals = filters.criticality.split(',').map((s) => critLabels[s.trim()] ?? s.trim()).filter(Boolean)
        if (vals.length) eqFilterParts.push(`Criticidade: ${vals.join(', ')}`)
      }
      if (filters.typeId) {
        const typeNames = [...new Set(items.map((eq) => eq.type?.name).filter(Boolean))]
        if (typeNames.length) eqFilterParts.push(`Tipo: ${typeNames.join(', ')}`)
      }
      if (filters.locationId) {
        const locationNames = [...new Set(items.map((eq) => eq.location?.name).filter(Boolean))]
        if (locationNames.length) eqFilterParts.push(`Local: ${locationNames.join(', ')}`)
      }
      if (filters.costCenterId) {
        const ccNames = [...new Set(items.map((eq) => eq.costCenter?.name).filter(Boolean))]
        if (ccNames.length) eqFilterParts.push(`Centro Custo: ${ccNames.join(', ')}`)
      }
      if (filters.groupBy && filters.groupBy !== 'none') {
        const gbLabels: Record<string, string> = {
          status: 'Status', criticality: 'Criticidade', type: 'Tipo', location: 'Local', costCenter: 'Centro Custo',
        }
        eqFilterParts.push(`Agrupado por: ${gbLabels[filters.groupBy] ?? filters.groupBy}`)
      }
      const subtitle = `Gerado em: ${dateStr}  ·  Total: ${items.length} equipamento(s)${eqFilterParts.length > 0 ? '  ·  ' + eqFilterParts.join('  ·  ') : ''}`
      let y = this.drawPdfHeader(doc, template, template.headerTitle || 'Inventário de Equipamentos', subtitle, logoBuffer)

      let x = 40

      const drawTableHeader = () => {
        x = 40
        doc.rect(40, y, W, 20).fill(template.secondaryColor)
        doc.fillColor(this.getContrastColor(template.secondaryColor)).fontSize(8).font('Helvetica-Bold')
        cols.forEach((col) => {
          doc.text(col.label, x + 3, y + 6, { width: col.w - 6, ellipsis: true })
          x += col.w
        })
        y += 20
      }

      drawTableHeader()

      let rowIdx = 0
      let lastGroupValue = ''

      items.forEach((eq) => {
        // ── Group header ──
        if (filters.groupBy && filters.groupBy !== 'none') {
          const groupRaw = this.getEquipmentGroupValue(eq, filters.groupBy)
          const groupLabel = groupByLabels[filters.groupBy]?.[groupRaw] ?? groupRaw

          if (groupLabel !== lastGroupValue) {
            lastGroupValue = groupLabel
            if (y > doc.page.height - 80) { doc.addPage(); y = 40; drawTableHeader() }

            doc.rect(40, y, W, 20).fill(blue)
            doc.fillColor(this.getContrastColor(template.primaryColor)).fontSize(8).font('Helvetica-Bold')
              .text(groupLabel, 45, y + 6, { width: W - 10, ellipsis: true })
            y += 20
            rowIdx = 0
          }
        }

        if (y > doc.page.height - 80) { doc.addPage(); y = 40; drawTableHeader(); rowIdx = 0 }

        const rowH = 20
        doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')
        doc.fillColor('#1F2937').fontSize(7.5).font('Helvetica')
        x = 40

        cols.forEach((col) => {
          const text = COLUMN_DEFS[col.key].getValue(eq)
          doc.text(String(text), x + 3, y + 6, { width: col.w - 6, ellipsis: true, lineBreak: false })
          x += col.w
        })

        y += rowH
        rowIdx++
      })

      this.drawPdfFooter(doc, template, y + 12)

      doc.end()
    }

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  // ─────────────────────────────────────────
  // RELATÓRIO DE PREVENTIVAS
  // ─────────────────────────────────────────
  async getPreventiveData(
    companyId: string,
    filters: {
      isActive?: boolean
      typeId?: string
      subtypeId?: string
      recurrenceType?: string
      costCenterId?: string
      nextRunFrom?: string
      nextRunTo?: string
      startDateFrom?: string
      startDateTo?: string
      groupBy?: string
      orderBy?: string
    },
    effectiveClientId?: string | null,
  ) {
    const equipmentFilter: Record<string, unknown> = {}
    if (filters.typeId) equipmentFilter.typeId = { in: filters.typeId.split(',') }
    if (filters.subtypeId) equipmentFilter.subtypeId = { in: filters.subtypeId.split(',') }
    if (filters.costCenterId) equipmentFilter.costCenterId = { in: filters.costCenterId.split(',') }

    const prismaOrderBy = (() => {
      switch (filters.orderBy) {
        case 'nextRunDesc': return { nextRunAt: 'desc' as const }
        case 'equipment':   return { equipment: { name: 'asc' as const } }
        case 'costCenter':  return { equipment: { costCenter: { name: 'asc' as const } } }
        case 'title':       return { title: 'asc' as const }
        default:            return { nextRunAt: 'asc' as const }
      }
    })()

    return this.prisma.maintenanceSchedule.findMany({
      where: {
        companyId,
        ...(effectiveClientId ? { clientId: effectiveClientId } : {}),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(Object.keys(equipmentFilter).length > 0 && { equipment: equipmentFilter }),
        ...(filters.recurrenceType && { recurrenceType: { in: filters.recurrenceType.split(',') as any } }),
        ...(filters.nextRunFrom || filters.nextRunTo ? {
          nextRunAt: {
            ...(filters.nextRunFrom && { gte: new Date(filters.nextRunFrom) }),
            ...(filters.nextRunTo && { lte: new Date(filters.nextRunTo) }),
          },
        } : {}),
        ...(filters.startDateFrom || filters.startDateTo ? {
          startDate: {
            ...(filters.startDateFrom && { gte: new Date(filters.startDateFrom) }),
            ...(filters.startDateTo && { lte: new Date(filters.startDateTo) }),
          },
        } : {}),
      },
      select: {
        title: true,
        maintenanceType: true,
        recurrenceType: true,
        customIntervalDays: true,
        nextRunAt: true,
        lastRunAt: true,
        isActive: true,
        startDate: true,
        endDate: true,
        equipment: {
          select: {
            name: true,
            serialNumber: true,
            type: { select: { name: true } },
            subtype: { select: { name: true } },
            costCenter: { select: { name: true } },
          },
        },
        group: { select: { name: true } },
        client: { select: { name: true } },
        _count: { select: { maintenances: true } },
      },
      orderBy: prismaOrderBy,
    })
  }

  async exportPreventiveExcel(
    companyId: string,
    filters: { clientId?: string; isActive?: boolean; typeId?: string; subtypeId?: string; recurrenceType?: string; costCenterId?: string; nextRunFrom?: string; nextRunTo?: string; startDateFrom?: string; startDateTo?: string; groupBy?: string; orderBy?: string },
    currentUser: AuthenticatedUser,
  ): Promise<Buffer> {
    const ExcelJS = await import('exceljs')

    const effectiveClientId = currentUser.role === UserRole.CLIENT_ADMIN
      ? (currentUser.clientId ?? null)
      : (filters.clientId ?? null)

    const [items, template] = await Promise.all([
      this.getPreventiveData(companyId, filters, effectiveClientId),
      this.companiesService.getReportTemplate(companyId),
    ])

    const workbook = new ExcelJS.default.Workbook()
    workbook.creator = template.companyName

    const sheet = workbook.addWorksheet('Manutenções Preventivas', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    })

    const headerStyle: Partial<import('exceljs').Style> = {
      font: { bold: true, color: { argb: this.getContrastArgb(template.primaryColor) }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.primaryColor.replace('#', '') } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }

    sheet.columns = [
      { header: 'Agendamento', key: 'title', width: 30 },
      { header: 'Cliente', key: 'client', width: 22 },
      { header: 'Equipamento', key: 'equipment', width: 25 },
      { header: 'Nº Série', key: 'serial', width: 16 },
      { header: 'Setor', key: 'sector', width: 18 },
      { header: 'Tipo de Equip.', key: 'equipType', width: 16 },
      { header: 'Subtipo', key: 'subtype', width: 16 },
      { header: 'Grupo', key: 'group', width: 16 },
      { header: 'Tipo Manut.', key: 'maintType', width: 14 },
      { header: 'Recorrência', key: 'recurrence', width: 14 },
      { header: 'Próxima OS', key: 'nextRun', width: 16 },
      { header: 'Última OS', key: 'lastRun', width: 16 },
      { header: 'Vigência', key: 'validity', width: 22 },
      { header: 'Ocorrências', key: 'count', width: 12 },
      { header: 'Situação', key: 'situation', width: 12 },
    ]

    sheet.getRow(1).height = 28
    sheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle))

    const recurrenceLabels: Record<string, string> = {
      DAILY: 'Diária', WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal',
      QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual', CUSTOM: 'Personalizada',
    }
    const maintTypeLabels: Record<string, string> = {
      PREVENTIVE: 'Preventiva', CORRECTIVE: 'Corretiva', INITIAL_ACCEPTANCE: 'Aceitação',
      EXTERNAL_SERVICE: 'Serviço Ext.', TECHNOVIGILANCE: 'Tecnovig.', TRAINING: 'Treinamento',
      IMPROPER_USE: 'Uso Indevido', DEACTIVATION: 'Desativação',
    }
    const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'
    const now = new Date()

    const situacao = (s: { isActive: boolean; nextRunAt: Date | null }) => {
      if (!s.isActive) return 'Inativo'
      if (s.nextRunAt && s.nextRunAt < now) return 'Atrasada'
      return 'Em dia'
    }

    // ── Agrupamento e ordenação em memória ──
    const groupByKey = filters.groupBy
    const situationOrder: Record<string, number> = { 'Atrasada': 0, 'Em dia': 1, 'Inativo': 2 }

    const getGroupKey = (s: typeof items[0]): string => {
      switch (groupByKey) {
        case 'costCenter': return s.equipment?.costCenter?.name ?? 'Sem Setor'
        case 'type':       return s.equipment?.type?.name ?? 'Sem Tipo'
        case 'recurrence': return recurrenceLabels[s.recurrenceType] ?? s.recurrenceType
        case 'situation':  return situacao(s)
        case 'client':     return s.client?.name ?? 'Sem Prestador'
        default:           return ''
      }
    }

    const sortedItems = groupByKey
      ? [...items].sort((a, b) => {
          const ka = getGroupKey(a)
          const kb = getGroupKey(b)
          if (groupByKey === 'situation') return (situationOrder[ka] ?? 99) - (situationOrder[kb] ?? 99)
          return ka.localeCompare(kb, 'pt-BR')
        })
      : filters.orderBy === 'situation'
        ? [...items].sort((a, b) => (situationOrder[situacao(a)] ?? 99) - (situationOrder[situacao(b)] ?? 99))
        : items

    const groupHeaderArgb = 'FF' + template.primaryColor.replace('#', '')
    const groupHeaderStyle = {
      font: { bold: true, color: { argb: this.getContrastArgb(template.primaryColor) }, size: 10 },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: groupHeaderArgb } },
      alignment: { vertical: 'middle' as const },
    }

    const addGroupSubtotal = (label: string, count: number, overdue: number) => {
      const stRow = sheet.addRow([
        `  ↳ ${label}: ${count} agendamento(s)  ·  ${overdue} atrasado(s)`,
        ...Array(14).fill(''),
      ])
      stRow.font = { bold: true, italic: true, size: 9 }
      stRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }
      stRow.height = 16
    }

    let currentGroup = ''
    let groupCount = 0
    let groupOverdueCount = 0
    let rowIdx = 0

    sortedItems.forEach((s) => {
      if (groupByKey) {
        const groupKey = getGroupKey(s)
        if (groupKey !== currentGroup) {
          if (currentGroup !== '') addGroupSubtotal(currentGroup, groupCount, groupOverdueCount)
          const hRow = sheet.addRow([`  ${groupKey}`, ...Array(14).fill('')])
          hRow.height = 22
          hRow.eachCell((cell) => { Object.assign(cell, groupHeaderStyle) })
          currentGroup = groupKey
          groupCount = 0
          groupOverdueCount = 0
          rowIdx = 0
        }
      }

      const sit = situacao(s)
      const row = sheet.addRow({
        title: s.title,
        client: s.client?.name ?? '-',
        equipment: s.equipment?.name ?? '-',
        serial: s.equipment?.serialNumber ?? '-',
        sector: s.equipment?.costCenter?.name ?? '-',
        equipType: s.equipment?.type?.name ?? '-',
        subtype: s.equipment?.subtype?.name ?? '-',
        group: s.group?.name ?? '-',
        maintType: maintTypeLabels[s.maintenanceType] ?? s.maintenanceType,
        recurrence: s.recurrenceType === 'CUSTOM'
          ? `A cada ${s.customIntervalDays} dia(s)`
          : (recurrenceLabels[s.recurrenceType] ?? s.recurrenceType),
        nextRun: fmt(s.nextRunAt),
        lastRun: fmt(s.lastRunAt),
        validity: `${fmt(s.startDate)} - ${s.endDate ? fmt(s.endDate) : 'Sem fim'}`,
        count: s._count.maintenances,
        situation: sit,
      })

      if (rowIdx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }
        })
      }
      row.height = 18

      if (sit === 'Atrasada') {
        row.getCell(11).font = { bold: true, color: { argb: 'FFDC2626' } }
      }
      const sitArgb = sit === 'Em dia' ? 'FF16A34A' : sit === 'Atrasada' ? 'FFDC2626' : 'FF6B7280'
      row.getCell(15).font = { bold: true, color: { argb: sitArgb } }

      if (sit === 'Atrasada') groupOverdueCount++
      groupCount++
      rowIdx++
    })

    if (groupByKey && currentGroup !== '') addGroupSubtotal(currentGroup, groupCount, groupOverdueCount)

    const overdueCount = items.filter((s) => s.isActive && s.nextRunAt && s.nextRunAt < now).length

    const totalRow = sheet.addRow([
      `${template.companyName} — Total: ${items.length} | Atrasadas: ${overdueCount}`,
      ...Array(14).fill(''),
    ])
    totalRow.font = { bold: true, italic: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }
    if (overdueCount > 0) totalRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } }

    const prevExcelFilterParts: string[] = []
    if (filters.isActive !== undefined) {
      prevExcelFilterParts.push(`Situação: ${filters.isActive ? 'Ativos' : 'Inativos'}`)
    }
    if (filters.recurrenceType) {
      const vals = filters.recurrenceType.split(',').map((s) => recurrenceLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) prevExcelFilterParts.push(`Recorrência: ${vals.join(', ')}`)
    }
    if (filters.typeId) {
      const typeNames = [...new Set(items.map((s) => s.equipment?.type?.name).filter(Boolean))]
      if (typeNames.length) prevExcelFilterParts.push(`Tipo equip.: ${typeNames.join(', ')}`)
    }
    if (filters.subtypeId) {
      const subtypeNames = [...new Set(items.map((s) => s.equipment?.subtype?.name).filter(Boolean))]
      if (subtypeNames.length) prevExcelFilterParts.push(`Subtipo: ${subtypeNames.join(', ')}`)
    }
    if (filters.costCenterId) {
      const sectors = [...new Set(items.map((s) => s.equipment?.costCenter?.name).filter(Boolean))]
      if (sectors.length) prevExcelFilterParts.push(`Setor: ${sectors.join(', ')}`)
    }
    if (effectiveClientId) {
      const clientName = items.find((s) => s.client?.name)?.client?.name
      if (clientName) prevExcelFilterParts.push(`Cliente: ${clientName}`)
    }
    if (filters.nextRunFrom || filters.nextRunTo) {
      const from = filters.nextRunFrom ? new Date(filters.nextRunFrom).toLocaleDateString('pt-BR') : '*'
      const to = filters.nextRunTo ? new Date(filters.nextRunTo).toLocaleDateString('pt-BR') : '*'
      prevExcelFilterParts.push(`Próxima OS: ${from} → ${to}`)
    }
    if (filters.startDateFrom || filters.startDateTo) {
      const from = filters.startDateFrom ? new Date(filters.startDateFrom).toLocaleDateString('pt-BR') : '*'
      const to = filters.startDateTo ? new Date(filters.startDateTo).toLocaleDateString('pt-BR') : '*'
      prevExcelFilterParts.push(`Vigência: ${from} → ${to}`)
    }
    const gbLabels: Record<string, string> = {
      costCenter: 'Setor', type: 'Tipo de Equip.', recurrence: 'Recorrência', situation: 'Situação', client: 'Prestador',
    }
    const obLabels: Record<string, string> = {
      nextRun: 'Próxima OS ↑', nextRunDesc: 'Próxima OS ↓', situation: 'Situação',
      equipment: 'Equipamento', costCenter: 'Setor', title: 'Título',
    }
    if (filters.groupBy) prevExcelFilterParts.push(`Agrupado por: ${gbLabels[filters.groupBy] ?? filters.groupBy}`)
    if (filters.orderBy && filters.orderBy !== 'nextRun') prevExcelFilterParts.push(`Ordem: ${obLabels[filters.orderBy] ?? filters.orderBy}`)
    if (prevExcelFilterParts.length > 0) {
      const fr = sheet.addRow([`Filtros aplicados: ${prevExcelFilterParts.join('  ·  ')}`, ...Array(14).fill('')])
      fr.font = { italic: true, size: 8, color: { argb: 'FF475569' } }
      fr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      fr.height = 16
      sheet.mergeCells(fr.number, 1, fr.number, 15)
    }

    sheet.autoFilter = { from: 'A1', to: 'O1' }
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  async exportPreventivePdf(
    companyId: string,
    filters: { clientId?: string; isActive?: boolean; typeId?: string; subtypeId?: string; recurrenceType?: string; costCenterId?: string; nextRunFrom?: string; nextRunTo?: string; startDateFrom?: string; startDateTo?: string; groupBy?: string; orderBy?: string },
    currentUser: AuthenticatedUser,
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default

    const effectiveClientId = currentUser.role === UserRole.CLIENT_ADMIN
      ? (currentUser.clientId ?? null)
      : (filters.clientId ?? null)

    const [items, template] = await Promise.all([
      this.getPreventiveData(companyId, filters, effectiveClientId),
      this.companiesService.getReportTemplate(companyId),
    ])
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } })
    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))

    const W = doc.page.width - 80
    const blue = template.primaryColor
    const dateStr = new Date().toLocaleDateString('pt-BR')
    const now = new Date()
    const overdueCount = items.filter((s) => s.isActive && s.nextRunAt && s.nextRunAt < now).length

    const recurrenceLabels: Record<string, string> = {
      DAILY: 'Diária', WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal',
      QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual', CUSTOM: 'Custom',
    }
    const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'
    const situacao = (s: { isActive: boolean; nextRunAt: Date | null }) => {
      if (!s.isActive) return 'Inativo'
      if (s.nextRunAt && s.nextRunAt < now) return 'Atrasada'
      return 'Em dia'
    }

    // ── Filtros aplicados ──
    const prevFilterParts: string[] = []
    if (filters.isActive !== undefined) {
      prevFilterParts.push(`Situação: ${filters.isActive ? 'Ativos' : 'Inativos'}`)
    }
    if (filters.recurrenceType) {
      const vals = filters.recurrenceType.split(',').map((s) => recurrenceLabels[s.trim()] ?? s.trim()).filter(Boolean)
      if (vals.length) prevFilterParts.push(`Recorrência: ${vals.join(', ')}`)
    }
    if (filters.typeId) {
      const typeNames = [...new Set(items.map((s) => s.equipment?.type?.name).filter(Boolean))]
      if (typeNames.length) prevFilterParts.push(`Tipo equip.: ${typeNames.join(', ')}`)
    }
    if (filters.subtypeId) {
      const subtypeNames = [...new Set(items.map((s) => s.equipment?.subtype?.name).filter(Boolean))]
      if (subtypeNames.length) prevFilterParts.push(`Subtipo: ${subtypeNames.join(', ')}`)
    }
    if (filters.costCenterId) {
      const sectors = [...new Set(items.map((s) => s.equipment?.costCenter?.name).filter(Boolean))]
      if (sectors.length) prevFilterParts.push(`Setor: ${sectors.join(', ')}`)
    }
    if (effectiveClientId) {
      const clientName = items.find((s) => s.client?.name)?.client?.name
      if (clientName) prevFilterParts.push(`Cliente: ${clientName}`)
    }
    if (filters.nextRunFrom || filters.nextRunTo) {
      const from = filters.nextRunFrom ? new Date(filters.nextRunFrom).toLocaleDateString('pt-BR') : '*'
      const to = filters.nextRunTo ? new Date(filters.nextRunTo).toLocaleDateString('pt-BR') : '*'
      prevFilterParts.push(`Próxima OS: ${from} → ${to}`)
    }
    if (filters.startDateFrom || filters.startDateTo) {
      const from = filters.startDateFrom ? new Date(filters.startDateFrom).toLocaleDateString('pt-BR') : '*'
      const to = filters.startDateTo ? new Date(filters.startDateTo).toLocaleDateString('pt-BR') : '*'
      prevFilterParts.push(`Vigência: ${from} → ${to}`)
    }
    const pdfGbLabels: Record<string, string> = {
      costCenter: 'Setor', type: 'Tipo de Equip.', recurrence: 'Recorrência', situation: 'Situação', client: 'Prestador',
    }
    if (filters.groupBy) prevFilterParts.push(`Agrupado por: ${pdfGbLabels[filters.groupBy] ?? filters.groupBy}`)
    const subtitle = `${dateStr}  ·  Total: ${items.length}  ·  Atrasadas: ${overdueCount}${prevFilterParts.length > 0 ? '  ·  ' + prevFilterParts.join('  ·  ') : ''}`
    let y = this.drawPdfHeader(doc, template, 'Manutenções Preventivas', subtitle, logoBuffer)

    // Cols total = 760 (landscape A4 - 80 margins)
    const cols = [
      { label: 'Agendamento', w: 125 },
      { label: 'Equip.', w: 100 },
      { label: 'Nº Série', w: 48 },
      { label: 'Setor', w: 65 },
      { label: 'Tipo Equip.', w: 65 },
      { label: 'Subtipo', w: 65 },
      { label: 'Recorrência', w: 65 },
      { label: 'Próxima OS', w: 65 },
      { label: 'Última OS', w: 60 },
      { label: 'Ocorr.', w: 47 },
      { label: 'Situação', w: 55 },
    ]

    const drawTableHeader = (atY: number) => {
      let lx = 40
      doc.rect(40, atY, W, 20).fill(template.secondaryColor)
      doc.fillColor(this.getContrastColor(template.secondaryColor)).fontSize(8).font('Helvetica-Bold')
      cols.forEach((col) => {
        doc.text(col.label, lx + 3, atY + 6, { width: col.w - 6, ellipsis: true })
        lx += col.w
      })
      return atY + 20
    }

    y = drawTableHeader(y)

    // ── Agrupamento e ordenação em memória ──
    const groupByKey = filters.groupBy
    const pdfSituationOrder: Record<string, number> = { 'Atrasada': 0, 'Em dia': 1, 'Inativo': 2 }

    const getPdfGroupKey = (s: typeof items[0]): string => {
      switch (groupByKey) {
        case 'costCenter': return s.equipment?.costCenter?.name ?? 'Sem Setor'
        case 'type':       return s.equipment?.type?.name ?? 'Sem Tipo'
        case 'recurrence': return recurrenceLabels[s.recurrenceType] ?? s.recurrenceType
        case 'situation':  return situacao(s)
        case 'client':     return s.client?.name ?? 'Sem Prestador'
        default:           return ''
      }
    }

    const pdfSortedItems = groupByKey
      ? [...items].sort((a, b) => {
          const ka = getPdfGroupKey(a)
          const kb = getPdfGroupKey(b)
          if (groupByKey === 'situation') return (pdfSituationOrder[ka] ?? 99) - (pdfSituationOrder[kb] ?? 99)
          return ka.localeCompare(kb, 'pt-BR')
        })
      : filters.orderBy === 'situation'
        ? [...items].sort((a, b) => (pdfSituationOrder[situacao(a)] ?? 99) - (pdfSituationOrder[situacao(b)] ?? 99))
        : items

    let rowIdx = 0
    let currentPdfGroup = ''
    let pdfGroupCount = 0
    let pdfGroupOverdue = 0

    const drawGroupSubtotal = (label: string, count: number, overdue: number) => {
      if (y > doc.page.height - 80) { y = drawTableHeader(doc.addPage().page ? 40 : 40); rowIdx = 0 }
      const stH = 14
      doc.rect(40, y, W, stH).fill('#F1F5F9')
      doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold')
        .text(`  ↳ ${label}: ${count} agendamento(s)  ·  ${overdue} atrasado(s)`, 43, y + 4, { width: W - 6, lineBreak: false })
      y += stH
    }

    pdfSortedItems.forEach((s) => {
      if (groupByKey) {
        const groupKey = getPdfGroupKey(s)
        if (groupKey !== currentPdfGroup) {
          if (currentPdfGroup !== '') drawGroupSubtotal(currentPdfGroup, pdfGroupCount, pdfGroupOverdue)
          if (y > doc.page.height - 80) { doc.addPage(); y = drawTableHeader(40); rowIdx = 0 }
          const ghH = 20
          doc.rect(40, y, W, ghH).fill(blue)
          doc.fillColor(this.getContrastColor(template.primaryColor)).fontSize(9).font('Helvetica-Bold')
            .text(`  ${groupKey}`, 43, y + 6, { width: W - 6, lineBreak: false })
          y += ghH
          currentPdfGroup = groupKey
          pdfGroupCount = 0
          pdfGroupOverdue = 0
          rowIdx = 0
        }
      }

      if (y > doc.page.height - 80) { doc.addPage(); y = drawTableHeader(40); rowIdx = 0 }

      const rowH = 20
      const sit = situacao(s)
      const isOverdue = sit === 'Atrasada'
      const sitColor = sit === 'Em dia' ? '#16A34A' : sit === 'Atrasada' ? '#DC2626' : '#6B7280'

      doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')

      let x = 40
      const cells = [
        { text: s.title, color: '#1F2937' },
        { text: s.equipment?.name ?? '-', color: '#1F2937' },
        { text: s.equipment?.serialNumber ?? '-', color: '#1F2937' },
        { text: s.equipment?.costCenter?.name ?? '-', color: '#1F2937' },
        { text: s.equipment?.type?.name ?? '-', color: '#1F2937' },
        { text: s.equipment?.subtype?.name ?? '-', color: '#6B7280' },
        {
          text: s.recurrenceType === 'CUSTOM'
            ? `${s.customIntervalDays}d`
            : (recurrenceLabels[s.recurrenceType] ?? s.recurrenceType),
          color: '#1F2937',
        },
        { text: fmt(s.nextRunAt), color: isOverdue ? '#DC2626' : '#1F2937' },
        { text: fmt(s.lastRunAt), color: '#1F2937' },
        { text: String(s._count.maintenances), color: '#1F2937' },
        { text: sit, color: sitColor },
      ]

      cells.forEach((cell, i) => {
        doc.fillColor(cell.color).fontSize(7.5).font(isOverdue && i === 7 ? 'Helvetica-Bold' : 'Helvetica')
        doc.text(cell.text, x + 3, y + 6, { width: cols[i].w - 6, ellipsis: true, lineBreak: false })
        x += cols[i].w
      })

      y += rowH
      if (sit === 'Atrasada') pdfGroupOverdue++
      pdfGroupCount++
      rowIdx++
    })

    if (groupByKey && currentPdfGroup !== '') drawGroupSubtotal(currentPdfGroup, pdfGroupCount, pdfGroupOverdue)

    this.drawPdfFooter(doc, template, y + 12)

    doc.end()
    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  // ─────────────────────────────────────────
  // FICHA DE VIDA DO EQUIPAMENTO
  // ─────────────────────────────────────────
  async getEquipmentLifeCycleData(companyId: string, equipmentId: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, companyId, deletedAt: null },
      include: {
        costCenter: { select: { name: true, code: true } },
        location: { select: { name: true } },
        type: { select: { name: true } },
        subtype: { select: { name: true } },
        serviceOrders: {
          orderBy: { createdAt: 'desc' },
          select: {
            number: true,
            title: true,
            maintenanceType: true,
            priority: true,
            status: true,
            description: true,
            resolution: true,
            actualHours: true,
            totalCost: true,
            completedAt: true,
            createdAt: true,
            technicians: {
              select: { technician: { select: { name: true } } },
            },
          },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          select: {
            type: true,
            status: true,
            reason: true,
            createdAt: true,
            origin: { select: { name: true } },
            destination: { select: { name: true } },
          },
        },
        schedules: {
          orderBy: { nextRunAt: 'asc' },
          select: {
            title: true,
            maintenanceType: true,
            recurrenceType: true,
            nextRunAt: true,
            lastRunAt: true,
            isActive: true,
            assignedTechnician: { select: { name: true } },
          },
        },
        currentAccessories: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          select: {
            name: true,
            brand: true,
            model: true,
            serialNumber: true,
            patrimonyNumber: true,
            qrCode: true,
            status: true,
            criticality: true,
            warrantyEnd: true,
            category: { select: { name: true } },
          },
        },
      },
    })

    if (!equipment) {
      throw new Error('Equipment not found')
    }

    return equipment
  }

  async exportEquipmentLifeCyclePdf(companyId: string, equipmentId: string): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default
    const [equipment, template] = await Promise.all([
      this.getEquipmentLifeCycleData(companyId, equipmentId),
      this.companiesService.getReportTemplate(companyId),
    ])
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: { top: 40, bottom: 40, left: 40, right: 40 } })
    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))

    const W = doc.page.width - 80
    const blue = template.primaryColor
    const secondaryBlue = template.secondaryColor || '#E0E7FF'

    const fmtDate = (d: Date | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'
    const fmtDateTime = (d: Date | null | undefined) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'
    const fmtM = (v: any) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'

    // ── Cabeçalho Principal ──
    const subtitle = `Ficha  ·  Gerado em: ${new Date().toLocaleDateString('pt-BR')}`
    let y = this.drawPdfHeader(doc, template, 'Ficha de Vida do Equipamento', subtitle, logoBuffer)

    // ── 1. Dados Técnicos e Cadastrais ──
    doc.fillColor(blue).fontSize(12).font('Helvetica-Bold').text('Dados Cadastrais e Técnicos', 40, y + 10)
    doc.rect(40, y + 25, W, 1).fill(secondaryBlue)
    y += 35
    
    const EQUIPMENT_STATUS_LABEL: Record<string, string> = {
      ACTIVE: "Ativo",
      BORROWED: "Emprestado",
      UNDER_MAINTENANCE: "Em manutenção",
      INACTIVE: "Inativo",
      DISPOSED: "Descartado",
    }
    
    const EQUIPMENT_CRITICALITY_LABEL: Record<string, string> = {
      LOW: "Baixa",
      MEDIUM: "Média",
      HIGH: "Alta",
      CRITICAL: "Crítica",
    }

    const fields = [
      { label: 'Equipamento:', value: equipment.name },
      { label: 'Patrimônio:', value: equipment.patrimonyNumber ?? '-' },
      { label: 'Nº Série:', value: equipment.serialNumber ?? '-' },
      { label: 'Nº ANVISA:', value: equipment.anvisaNumber ?? '-' },
      { label: 'Marca / Modelo:', value: [equipment.brand, equipment.model].filter(Boolean).join(' / ') || '-' },
      { label: 'Tipo / Subtipo:', value: [equipment.type?.name, equipment.subtype?.name].filter(Boolean).join(' › ') || '-' },
      { label: 'Localização:', value: equipment.location?.name ?? 'Não definido' },
      { label: 'Centro de Custo:', value: equipment.costCenter?.name ?? 'Não definido' },
      { label: 'Status:', value: EQUIPMENT_STATUS_LABEL[equipment.status] || equipment.status },
      { label: 'Criticidade:', value: EQUIPMENT_CRITICALITY_LABEL[equipment.criticality] || equipment.criticality },
      { label: 'Aquis. (Data/Vlr):', value: `${fmtDate(equipment.purchaseDate)} / ${fmtM(equipment.purchaseValue)}` },
      { label: 'Nº Nota Fiscal:', value: equipment.invoiceNumber ?? '-' },
      { label: 'Garantia:', value: `Desde ${fmtDate(equipment.warrantyStart)} até ${fmtDate(equipment.warrantyEnd)}` },
      { label: 'Últ. Manutenção:', value: fmtDate(equipment.lastMaintenanceAt) },
    ]

    let col = 0
    const colW = W / 2
    let rowY = y
    
    doc.fontSize(8.5)
    fields.forEach((f, i) => {
      const cx = 40 + (col * colW)
      doc.fillColor('#6B7280').font('Helvetica-Bold').text(f.label, cx, rowY, { width: 90 })
      doc.fillColor('#1F2937').font('Helvetica').text(f.value, cx + 90, rowY, { width: colW - 90, ellipsis: true })
      
      col++
      if (col > 1) {
        col = 0
        rowY += 16
      }
    })
    
    y = rowY + (col === 0 ? 0 : 16) + 10

    if (equipment.observations) {
      doc.fillColor('#6B7280').font('Helvetica-Bold').text('Observações:', 40, y)
      doc.fillColor('#1F2937').font('Helvetica').text(equipment.observations, 40, y + 12, { width: W })
      y += 12 + doc.heightOfString(equipment.observations, { width: W }) + 10
    }

    // ── Bloco financeiro / depreciação (condicional) ──
    if (equipment.currentValue || equipment.depreciationRate) {
      doc.fillColor(blue).fontSize(10).font('Helvetica-Bold').text('Dados Financeiros / Depreciação', 40, y + 8)
      doc.rect(40, y + 21, W, 1).fill(secondaryBlue)
      y += 28
      const finFields = [
        { label: 'Valor Atual (Depreciado):', value: fmtM(equipment.currentValue) },
        { label: 'Taxa de Depreciação:', value: equipment.depreciationRate ? `${Number(equipment.depreciationRate).toLocaleString('pt-BR')}% a.a.` : '-' },
      ]
      let finCol = 0
      doc.fontSize(8.5)
      finFields.forEach((f) => {
        const cx = 40 + (finCol * colW)
        doc.fillColor('#6B7280').font('Helvetica-Bold').text(f.label, cx, y, { width: 115 })
        doc.fillColor('#1F2937').font('Helvetica').text(f.value, cx + 115, y, { width: colW - 115, ellipsis: true })
        finCol++
        if (finCol > 1) { finCol = 0; y += 16 }
      })
      y += (finCol === 0 ? 0 : 16) + 8
    }

    // ── Bloco técnico elétrico (condicional) ──
    if (equipment.voltage || equipment.power || equipment.btus) {
      doc.fillColor(blue).fontSize(10).font('Helvetica-Bold').text('Dados Técnicos', 40, y + 8)
      doc.rect(40, y + 21, W, 1).fill(secondaryBlue)
      y += 28
      const techFields = [
        { label: 'Tensão:', value: equipment.voltage ?? '-' },
        { label: 'Potência:', value: equipment.power ?? '-' },
        { label: 'BTUs:', value: equipment.btus ? String(equipment.btus) : '-' },
      ]
      let techCol = 0
      doc.fontSize(8.5)
      techFields.forEach((f) => {
        const cx = 40 + (techCol * colW)
        doc.fillColor('#6B7280').font('Helvetica-Bold').text(f.label, cx, y, { width: 90 })
        doc.fillColor('#1F2937').font('Helvetica').text(f.value, cx + 90, y, { width: colW - 90, ellipsis: true })
        techCol++
        if (techCol > 1) { techCol = 0; y += 16 }
      })
      y += (techCol === 0 ? 0 : 16) + 8
    }

    // Função auxiliar genérica para cabeçalho de tabela
    // columns = { w, label }
    const drawTableHeader = (title: string, tableCols: any, localY: number) => {
      doc.fillColor(blue).fontSize(12).font('Helvetica-Bold').text(title, 40, localY)
      let tableY = localY + 20
      doc.rect(40, tableY, W, 20).fill(secondaryBlue)
      doc.fillColor(this.getContrastColor(secondaryBlue)).fontSize(8).font('Helvetica-Bold')
      let x = 40
      tableCols.forEach((c: any) => {
        doc.text(c.label, x + 3, tableY + 6, { width: c.w - 6, ellipsis: true })
        x += c.w
      })
      return tableY + 20
    }

    // ── 2. Histórico de Manutenções (OS) ──
    if (y > doc.page.height - 150) { doc.addPage(); y = 40 }
    else { y += 20 }

    const OS_STATUS_LABEL: Record<string, string> = {
      OPEN: "Aberta", AWAITING_PICKUP: "Aguardando", IN_PROGRESS: "Em andamento",
      COMPLETED: "Concluída", COMPLETED_APPROVED: "Aprovada", COMPLETED_REJECTED: "Reprovada", CANCELLED: "Cancelada",
    }

    const OS_TYPE_LABEL: Record<string, string> = {
      PREVENTIVE: "Preventiva", CORRECTIVE: "Corretiva", INITIAL_ACCEPTANCE: "Aceite Inicial",
      EXTERNAL_SERVICE: "Serviço Externo", TECHNOVIGILANCE: "Tecnovigilância",
      TRAINING: "Treinamento", IMPROPER_USE: "Uso Indevido", DEACTIVATION: "Desativação",
    }

    const OS_PRIORITY_LABEL: Record<string, string> = {
      LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente",
    }

    // Colunas da linha de cabeçalho por OS (total = W = 515)
    const osCols = [
      { label: 'Nº OS',      w: 40 },
      { label: 'Tipo',       w: 75 },
      { label: 'Prioridade', w: 60 },
      { label: 'Status',     w: 70 },
      { label: 'Aberta em',  w: 65 },
      { label: 'Concluída',  w: 65 },
      { label: 'Técnico(s)', w: 85 },
      { label: 'Custo',      w: 55 },
    ]

    y = drawTableHeader(`Histórico de Manutenções (${equipment.serviceOrders.length})`, osCols, y)

    let rowIdx = 0
    let totalOsCost = 0
    const HEADER_H = 18
    const DETAIL_PAD = 5

    if (equipment.serviceOrders.length === 0) {
      doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(8.5)
        .text('Nenhuma ordem de serviço registrada.', 45, y + 10)
      y += 30
    } else {
      equipment.serviceOrders.forEach((os) => {
        if (os.totalCost) totalOsCost += Number(os.totalCost)

        const titleLine = os.title ? os.title.trim() : ''
        const hoursLine = os.actualHours ? `${Number(os.actualHours).toLocaleString('pt-BR')}h` : ''
        const descLine  = os.description ? os.description.replace(/\n/g, ' ') : ''
        const resLine   = os.resolution  ? os.resolution.replace(/\n/g, ' ')  : ''
        const line1 = [titleLine && `Título: ${titleLine}`, hoursLine && `Horas efetivas: ${hoursLine}`].filter(Boolean).join('  ·  ')
        const line2 = [descLine && `Desc.: ${descLine}`, resLine && `Resolução: ${resLine}`].filter(Boolean).join('  |  ')
        const detailText = [line1, line2].filter(Boolean).join('\n') || '-'

        doc.fontSize(7)
        const detailH = doc.heightOfString(detailText, { width: W - 12 }) + DETAIL_PAD * 2
        const totalH = HEADER_H + detailH

        if (y + totalH > doc.page.height - 80) {
          doc.addPage()
          y = drawTableHeader(`Histórico de Manutenções (cont.)`, osCols, 40)
          rowIdx = 0
        }

        const bgColor = rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'

        // Linha de cabeçalho da OS
        doc.rect(40, y, W, HEADER_H).fill(bgColor).stroke('#E2E8F0')
        const techNames = (os.technicians as { technician: { name: string } }[]).map(t => t.technician.name).join(', ') || '-'
        const headerCells = [
          String(os.number),
          OS_TYPE_LABEL[os.maintenanceType] || os.maintenanceType,
          OS_PRIORITY_LABEL[os.priority] || os.priority,
          OS_STATUS_LABEL[os.status] || os.status,
          fmtDate(os.createdAt),
          fmtDate(os.completedAt),
          techNames,
          os.totalCost ? fmtM(os.totalCost) : '-',
        ]
        let cx = 40
        doc.fontSize(7.5).font('Helvetica').fillColor('#1F2937')
        headerCells.forEach((text, i) => {
          doc.text(text, cx + 3, y + 4, { width: osCols[i].w - 6, height: HEADER_H - 8, lineBreak: false, ellipsis: true })
          cx += osCols[i].w
        })

        // Linha de detalhe: descrição e resolução
        const detailY = y + HEADER_H
        doc.rect(40, detailY, W, detailH).fill(bgColor).stroke('#E2E8F0')
        doc.fontSize(7).font('Helvetica').fillColor('#374151')
        doc.text(detailText, 46, detailY + DETAIL_PAD, { width: W - 12, lineBreak: true })

        y += totalH
        rowIdx++
      })

      // Totalizador de custo
      if (totalOsCost > 0) {
        if (y + 20 > doc.page.height - 80) { doc.addPage(); y = 40 }
        doc.rect(40, y, W, 20).fill(secondaryBlue).stroke('#E2E8F0')
        doc.fontSize(8).font('Helvetica-Bold').fillColor(this.getContrastColor(secondaryBlue))
        doc.text('Custo Total de Manutenções:', 43, y + 6, { width: W - 100 })
        doc.text(fmtM(totalOsCost), 40, y + 6, { width: W - 5, align: 'right' })
        y += 20
      }
    }

    // ── 3. Histórico de Transferências ──
    if (y > doc.page.height - 150) { doc.addPage(); y = 40 }
    else { y += 20 }

    const movCols = [
      { label: 'Tipo',         w: 65 },
      { label: 'Data',         w: 70 },
      { label: 'Origem',       w: 90 },
      { label: 'Destino',      w: 90 },
      { label: 'Motivo',       w: W - 370 },
      { label: 'Status',       w: 55 },
    ]

    y = drawTableHeader(`Histórico de Transferências (${equipment.movements.length})`, movCols, y)

    const MOVEMENT_TYPE_LABEL: Record<string, string> = {
      TRANSFER: 'Transferência', LOAN: 'Empréstimo',
    }

    const MOVEMENT_STATUS_LABEL: Record<string, string> = {
      ACTIVE: 'Ativo', CANCELLED: 'Cancelado', RETURNED: 'Devolvido'
    }

    rowIdx = 0
    if (equipment.movements.length === 0) {
        doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(8.5)
          .text('Nenhuma transferência registrada.', 45, y + 10)
        y += 30
    } else {
      equipment.movements.forEach((mov) => {
        doc.fontSize(7.5)
        const textH = doc.heightOfString(mov.reason || '-', { width: movCols[4].w - 6 })
        const rowH = Math.max(18, textH + 8)

        if (y + rowH > doc.page.height - 80) {
          doc.addPage()
          y = drawTableHeader(`Histórico de Transferências (cont.)`, movCols, 40)
          rowIdx = 0
        }

        doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')

        let cx = 40
        const rowData = [
          { text: MOVEMENT_TYPE_LABEL[mov.type] || mov.type, font: 'Helvetica' },
          { text: fmtDateTime(mov.createdAt), font: 'Helvetica' },
          { text: mov.origin?.name || '-', font: 'Helvetica' },
          { text: mov.destination?.name || '-', font: 'Helvetica' },
          { text: (mov.reason || '').replace(/\n/g, ' '), font: 'Helvetica' },
          { text: MOVEMENT_STATUS_LABEL[mov.status] || mov.status, font: 'Helvetica' },
        ]

        rowData.forEach((cell, i) => {
          doc.fillColor('#1F2937').fontSize(7.5).font(cell.font)
          doc.text(cell.text, cx + 3, y + 4, { width: movCols[i].w - 6, height: rowH - 8, lineBreak: true, ellipsis: true })
          cx += movCols[i].w
        })

        y += rowH
        rowIdx++
      })
    }

    // ── 4. Acessórios Vinculados ──
    if (y > doc.page.height - 150) { doc.addPage(); y = 40 }
    else { y += 20 }

    const ACCESSORY_STATUS_LABEL: Record<string, string> = {
      AVAILABLE: 'Disponível', IN_USE: 'Em uso',
      UNDER_MAINTENANCE: 'Em manutenção', LOANED: 'Emprestado',
      SCRAPPED: 'Baixado', LOST: 'Extraviado',
    }

    const accCols = [
      { label: 'Nome',            w: 120 },
      { label: 'Categoria',       w: 75 },
      { label: 'Marca / Modelo',  w: 90 },
      { label: 'Série',           w: 80 },
      { label: 'Patrimônio',      w: 70 },
      { label: 'Status',          w: W - 435 },
    ]

    const accessories = (equipment as any).currentAccessories as {
      name: string; brand: string | null; model: string | null
      serialNumber: string | null; patrimonyNumber: string | null
      qrCode: string | null; status: string; criticality: string
      warrantyEnd: Date | null; category: { name: string } | null
    }[]

    y = drawTableHeader(`Acessórios Vinculados (${accessories.length})`, accCols, y)

    rowIdx = 0
    if (accessories.length === 0) {
      doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(8.5)
        .text('Nenhum acessório vinculado a este equipamento.', 45, y + 10)
      y += 30
    } else {
      accessories.forEach((acc) => {
        const rowH = 20
        if (y + rowH > doc.page.height - 80) {
          doc.addPage()
          y = drawTableHeader(`Acessórios Vinculados (cont.)`, accCols, 40)
          rowIdx = 0
        }

        const bgColor = rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
        doc.rect(40, y, W, rowH).fill(bgColor).stroke('#E2E8F0')

        // Alerta visual se garantia vencendo (≤ 30 dias) ou vencida
        const warnColor = (() => {
          if (!acc.warrantyEnd) return null
          const days = Math.ceil((new Date(acc.warrantyEnd).getTime() - Date.now()) / 86_400_000)
          if (days <= 0) return '#EF4444'
          if (days <= 30) return '#F59E0B'
          return null
        })()

        const accCells = [
          acc.name,
          acc.category?.name ?? '-',
          [acc.brand, acc.model].filter(Boolean).join(' / ') || '-',
          acc.serialNumber ?? '-',
          acc.patrimonyNumber ?? '-',
          ACCESSORY_STATUS_LABEL[acc.status] ?? acc.status,
        ]

        let cx = 40
        doc.fontSize(7.5).font('Helvetica').fillColor('#1F2937')
        accCells.forEach((text, i) => {
          // Destacar nome em vermelho/âmbar quando garantia vencendo
          if (i === 0 && warnColor) doc.fillColor(warnColor)
          else doc.fillColor('#1F2937')
          doc.text(text, cx + 3, y + 4, { width: accCols[i].w - 6, height: rowH - 8, lineBreak: false, ellipsis: true })
          cx += accCols[i].w
        })

        // Ícone textual de alerta de garantia na última coluna
        if (warnColor && acc.warrantyEnd) {
          const days = Math.ceil((new Date(acc.warrantyEnd).getTime() - Date.now()) / 86_400_000)
          const msg = days <= 0 ? '⚠ Gar. vencida' : `⚠ ${days}d`
          doc.fillColor(warnColor).fontSize(6.5).font('Helvetica-Bold')
            .text(msg, 40 + W - 55, y + 5, { width: 52, lineBreak: false })
        }

        y += rowH
        rowIdx++
      })
    }

    // ── 5. Agendamentos de Manutenção Preventiva ──
    if (y > doc.page.height - 150) { doc.addPage(); y = 40 }
    else { y += 20 }

    const RECURRENCE_LABEL: Record<string, string> = {
      DAILY: 'Diária', WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal',
      MONTHLY: 'Mensal', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral',
      ANNUAL: 'Anual', CUSTOM: 'Personalizada',
    }

    const schCols = [
      { label: 'Título',        w: 105 },
      { label: 'Tipo',          w: 75 },
      { label: 'Recorrência',   w: 70 },
      { label: 'Última exec.',  w: 65 },
      { label: 'Próxima exec.', w: 65 },
      { label: 'Técnico',       w: 80 },
      { label: 'Status',        w: 55 },
    ]

    y = drawTableHeader(`Agendamentos de Manutenção Preventiva (${equipment.schedules.length})`, schCols, y)

    rowIdx = 0
    if (equipment.schedules.length === 0) {
      doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(8.5)
        .text('Nenhum agendamento de manutenção preventiva registrado.', 45, y + 10)
      y += 30
    } else {
      equipment.schedules.forEach((sch) => {
        const rowH = 20
        if (y + rowH > doc.page.height - 80) {
          doc.addPage()
          y = drawTableHeader(`Agendamentos de Manutenção Preventiva (cont.)`, schCols, 40)
          rowIdx = 0
        }

        const bgColor = rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
        doc.rect(40, y, W, rowH).fill(bgColor).stroke('#E2E8F0')

        const schCells = [
          sch.title,
          OS_TYPE_LABEL[sch.maintenanceType] || sch.maintenanceType,
          RECURRENCE_LABEL[sch.recurrenceType] || sch.recurrenceType,
          fmtDate(sch.lastRunAt),
          fmtDate(sch.nextRunAt),
          (sch.assignedTechnician as { name: string } | null)?.name || '-',
          sch.isActive ? 'Ativo' : 'Inativo',
        ]

        let cx = 40
        doc.fontSize(7.5).font('Helvetica').fillColor('#1F2937')
        schCells.forEach((text, i) => {
          doc.text(text, cx + 3, y + 4, { width: schCols[i].w - 6, height: rowH - 8, lineBreak: false, ellipsis: true })
          cx += schCols[i].w
        })

        y += rowH
        rowIdx++
      })
    }

    this.drawPdfFooter(doc, template, doc.page.height - 40)
    doc.end()

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  // ─────────────────────────────────────────
  // Etiqueta vertical 30×50mm para Zebra
  // Layout:
  //   [Logo esq.] [Nome empresa]
  //   N° Patrimônio (centralizado)
  //   Tipo · Subtipo (centralizados)
  //   QR Code (preenche restante)
  // ─────────────────────────────────────────
  private async drawEquipmentLabelPage(
    doc: any,
    equipmentId: string,
    equipment: { patrimonyNumber?: string | null; type?: { name: string } | null; subtype?: { name: string } | null },
    logoBuffer: Buffer | null,
    template: ReportTemplate,
  ): Promise<void> {
    const QRCodeLib = await import('qrcode')

    const W = 85.04
    const H = 141.73
    const PAD = 5
    const CX = W / 2

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001'
    const qrUrl = `${frontendUrl}/equipamentos?detail=${equipmentId}`
    const qrPng = await QRCodeLib.toBuffer(qrUrl, {
      type: 'png',
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
    })

    doc.addPage({ size: [W, H], margins: { top: 0, bottom: 0, left: 0, right: 0 } })

    let y = PAD
    const LOGO_PT = 20

    const hasHeader = logoBuffer || template.companyName
    if (hasHeader) {
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, PAD, y, { fit: [LOGO_PT, LOGO_PT] })
        } catch { /* formato não suportado */ }
      }

      if (template.companyName) {
        const nameX  = logoBuffer ? PAD + LOGO_PT + 3 : PAD
        const nameW  = W - nameX - PAD
        const nameFz = template.companyName.length > 20 ? 5 : 5.5
        const nameY  = y + (LOGO_PT - nameFz * 1.2 - (template.document ? 6 : 0)) / 2
        doc.font('Helvetica-Bold').fontSize(nameFz).fillColor('#1a1a1a')
        doc.text(template.companyName, nameX, nameY, { width: nameW, lineBreak: true, ellipsis: true })

        if (template.document) {
          doc.font('Helvetica').fontSize(4.5).fillColor('#6B7280')
          doc.text(template.document, nameX, nameY + nameFz + 2, { width: nameW, lineBreak: false, ellipsis: true })
        }
      }

      y += LOGO_PT + 5
      doc.moveTo(PAD, y).lineTo(W - PAD, y).lineWidth(0.4).strokeColor('#d1d5db').stroke()
      y += 4
    }

    if (equipment.patrimonyNumber) {
      const pat      = equipment.patrimonyNumber
      const fontSize = pat.length > 16 ? 6 : 7
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#000000')
      doc.text(`N° ${pat}`, PAD, y, { width: W - PAD * 2, align: 'center', lineBreak: false, ellipsis: true })
      y += fontSize + 6
    }

    const categoryLabel = equipment.subtype?.name ?? equipment.type?.name
    if (categoryLabel) {
      doc.font('Helvetica').fontSize(6).fillColor('#111827')
      doc.text(categoryLabel, PAD, y, { width: W - PAD * 2, align: 'center', lineBreak: false, ellipsis: true })
      y += 11
    }

    const BOTTOM_PAD = 10
    const qrAvail = H - y - BOTTOM_PAD
    const QR_PT   = Math.min(qrAvail, W - PAD * 2)
    const qrX     = CX - QR_PT / 2
    doc.image(qrPng, qrX, y + (qrAvail - QR_PT) / 2, { width: QR_PT, height: QR_PT })
  }

  async generateEquipmentLabel(companyId: string, equipmentId: string): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default

    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, companyId },
      select: {
        patrimonyNumber: true,
        type:    { select: { name: true } },
        subtype: { select: { name: true } },
      },
    })
    if (!equipment) throw new Error('Equipamento não encontrado')

    const template = await this.companiesService.getReportTemplate(companyId)
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)

    const W = 85.04
    const H = 141.73

    const doc = new PDFDocument({
      size: [W, H],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    })

    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))

    await this.drawEquipmentLabelPage(doc, equipmentId, equipment, logoBuffer, template)

    doc.end()

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }

  async generateEquipmentLabelsBatch(companyId: string, equipmentIds: string[]): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default

    const equipments = await this.prisma.equipment.findMany({
      where: { id: { in: equipmentIds }, companyId },
      select: {
        id: true,
        patrimonyNumber: true,
        type:    { select: { name: true } },
        subtype: { select: { name: true } },
      },
    })

    const template = await this.companiesService.getReportTemplate(companyId)
    const logoBuffer = await this.fetchLogoBuffer(template.logoUrl)

    const W = 85.04
    const H = 141.73

    const doc = new PDFDocument({
      size: [W, H],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    })

    const buffers: Buffer[] = []
    doc.on('data', (c: Buffer) => buffers.push(c))

    for (const eq of equipments) {
      await this.drawEquipmentLabelPage(doc, eq.id, eq, logoBuffer, template)
    }

    doc.end()

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }
}