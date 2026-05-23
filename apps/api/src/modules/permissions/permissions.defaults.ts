import { UserRole } from '@prisma/client'

const SA  = UserRole.SUPER_ADMIN
const CA  = UserRole.COMPANY_ADMIN
const CM  = UserRole.COMPANY_MANAGER
const TEC = UserRole.TECHNICIAN
const CLA = UserRole.CLIENT_ADMIN
const CLU = UserRole.CLIENT_USER
const CLV = UserRole.CLIENT_VIEWER

// ─────────────────────────────────────────────────────────────────────────────
// Matriz de permissões padrão do sistema
//
// Chave: "resource:action"
// Valor: roles que têm acesso por padrão
//
// Regras de segurança (aplicadas no guard independente desta matriz):
//  - SUPER_ADMIN SEMPRE tem acesso a tudo
//  - Os recursos "permission" e "custom-role" SEMPRE exigem ao menos CA
//    (protege contra lock-out acidental via override de permissão)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: Record<string, UserRole[]> = {

  // ── EQUIPMENT ──────────────────────────────────────────────────────────────
  'equipment:browse':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment:list':              [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment:read':              [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment:create':            [SA, CA, CM, CLA, CLU],
  'equipment:update':            [SA, CA, CM, CLA, CLU],
  'equipment:delete':            [SA, CA, CM, CLA],
  'equipment:depreciation':      [SA, CA, CM, CLA],

  // ── EQUIPMENT CUSTOM FIELD ────────────────────────────────────────────────
  'equipment-custom-field:browse':       [SA, CA, CM],
  'equipment-custom-field:list':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-custom-field:read':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-custom-field:create':       [SA, CA, CM],
  'equipment-custom-field:update':       [SA, CA, CM],
  'equipment-custom-field:delete':       [SA, CA],
  'equipment-custom-field:write-values': [SA, CA, CM, CLA, CLU],

  // ── EQUIPMENT MANUAL ───────────────────────────────────────────────────────
  'equipment-manual:list':           [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-manual:read':           [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-manual:create':         [SA, CA, CM, CLA, CLU],
  'equipment-manual:update':         [SA, CA, CM, CLA, CLU],
  'equipment-manual:delete':         [SA, CA, CM, CLA],

  // ── COST CENTER ────────────────────────────────────────────────────────────
  'cost-center:browse':          [SA, CA, CM, TEC, CLA, CLU, CLV],
  'cost-center:list':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'cost-center:read':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'cost-center:create':          [SA, CA, CM],
  'cost-center:update':          [SA, CA, CM],
  'cost-center:delete':          [SA, CA, CM],

  // ── LOCATION ───────────────────────────────────────────────────────────────
  'location:list':               [SA, CA, CM, TEC, CLA, CLU, CLV],
  'location:read':               [SA, CA, CM, TEC, CLA, CLU, CLV],
  'location:create':             [SA, CA, CM],
  'location:update':             [SA, CA, CM],
  'location:delete':             [SA, CA, CM],

  // ── EQUIPMENT TYPE ─────────────────────────────────────────────────────────
  'equipment-type:browse':       [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-type:list':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-type:read':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment-type:create':       [SA, CA, CM],
  'equipment-type:update':       [SA, CA, CM],
  'equipment-type:delete':       [SA, CA],
  'equipment-type:create-sub':   [SA, CA, CM],
  'equipment-type:update-sub':   [SA, CA, CM],
  'equipment-type:delete-sub':   [SA, CA],

  // ── MOVEMENT ───────────────────────────────────────────────────────────────
  'movement:list':               [SA, CA, CM, TEC, CLA, CLU, CLV],
  'movement:create':             [SA, CA, CM],
  'movement:return':             [SA, CA, CM],

  // ── STORAGE ────────────────────────────────────────────────────────────────
  'storage:upload':              [SA, CA, CM, TEC, CLA, CLU],
  'storage:download':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'storage:list':                [SA, CA, CM, TEC, CLA, CLU, CLV],
  'storage:delete':              [SA, CA, CM, TEC, CLA, CLU],

  // ── USER ───────────────────────────────────────────────────────────────────
  'user:browse':                 [SA, CA, CM, CLA],
  'user:list':                   [SA, CA, CM, CLA],
  'user:read':                   [SA, CA, CM, CLA],
  'user:create':                 [SA, CA, CM],
  'user:update':                 [SA, CA, CM],
  'user:delete':                 [SA, CA],

  // ── CLIENT ─────────────────────────────────────────────────────────────────
  'client:browse':               [SA, CA, CM, TEC],
  'client:list':                 [SA, CA, CM, TEC],
  'client:read':                 [SA, CA, CM, TEC, CLA, CLU, CLV],
  'client:create':               [SA, CA, CM],
  'client:update':               [SA, CA, CM],
  'client:delete':               [SA, CA],
  'client:upload-logo':          [SA, CA, CM],

  // ── SERVICE ORDER ──────────────────────────────────────────────────────────
  'service-order:browse':        [SA, CA, CM, TEC, CLA, CLU, CLV],
  'service-order:list':          [SA, CA, CM, TEC, CLA, CLU, CLV],
  'service-order:read':          [SA, CA, CM, TEC, CLA, CLU, CLV],
  'service-order:create':        [SA, CA, CM, TEC, CLA, CLU],
  'service-order:update':        [SA, CA, CM, TEC],
  'service-order:update-status': [SA, CA, CM, TEC, CLA],
  'service-order:assume':        [SA, CA, CM, TEC],
  'service-order:manage-techs':  [SA, CA, CM],
  'service-order:comment':       [SA, CA, CM, TEC, CLA, CLU],
  'service-order:task':          [SA, CA, CM, TEC],
  'service-order:delete':        [SA, CA, CM],
  // Acesso ao painel pessoal — lista/stats apenas das OS abertas pelo próprio usuário
  'service-order:view-own':      [SA, CA, CM, TEC, CLA, CLU],
  // Criar OS sem vínculo com equipamento
  'service-order:create-without-equipment': [SA, CA, CM, CLA, CLU],
  // Vincular/desvincular equipamento em uma OS existente
  'service-order:link-equipment':           [SA, CA, CM],
  // Criar OS filha / agendamento vinculado a uma OS pai
  'service-order:create-child':             [SA, CA, CM],

  // ── MAINTENANCE ────────────────────────────────────────────────────────────
  'maintenance:list':            [SA, CA, CM, TEC, CLA, CLV],
  'maintenance:read':            [SA, CA, CM, TEC, CLA, CLV],
  'maintenance:create':          [SA, CA, CM],
  'maintenance:update':          [SA, CA, CM],
  'maintenance:delete':          [SA, CA, CM],

  // ── MAINTENANCE SCHEDULE ───────────────────────────────────────────────────
  'maintenance-schedule:browse': [SA, CA, CM, TEC, CLA, CLV],
  'maintenance-schedule:list':   [SA, CA, CM, TEC, CLA, CLV],
  'maintenance-schedule:read':   [SA, CA, CM, TEC, CLA, CLV],
  'maintenance-schedule:create': [SA, CA, CM],
  'maintenance-schedule:update': [SA, CA, CM],
  'maintenance-schedule:delete': [SA, CA, CM],
  'maintenance-schedule:trigger':[SA, CA],

  // ── MAINTENANCE GROUP ──────────────────────────────────────────────────────
  'maintenance-group:browse':    [SA, CA, CM, TEC],
  'maintenance-group:list':      [SA, CA, CM, TEC],
  'maintenance-group:read':      [SA, CA, CM, TEC],
  'maintenance-group:create':    [SA, CA, CM],
  'maintenance-group:update':    [SA, CA, CM],
  'maintenance-group:delete':    [SA, CA, CM],

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  'dashboard:company':           [SA, CA, CM],
  'dashboard:platform':          [SA],
  'dashboard:client':            [SA, CA, CM, CLA, CLV],

  // ── REPORT ─────────────────────────────────────────────────────────────────
  'report:service-orders':       [SA, CA, CM, CLA],
  'report:equipment':            [SA, CA, CM, CLA],
  'report:preventive':           [SA, CA, CM],
  'report:technicians':          [SA, CA, CM],
  'report:financial':            [SA, CA],

  // ── PERMISSION (SYSTEM) — protegido no guard, override restrito a SA+CA ───
  'permission:read':             [SA, CA],
  'permission:manage':           [SA, CA],

  // ── CUSTOM ROLE — protegido no guard, override restrito a SA+CA ───────────
  'custom-role:list':            [SA, CA],
  'custom-role:read':            [SA, CA],
  'custom-role:create':          [SA, CA],
  'custom-role:update':          [SA, CA],
  'custom-role:delete':          [SA, CA],
  'custom-role:assign':          [SA, CA, CM],

  // ── ALERT RULE ─────────────────────────────────────────────────────────────
  'alert-rule:browse':           [SA, CA, CM],
  'alert-rule:list':             [SA, CA, CM],
  'alert-rule:read':             [SA, CA, CM],
  'alert-rule:create':           [SA, CA, CM],
  'alert-rule:update':           [SA, CA, CM],
  'alert-rule:delete':           [SA, CA],

  // ── NOTIFICATION CONFIG ────────────────────────────────────────────────────
  'notification-config:browse':  [SA, CA, CM],
  'notification-config:list':    [SA, CA, CM],
  'notification-config:update':  [SA, CA, CM],

  // ── LAUDO TEMPLATE ─────────────────────────────────────────────────────────
  'laudo-template:browse':       [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo-template:list':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo-template:read':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo-template:create':       [SA, CA, CM],
  'laudo-template:update':       [SA, CA, CM],
  'laudo-template:delete':       [SA, CA],

  // ── LAUDO ──────────────────────────────────────────────────────────────────
  'laudo:browse':                [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo:list':                  [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo:read':                  [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo:create':                [SA, CA, CM, TEC],
  'laudo:update':                [SA, CA, CM, TEC],
  'laudo:approve':               [SA, CA, CM, CLA],
  'laudo:delete':                [SA, CA, CM],
  'laudo:export-pdf':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'laudo:sign':                  [SA, CA, CM, TEC, CLA, CLU],

  // ── CHECKLIST TEMPLATE ─────────────────────────────────────────────────────
  'checklist-template:browse':     [SA, CA, CM, TEC, CLA, CLU, CLV],
  'checklist-template:list':       [SA, CA, CM, TEC, CLA, CLU, CLV],
  'checklist-template:read':       [SA, CA, CM, TEC, CLA, CLU, CLV],
  'checklist-template:create':     [SA, CA, CM],
  'checklist-template:update':     [SA, CA, CM],
  'checklist-template:delete':     [SA, CA],
  'checklist-template:clone':      [SA, CA, CM],

  // ── CHECKLIST (preenchimento nas OS) ───────────────────────────────────────
  'checklist:read':                [SA, CA, CM, TEC, CLA, CLU, CLV],
  'checklist:fill':                [SA, CA, CM, TEC],
  'checklist:complete':            [SA, CA, CM, TEC],
  'checklist:reopen':              [SA, CA, CM],

  // ── PRINTER ────────────────────────────────────────────────────────────────
  'printer:browse':              [SA, CA, CM],
  'printer:list':                [SA, CA, CM],
  'printer:read':                [SA, CA, CM],
  'printer:create':              [SA, CA],
  'printer:update':              [SA, CA, CM],
  'printer:delete':              [SA, CA],

  // ── SCAN ───────────────────────────────────────────────────────────────────
  'scan:browse':                 [SA, CA, CM, TEC],
  'scan:list':                   [SA, CA, CM, TEC],
  'scan:read':                   [SA, CA, CM, TEC],
  'scan:download':               [SA, CA, CM, TEC],
  'scan:update':                 [SA, CA, CM, TEC],
  'scan:delete':                 [SA, CA, CM],

  // ── GHOSP (pacientes internados — banco hospitalar externo) ────────────────
  'ghosp:list':                  [SA, CA],

  // ── INVENTORY (itens de estoque) ───────────────────────────────────────────
  // Prestadores (CLA) podem visualizar itens dos pontos vinculados a eles
  'inventory:browse':              [SA, CA, CM, TEC, CLA],
  'inventory:list':                [SA, CA, CM, TEC, CLA],
  'inventory:read':                [SA, CA, CM, TEC, CLA],
  'inventory:create':              [SA, CA, CM],
  'inventory:update':              [SA, CA, CM],
  'inventory:delete':              [SA, CA, CM],

  // ── INVENTORY POINT (pontos de estoque) ────────────────────────────────────
  'inventory-point:list':          [SA, CA, CM, TEC, CLA],
  'inventory-point:read':          [SA, CA, CM, TEC, CLA],
  'inventory-point:create':        [SA, CA, CM],
  'inventory-point:update':        [SA, CA, CM],
  'inventory-point:delete':        [SA, CA, CM],

  // ── INVENTORY CATEGORY ─────────────────────────────────────────────────────
  'inventory-category:browse':     [SA, CA, CM, TEC],
  'inventory-category:list':       [SA, CA, CM, TEC],
  'inventory-category:read':       [SA, CA, CM, TEC],
  'inventory-category:create':     [SA, CA, CM],
  'inventory-category:update':     [SA, CA, CM],
  'inventory-category:delete':     [SA, CA],

  // ── INVENTORY MOVEMENT (movimentações / saídas) ────────────────────────────
  // TEC e CLA podem criar saídas; só gestores fazem transferências entre pontos
  'inventory-movement:list':       [SA, CA, CM, TEC, CLA],
  'inventory-movement:read':       [SA, CA, CM, TEC, CLA],
  'inventory-movement:create':     [SA, CA, CM, TEC, CLA],
  'inventory-movement:transfer':   [SA, CA, CM],

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  // Acesso por módulo — cada tipo de análise pode ser liberado independentemente
  'analytics:equipment':         [SA, CA, CM, CLA],
  'analytics:service-orders':    [SA, CA, CM, CLA],
  'analytics:technicians':       [SA, CA, CM],
  'analytics:preventive':        [SA, CA, CM, CLA],
  'analytics:financial':         [SA, CA],

  // ── ACCESSORIES ────────────────────────────────────────────────────────────
  'accessories:read':                    [SA, CA, CM, TEC, CLA, CLU, CLV],
  'accessories:create':                  [SA, CA, CM, TEC],
  'accessories:update':                  [SA, CA, CM, TEC],
  'accessories:delete':                  [SA, CA, CM],

  'accessory_categories:read':           [SA, CA, CM, TEC, CLA, CLU, CLV],
  'accessory_categories:create':         [SA, CA, CM],
  'accessory_categories:update':         [SA, CA, CM],
  'accessory_categories:delete':         [SA, CA],

  'accessory_assignments:read':          [SA, CA, CM, TEC, CLA, CLU, CLV],
  'accessory_assignments:assign':        [SA, CA, CM, TEC],
  'accessory_assignments:unassign':      [SA, CA, CM, TEC],

  'accessory_movements:read':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'accessory_movements:create':          [SA, CA, CM, TEC],
  'accessory_movements:return':          [SA, CA, CM, TEC],

  'accessory_maintenances:read':         [SA, CA, CM, TEC, CLA, CLU, CLV],
  'accessory_maintenances:create':       [SA, CA, CM, TEC],
  'accessory_maintenances:update':       [SA, CA, CM, TEC],

  'accessory_templates:read':            [SA, CA, CM, TEC, CLA, CLU, CLV],
  'accessory_templates:create':          [SA, CA, CM],
  'accessory_templates:update':          [SA, CA, CM],
  'accessory_templates:delete':          [SA, CA],
}

// Lista de todos os recursos e suas ações possíveis (para a UI de configuração)
export const RESOURCE_ACTIONS: Record<string, string[]> = {
  'equipment':              ['browse', 'list', 'read', 'create', 'update', 'delete', 'depreciation'],
  'equipment-custom-field': ['browse', 'list', 'read', 'create', 'update', 'delete', 'write-values'],
  'equipment-manual':       ['list', 'read', 'create', 'update', 'delete'],
  'cost-center':          ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'location':             ['list', 'read', 'create', 'update', 'delete'],
  'equipment-type':       ['browse', 'list', 'read', 'create', 'update', 'delete', 'create-sub', 'update-sub', 'delete-sub'],
  'movement':             ['list', 'create', 'return'],
  'storage':              ['upload', 'download', 'list', 'delete'],
  'user':                 ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'client':               ['browse', 'list', 'read', 'create', 'update', 'delete', 'upload-logo'],
  'service-order':        ['browse', 'list', 'read', 'create', 'update', 'update-status', 'assume', 'manage-techs', 'comment', 'task', 'delete', 'view-own', 'create-without-equipment', 'link-equipment', 'create-child'],
  'maintenance':          ['list', 'read', 'create', 'update', 'delete'],
  'maintenance-schedule': ['browse', 'list', 'read', 'create', 'update', 'delete', 'trigger'],
  'maintenance-group':    ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'dashboard':            ['company', 'platform', 'client'],
  'report':               ['service-orders', 'equipment', 'preventive', 'technicians', 'financial'],
  'permission':           ['read', 'manage'],
  'custom-role':          ['list', 'read', 'create', 'update', 'delete', 'assign'],
  'alert-rule':           ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'notification-config':  ['browse', 'list', 'update'],
  'laudo-template':       ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'laudo':                ['browse', 'list', 'read', 'create', 'update', 'approve', 'delete', 'export-pdf', 'sign'],
  'checklist-template':   ['browse', 'list', 'read', 'create', 'update', 'delete', 'clone'],
  'checklist':            ['read', 'fill', 'complete', 'reopen'],
  'printer':              ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'scan':                 ['browse', 'list', 'read', 'download', 'update', 'delete'],
  'ghosp':                ['list'],
  'analytics':            ['equipment', 'service-orders', 'technicians', 'preventive', 'financial'],
  'accessories':              ['read', 'create', 'update', 'delete'],
  'accessory_categories':     ['read', 'create', 'update', 'delete'],
  'accessory_assignments':    ['read', 'assign', 'unassign'],
  'accessory_movements':      ['read', 'create', 'return'],
  'accessory_maintenances':   ['read', 'create', 'update'],
  'accessory_templates':      ['read', 'create', 'update', 'delete'],
  'inventory':            ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'inventory-point':      ['list', 'read', 'create', 'update', 'delete'],
  'inventory-category':   ['browse', 'list', 'read', 'create', 'update', 'delete'],
  'inventory-movement':   ['list', 'read', 'create', 'transfer'],
}

// Roles que não podem ser removidos de certos recursos críticos (lock-out prevention)
export const PROTECTED_MINIMUMS: Record<string, UserRole[]> = {
  'permission:manage':   [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
  'permission:read':     [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
  'custom-role:create':  [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
  'custom-role:delete':  [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
  'user:create':         [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
  'user:delete':         [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
}
