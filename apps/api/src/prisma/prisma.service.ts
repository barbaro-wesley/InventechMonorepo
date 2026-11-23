import 'dotenv/config'
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { auditExtension, writeAuditEntries } from './audit.extension'
import type { AuditEntry } from '../common/audit/audit-context'

// ─────────────────────────────────────────────────────────────────────────────
// Modelos com soft delete
// ─────────────────────────────────────────────────────────────────────────────

const SOFT_DELETE_MODELS = [
  'Company', 'Client', 'User', 'Equipment', 'ServiceOrder',
] as const

type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number]

/**
 * Filtra registros excluídos por padrão. Se a query já define `deletedAt`
 * explicitamente (ex.: `{ not: null }` para listar a lixeira), respeita o valor.
 */
function withSoftDelete<T>(where: T): T {
  const w = (where ?? {}) as Record<string, unknown>
  if (w.deletedAt !== undefined) return where
  return { ...w, deletedAt: null } as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory do client estendido
// ─────────────────────────────────────────────────────────────────────────────

function buildClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })

  // Log em development vai para stdout do Prisma (sem $on)
  const isDev = process.env.NODE_ENV === 'development'

  const base = new PrismaClient({
    adapter,
    log: isDev
      ? [
        { emit: 'stdout', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ]
      : [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
  })

  const db = base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            args.where = withSoftDelete(args.where)
          }
          return query(args)
        },

        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            args.where = withSoftDelete(args.where)
          }
          return query(args)
        },

        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            args.where = withSoftDelete(args.where)
          }
          return query(args)
        },

        async findUnique({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            ; (args.where as any) = withSoftDelete(args.where)
          }
          return query(args)
        },

        async findUniqueOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            ; (args.where as any) = withSoftDelete(args.where)
          }
          return query(args)
        },

        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            args.where = withSoftDelete(args.where)
          }
          return query(args)
        },

        async aggregate({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)) {
            ; (args as any).where = withSoftDelete((args as any).where)
          }
          return query(args)
        },
      },
    },
  })
    // Auditoria de escritas (quem alterou o quê) — ver audit.extension.ts
    .$extends(auditExtension(base))

  return { base, db }
}

type PrismaExtended = ReturnType<typeof buildClient>['db']

// ─────────────────────────────────────────────────────────────────────────────
// PrismaService
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private readonly _db: PrismaExtended
  private readonly _base: PrismaClient

  constructor() {
    const { base, db } = buildClient()
    this._base = base
    this._db = db
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit() {
    await this._db.$connect()
    this.logger.log('Banco de dados conectado')
  }

  async onModuleDestroy() {
    await this._db.$disconnect()
    this.logger.log('Banco de dados desconectado')
  }

  // ─── Utilitários ───────────────────────────────────────────────────────────

  get $transaction() {
    return this._db.$transaction.bind(this._db)
  }

  get $queryRaw() {
    return this._db.$queryRaw.bind(this._db)
  }

  get $executeRaw() {
    return this._db.$executeRaw.bind(this._db)
  }

  get $queryRawUnsafe() {
    return this._db.$queryRawUnsafe.bind(this._db)
  }

  get $executeRawUnsafe() {
    return this._db.$executeRawUnsafe.bind(this._db)
  }

  // ─── Auditoria ─────────────────────────────────────────────────────────────

  get auditLog() { return this._db.auditLog }

  /**
   * Client SEM o filtro global de soft delete. Use só para leituras que
   * precisam enxergar registros excluídos (ex.: identificar o equipamento
   * de um log de auditoria). Não audita escritas — não use para gravar.
   */
  get unfiltered(): PrismaClient { return this._base }

  /** Grava os logs de auditoria acumulados numa requisição (usado pelo AuditContextInterceptor). */
  flushAuditEntries(entries: AuditEntry[]): Promise<void> {
    return writeAuditEntries(this._base, entries)
  }

  // ─── Platform & Company ────────────────────────────────────────────────────

  get platform() { return this._db.platform }
  get company() { return this._db.company }
  get companySlaConfig() { return this._db.companySlaConfig }
  get companyMaintenanceTypeSla() { return this._db.companyMaintenanceTypeSla }

  // ─── Client ────────────────────────────────────────────────────────────────

  get client() { return this._db.client }

  // ─── User & Auth ───────────────────────────────────────────────────────────

  get user() { return this._db.user }
  get refreshToken() { return this._db.refreshToken }
  get loginAttempt() { return this._db.loginAttempt }
  get accountBlock() { return this._db.accountBlock }
  get twoFactorCode() { return this._db.twoFactorCode }
  get emailVerification() { return this._db.emailVerification }
  get passwordReset() { return this._db.passwordReset }

  // ─── Grupos & Técnicos ─────────────────────────────────────────────────────

  get maintenanceGroup() { return this._db.maintenanceGroup }
  get technicianGroup() { return this._db.technicianGroup }
  get clientMaintenanceGroup() { return this._db.clientMaintenanceGroup }

  // ─── Localização & Centro de Custo ─────────────────────────────────────────

  get costCenter() { return this._db.costCenter }
  get location() { return this._db.location }

  // ─── Equipamento ───────────────────────────────────────────────────────────

  get equipmentType() { return this._db.equipmentType }
  get equipmentSubtype() { return this._db.equipmentSubtype }
  get equipment() { return this._db.equipment }
  get equipmentMovement() { return this._db.equipmentMovement }
  get equipmentManual() { return this._db.equipmentManual }
  get equipmentCustomFieldDefinition() { return this._db.equipmentCustomFieldDefinition }
  get equipmentCustomFieldValue() { return this._db.equipmentCustomFieldValue }

  // ─── Manutenção ────────────────────────────────────────────────────────────

  get maintenanceSchedule() { return this._db.maintenanceSchedule }
  get maintenance() { return this._db.maintenance }

  // ─── Ordem de Serviço ──────────────────────────────────────────────────────

  get serviceOrder() { return this._db.serviceOrder }
  get serviceOrderTechnician() { return this._db.serviceOrderTechnician }
  get serviceOrderStatusHistory() { return this._db.serviceOrderStatusHistory }
  get serviceOrderComment() { return this._db.serviceOrderComment }
  get serviceOrderTask() { return this._db.serviceOrderTask }
  get serviceOrderCostItem() { return this._db.serviceOrderCostItem }

  // ─── Anexos & Notificações ─────────────────────────────────────────────────

  get attachment() { return this._db.attachment }
  get notification() { return this._db.notification }
  get reportPermission() { return this._db.reportPermission }

  // ─── Permissões dinâmicas & Custom Roles ──────────────────────────────────

  get resourcePermission() { return this._db.resourcePermission }
  get customRole() { return this._db.customRole }
  get customRolePermission() { return this._db.customRolePermission }

  // ─── Regras de Alerta ─────────────────────────────────────────────────────

  get alertRule() { return this._db.alertRule }

  // ─── Configurações de Notificação ─────────────────────────────────────────
  get notificationConfig() { return this._db.notificationConfig }

  // ─── E-Sign ────────────────────────────────────────────────────────────
  get eSignDocument() { return this._db.eSignDocument }
  get eSignRequest() { return this._db.eSignRequest }
  get eSignEvent() { return this._db.eSignEvent }
  get eSignCertificate() { return this._db.eSignCertificate }

  // ─── Laudos ────────────────────────────────────────────────────────────
  get laudoTemplate() { return this._db.laudoTemplate }
  get laudo() { return this._db.laudo }

  // ─── Etiquetas (Label Templates) ──────────────────────────────────────
  get labelTemplate() { return this._db.labelTemplate }

  // ─── Checklist Templates ──────────────────────────────────────────────
  get checklistTemplate() { return this._db.checklistTemplate }
  get serviceOrderChecklist() { return this._db.serviceOrderChecklist }

  // ─── Impressoras & Scans ──────────────────────────────────────────────
  get printer() { return this._db.printer }
  get scan() { return this._db.scan }
  get scanMetadata() { return this._db.scanMetadata }

  // ─── Estoque ──────────────────────────────────────────────────────────
  get stockCategory() { return this._db.stockCategory }
  get stockItem() { return this._db.stockItem }
  get stockMovement() { return this._db.stockMovement }
  get stockPoint() { return this._db.stockPoint }
  get stockPointClient() { return this._db.stockPointClient }

  // ─── Acessórios ───────────────────────────────────────────────────────
  get accessoryCategory() { return this._db.accessoryCategory }
  get accessory() { return this._db.accessory }
  get equipmentAccessoryTemplate() { return this._db.equipmentAccessoryTemplate }
  get accessoryAssignment() { return this._db.accessoryAssignment }
  get accessoryMovement() { return this._db.accessoryMovement }
  get accessoryMaintenance() { return this._db.accessoryMaintenance }
  get accessoryStatusHistory() { return this._db.accessoryStatusHistory }
}