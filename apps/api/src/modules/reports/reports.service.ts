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
    const BODY_H = 80
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

    // Título do relatório (em caixa alta, branco)
    const pTextX = panelX + 14
    const pTextW = panelW - 20
    doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
      .text(title.toUpperCase(), pTextX, bodyTop + 14, { width: pTextW, lineBreak: true })

    // Subtítulo — quebramos por · e exibimos uma linha por item
    const subParts = subtitle.split(/[·]/).map((s) => s.trim()).filter(Boolean)
    let sy = bodyTop + 14 + 18
    subParts.forEach((part) => {
      if (sy < bodyTop + BODY_H - 8) {
        doc.fillColor('#CBD5E1').fontSize(7.5).font('Helvetica')
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
    const [orders, template] = await Promise.all([
      this.getServiceOrdersData(companyId, filters),
      this.companiesService.getReportTemplate(companyId),
    ])

    const workbook = new ExcelJS.default.Workbook()
    workbook.creator = template.companyName || 'Sistema de Manutenção'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Ordens de Serviço', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    })

    // ── Cabeçalho com estilo ──
    const headerStyle: Partial<import('exceljs').Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
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
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
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
    const [orders, template] = await Promise.all([
      this.getServiceOrdersData(companyId, filters),
      this.companiesService.getReportTemplate(companyId),
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
    const subtitle = `Gerado em: ${dateStr}  ·  Total: ${orders.length} OS${groupBy ? `  ·  Quebra: ${groupBy}` : ''}`
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
      doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
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
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
          .text(`  ${groupKey}`, 43, y + 6, { width: W - 6, lineBreak: false })
        y += ghH
        currentGroup = groupKey
        groupCount = 0
        groupAvgHours = []
        rowIdx = 0
      }

      if (y > doc.page.height - 80) { doc.addPage(); y = drawTableHeader(40); rowIdx = 0 }

      const rowH = 18
      doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')
      doc.fillColor('#1F2937').fontSize(7.5).font('Helvetica')
      let x = 40

      const cells = [
        String(os.number), os.title, os.client?.name ?? '-',
        typeLabels[os.maintenanceType] ?? '-', statusLabels[os.status] ?? '-',
        os.technicians[0]?.technician.name ?? '-', fmt(os.createdAt), fmt(os.completedAt),
      ]
      cells.forEach((text, i) => {
        doc.text(text, x + 3, y + 5, { width: cols[i].w - 6, ellipsis: true, lineBreak: false })
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
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
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
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
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
      const subtitle = `Gerado em: ${dateStr}  ·  Total: ${items.length} equipamento(s)`
      let y = this.drawPdfHeader(doc, template, template.headerTitle || 'Inventário de Equipamentos', subtitle, logoBuffer)

      let x = 40

      const drawTableHeader = () => {
        x = 40
        doc.rect(40, y, W, 20).fill(template.secondaryColor)
        doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
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

            doc.rect(40, y, W, 18).fill(blue)
            doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
              .text(groupLabel, 45, y + 5, { width: W - 10, ellipsis: true })
            y += 18
            rowIdx = 0
          }
        }

        if (y > doc.page.height - 80) { doc.addPage(); y = 40; drawTableHeader(); rowIdx = 0 }

        const rowH = 18
        doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')
        doc.fillColor('#1F2937').fontSize(7.5).font('Helvetica')
        x = 40

        cols.forEach((col) => {
          const text = COLUMN_DEFS[col.key].getValue(eq)
          doc.text(String(text), x + 3, y + 5, { width: col.w - 6, ellipsis: true, lineBreak: false })
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
    filters: { isActive?: boolean; typeId?: string; recurrenceType?: string },
    effectiveClientId?: string | null,
  ) {
    return this.prisma.maintenanceSchedule.findMany({
      where: {
        companyId,
        ...(effectiveClientId ? { clientId: effectiveClientId } : {}),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.typeId && { equipment: { typeId: { in: filters.typeId.split(',') } } }),
        ...(filters.recurrenceType && { recurrenceType: { in: filters.recurrenceType.split(',') as any } }),
      },
      select: {
        title: true,
        maintenanceType: true,
        recurrenceType: true,
        customIntervalDays: true,
        nextRunAt: true,
        lastRunAt: true,
        isActive: true,
        equipment: {
          select: {
            name: true,
            serialNumber: true,
            type: { select: { name: true } },
            costCenter: { select: { name: true } },
          },
        },
        group: { select: { name: true } },
        client: { select: { name: true } },
        _count: { select: { maintenances: true } },
      },
      orderBy: { nextRunAt: 'asc' },
    })
  }

  async exportPreventiveExcel(
    companyId: string,
    filters: { clientId?: string; isActive?: boolean; typeId?: string; recurrenceType?: string },
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
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
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
      { header: 'Grupo', key: 'group', width: 16 },
      { header: 'Tipo Manut.', key: 'maintType', width: 14 },
      { header: 'Recorrência', key: 'recurrence', width: 14 },
      { header: 'Próxima OS', key: 'nextRun', width: 16 },
      { header: 'Última OS', key: 'lastRun', width: 16 },
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

    items.forEach((s, idx) => {
      const sit = situacao(s)
      const row = sheet.addRow({
        title: s.title,
        client: s.client?.name ?? '-',
        equipment: s.equipment?.name ?? '-',
        serial: s.equipment?.serialNumber ?? '-',
        sector: s.equipment?.costCenter?.name ?? '-',
        equipType: s.equipment?.type?.name ?? '-',
        group: s.group?.name ?? '-',
        maintType: maintTypeLabels[s.maintenanceType] ?? s.maintenanceType,
        recurrence: s.recurrenceType === 'CUSTOM'
          ? `A cada ${s.customIntervalDays} dia(s)`
          : (recurrenceLabels[s.recurrenceType] ?? s.recurrenceType),
        nextRun: fmt(s.nextRunAt),
        lastRun: fmt(s.lastRunAt),
        count: s._count.maintenances,
        situation: sit,
      })

      if (idx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }
        })
      }
      row.height = 18

      // Próxima OS em vermelho se atrasada
      if (sit === 'Atrasada') {
        row.getCell(10).font = { bold: true, color: { argb: 'FFDC2626' } }
      }
      // Situação colorida
      const sitArgb = sit === 'Em dia' ? 'FF16A34A' : sit === 'Atrasada' ? 'FFDC2626' : 'FF6B7280'
      row.getCell(13).font = { bold: true, color: { argb: sitArgb } }
    })

    const overdueCount = items.filter((s) => s.isActive && s.nextRunAt && s.nextRunAt < now).length

    const totalRow = sheet.addRow([
      `${template.companyName} — Total: ${items.length} | Atrasadas: ${overdueCount}`,
      ...Array(12).fill(''),
    ])
    totalRow.font = { bold: true, italic: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + template.secondaryColor.replace('#', '') } }
    if (overdueCount > 0) totalRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } }

    sheet.autoFilter = { from: 'A1', to: 'M1' }
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  async exportPreventivePdf(
    companyId: string,
    filters: { clientId?: string; isActive?: boolean; typeId?: string; recurrenceType?: string },
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

    const subtitle = `${dateStr}  ·  Total: ${items.length}  ·  Atrasadas: ${overdueCount}`
    let y = this.drawPdfHeader(doc, template, 'Manutenções Preventivas', subtitle, logoBuffer)

    // Cols total ≈ 760 (landscape A4 - 80 margins)
    const cols = [
      { label: 'Agendamento', w: 148 },
      { label: 'Equip.', w: 90 },
      { label: 'Nº Série', w: 60 },
      { label: 'Setor', w: 70 },
      { label: 'Tipo Equip.', w: 70 },
      { label: 'Recorrência', w: 65 },
      { label: 'Próxima OS', w: 65 },
      { label: 'Última OS', w: 65 },
      { label: 'Ocorr.', w: 47 },
      { label: 'Situação', w: 60 },
    ]

    let x = 40
    doc.rect(40, y, W, 20).fill(template.secondaryColor)
    doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
    cols.forEach((col) => {
      doc.text(col.label, x + 3, y + 6, { width: col.w - 6, ellipsis: true })
      x += col.w
    })
    y += 20
    let rowIdx = 0

    items.forEach((s) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 40; rowIdx = 0 }

      const rowH = 18
      const sit = situacao(s)
      const isOverdue = sit === 'Atrasada'
      const sitColor = sit === 'Em dia' ? '#16A34A' : sit === 'Atrasada' ? '#DC2626' : '#6B7280'

      doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')

      x = 40
      const cells = [
        { text: s.title, color: '#1F2937' },
        { text: s.equipment?.name ?? '-', color: '#1F2937' },
        { text: s.equipment?.serialNumber ?? '-', color: '#1F2937' },
        { text: s.equipment?.costCenter?.name ?? '-', color: '#1F2937' },
        { text: s.equipment?.type?.name ?? '-', color: '#1F2937' },
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
        doc.fillColor(cell.color).fontSize(7.5).font(isOverdue && i === 6 ? 'Helvetica-Bold' : 'Helvetica')
        doc.text(cell.text, x + 3, y + 5, { width: cols[i].w - 6, ellipsis: true, lineBreak: false })
        x += cols[i].w
      })

      y += rowH
      rowIdx++
    })

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
            maintenanceType: true,
            status: true,
            description: true,
            resolution: true,
            completedAt: true,
            createdAt: true,
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
      { label: 'Marca / Modelo:', value: [equipment.brand, equipment.model].filter(Boolean).join(' / ') || '-' },
      { label: 'Tipo:', value: equipment.type?.name ?? '-' },
      { label: 'Localização:', value: equipment.location?.name ?? 'Não definido' },
      { label: 'Centro de Custo:', value: equipment.costCenter?.name ?? 'Não definido' },
      { label: 'Status:', value: EQUIPMENT_STATUS_LABEL[equipment.status] || equipment.status },
      { label: 'Criticidade:', value: EQUIPMENT_CRITICALITY_LABEL[equipment.criticality] || equipment.criticality },
      { label: 'Aquis. (Data/Vlr):', value: `${fmtDate(equipment.purchaseDate)} / ${fmtM(equipment.purchaseValue)}` },
      { label: 'Garantia:', value: `Desde ${fmtDate(equipment.warrantyStart)} até ${fmtDate(equipment.warrantyEnd)}` },
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

    // Função auxiliar genérica para cabeçalho de tabela
    // columns = { w, label }
    const drawTableHeader = (title: string, tableCols: any, localY: number) => {
      doc.fillColor(blue).fontSize(12).font('Helvetica-Bold').text(title, 40, localY)
      let tableY = localY + 20
      doc.rect(40, tableY, W, 20).fill(secondaryBlue)
      doc.fillColor(blue).fontSize(8).font('Helvetica-Bold')
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

    const osCols = [
      { label: 'Nº OS', w: 45 },
      { label: 'Data', w: 60 },
      { label: 'Tipo', w: 65 },
      { label: 'Status', w: 70 },
      { label: 'Descrição / Resolução (Resumo)', w: W - 240 },
    ]

    y = drawTableHeader(`Histórico de Manutenções (${equipment.serviceOrders.length})`, osCols, y)

    const OS_STATUS_LABEL: Record<string, string> = {
      OPEN: "Aberta", AWAITING_PICKUP: "Aguardando", IN_PROGRESS: "Em andamento",
      COMPLETED: "Concluída", COMPLETED_APPROVED: "Aprovada", COMPLETED_REJECTED: "Reprovada", CANCELLED: "Cancelada",
    }
    
    const OS_TYPE_LABEL: Record<string, string> = {
      PREVENTIVE: "Preventiva", CORRECTIVE: "Corretiva", INITIAL_ACCEPTANCE: "Aceite Inicial",
      EXTERNAL_SERVICE: "Serviço Externo", TECHNOVIGILANCE: "Tecnovigilância",
      TRAINING: "Treinamento", IMPROPER_USE: "Uso Indevido", DEACTIVATION: "Desativação",
    }

    let rowIdx = 0
    if (equipment.serviceOrders.length === 0) {
      doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(8.5)
        .text('Nenhuma ordem de serviço registrada.', 45, y + 10)
      y += 30
    } else {
      equipment.serviceOrders.forEach((os) => {
        doc.fontSize(7.5)
        const textH = doc.heightOfString(os.description || '-', { width: osCols[4].w - 6 })
        const rowH = Math.max(18, textH + 8)

        if (y + rowH > doc.page.height - 80) { 
          doc.addPage(); 
          y = drawTableHeader(`Histórico de Manutenções (cont.)`, osCols, 40); 
          rowIdx = 0; 
        }

        doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')
        
        let cx = 40
        const dateStr = fmtDate(os.createdAt)
        const descText = (os.description || '').replace(/\n/g, ' ')
        
        const rowData = [
          { text: String(os.number), font: 'Helvetica' },
          { text: dateStr, font: 'Helvetica' },
          { text: OS_TYPE_LABEL[os.maintenanceType] || os.maintenanceType, font: 'Helvetica' },
          { text: OS_STATUS_LABEL[os.status] || os.status, font: 'Helvetica' },
          { text: descText, font: 'Helvetica' },
        ]

        rowData.forEach((cell, i) => {
          doc.fillColor('#1F2937').fontSize(7.5).font(cell.font)
          doc.text(cell.text, cx + 3, y + 4, { width: osCols[i].w - 6, height: rowH - 8, lineBreak: true, ellipsis: true })
          cx += osCols[i].w
        })

        y += rowH
        rowIdx++
      })
    }

    // ── 3. Histórico de Transferências ──
    if (y > doc.page.height - 150) { doc.addPage(); y = 40 }
    else { y += 20 }

    const movCols = [
      { label: 'Modificado Em', w: 85 },
      { label: 'Origem', w: 100 },
      { label: 'Destino', w: 100 },
      { label: 'Motivo', w: W - 360 },
      { label: 'Status', w: 75 },
    ]

    y = drawTableHeader(`Histórico de Transferências (${equipment.movements.length})`, movCols, y)

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
        const textH = doc.heightOfString(mov.reason || '-', { width: movCols[3].w - 6 })
        const rowH = Math.max(18, textH + 8)

        if (y + rowH > doc.page.height - 80) { 
          doc.addPage(); 
          y = drawTableHeader(`Histórico de Transferências (cont.)`, movCols, 40); 
          rowIdx = 0; 
        }

        doc.rect(40, y, W, rowH).fill(rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC').stroke('#E2E8F0')
        
        let cx = 40
        const rowData = [
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

    this.drawPdfFooter(doc, template, doc.page.height - 40)
    doc.end()

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)
    })
  }
}