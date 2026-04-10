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
  'equipment:list':              [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment:read':              [SA, CA, CM, TEC, CLA, CLU, CLV],
  'equipment:create':            [SA, CA, CM, CLA, CLU],
  'equipment:update':            [SA, CA, CM, CLA, CLU],
  'equipment:delete':            [SA, CA, CM, CLA],
  'equipment:depreciation':      [SA, CA, CM, CLA],

  // ── COST CENTER ────────────────────────────────────────────────────────────
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
  'user:list':                   [SA, CA, CM],
  'user:read':                   [SA, CA, CM],
  'user:create':                 [SA, CA, CM],
  'user:update':                 [SA, CA, CM],
  'user:delete':                 [SA, CA],

  // ── CLIENT ─────────────────────────────────────────────────────────────────
  'client:list':                 [SA, CA, CM, TEC],
  'client:read':                 [SA, CA, CM, TEC, CLA, CLU, CLV],
  'client:create':               [SA, CA, CM],
  'client:update':               [SA, CA, CM],
  'client:delete':               [SA, CA],
  'client:upload-logo':          [SA, CA, CM],

  // ── SERVICE ORDER ──────────────────────────────────────────────────────────
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

  // ── MAINTENANCE ────────────────────────────────────────────────────────────
  'maintenance:list':            [SA, CA, CM, TEC, CLA, CLV],
  'maintenance:read':            [SA, CA, CM, TEC, CLA, CLV],
  'maintenance:create':          [SA, CA, CM],
  'maintenance:update':          [SA, CA, CM],
  'maintenance:delete':          [SA, CA, CM],

  // ── MAINTENANCE SCHEDULE ───────────────────────────────────────────────────
  'maintenance-schedule:list':   [SA, CA, CM, TEC, CLA, CLV],
  'maintenance-schedule:read':   [SA, CA, CM, TEC, CLA, CLV],
  'maintenance-schedule:create': [SA, CA, CM],
  'maintenance-schedule:update': [SA, CA, CM],
  'maintenance-schedule:delete': [SA, CA, CM],
  'maintenance-schedule:trigger':[SA, CA],

  // ── MAINTENANCE GROUP ──────────────────────────────────────────────────────
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
}

// Lista de todos os recursos e suas ações possíveis (para a UI de configuração)
export const RESOURCE_ACTIONS: Record<string, string[]> = {
  'equipment':            ['list', 'read', 'create', 'update', 'delete', 'depreciation'],
  'cost-center':          ['list', 'read', 'create', 'update', 'delete'],
  'location':             ['list', 'read', 'create', 'update', 'delete'],
  'equipment-type':       ['list', 'read', 'create', 'update', 'delete', 'create-sub', 'update-sub', 'delete-sub'],
  'movement':             ['list', 'create', 'return'],
  'storage':              ['upload', 'download', 'list', 'delete'],
  'user':                 ['list', 'read', 'create', 'update', 'delete'],
  'client':               ['list', 'read', 'create', 'update', 'delete', 'upload-logo'],
  'service-order':        ['list', 'read', 'create', 'update', 'update-status', 'assume', 'manage-techs', 'comment', 'task', 'delete', 'view-own', 'create-without-equipment', 'link-equipment'],
  'maintenance':          ['list', 'read', 'create', 'update', 'delete'],
  'maintenance-schedule': ['list', 'read', 'create', 'update', 'delete', 'trigger'],
  'maintenance-group':    ['list', 'read', 'create', 'update', 'delete'],
  'dashboard':            ['company', 'platform', 'client'],
  'report':               ['service-orders', 'equipment', 'preventive', 'technicians', 'financial'],
  'permission':           ['read', 'manage'],
  'custom-role':          ['list', 'read', 'create', 'update', 'delete', 'assign'],
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
