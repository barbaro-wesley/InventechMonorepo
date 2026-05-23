# Implementação do Módulo de Acessórios — Checklist Enterprise

> **Contexto:** Sistema de engenharia clínica / gestão de ativos hospitalares (EAM/CMMS).
> Acessórios são ativos rastreáveis independentes, com histórico de vínculo a equipamentos.
>
> **Stack:** NestJS · Prisma · PostgreSQL · Multi-tenant (Company/Client)
>
> **Referência arquitetural:** [`docs/accessories-architecture.md`](./accessories-architecture.md) _(análise completa gerada pelo Claude)_

---

## Índice

1. [Modelagem do Banco / schema.prisma](#1-modelagem-do-banco--schemaprisma)
2. [Migrations com Índices Propostos](#2-migrations-com-índices-propostos)
3. [Análise e Adaptação das Regras de Negócio Multi-tenant](#3-análise-e-adaptação-das-regras-de-negócio-multi-tenant)
4. [Integridade, Segurança e Boas Práticas no Desenvolvimento](#4-integridade-segurança-e-boas-práticas-no-desenvolvimento)
5. [Testes de Segurança e Integridade](#5-testes-de-segurança-e-integridade)
6. [Validação Final](#6-validação-final)
7. [Integração com a UI](#7-integração-com-a-ui)

---

## 1. Modelagem do Banco / schema.prisma

### 1.1 Novos Enums

- [ ] Adicionar enum `AccessoryStatus` com valores:
  - `AVAILABLE` — em estoque, disponível para vincular
  - `IN_USE` — vinculado a um equipamento
  - `UNDER_MAINTENANCE` — em manutenção
  - `LOANED` — emprestado externamente
  - `SCRAPPED` — baixado/descartado
  - `LOST` — extraviado

- [ ] Adicionar enum `AccessoryOwnership` com valores:
  - `COMPANY` — propriedade da empresa prestadora
  - `CLIENT` — propriedade do cliente
  - `LEASED` — alugado/locado
  - `DONATED` — doado

- [ ] Estender enum `AttachmentEntity` com:
  - `ACCESSORY`
  - `ACCESSORY_MAINTENANCE`

- [ ] Estender enum `EventType` com:
  - `ACCESSORY_CREATED`
  - `ACCESSORY_ASSIGNED`
  - `ACCESSORY_UNASSIGNED`
  - `ACCESSORY_MOVED`
  - `ACCESSORY_MAINTENANCE_COMPLETED`
  - `ACCESSORY_WARRANTY_EXPIRING`
  - `ACCESSORY_STATUS_CHANGED`

### 1.2 Novo Model `AccessoryCategory`

- [ ] Criar model com campos:
  - `id`, `companyId`, `name`, `description`, `color`, `isActive`
  - `createdAt`, `updatedAt`
- [ ] Adicionar `@@unique([companyId, name])`
- [ ] Adicionar `@@index([companyId, isActive])`
- [ ] Adicionar `@@map("accessory_categories")`
- [ ] Adicionar relação `accessories Accessory[]`
- [ ] Adicionar relação `templates EquipmentAccessoryTemplate[]`

### 1.3 Novo Model `EquipmentAccessoryTemplate`

- [ ] Criar model com campos:
  - `id`, `companyId`, `equipmentTypeId`, `categoryId`
  - `isRequired`, `minQuantity`, `maxQuantity`, `notes`
  - `createdAt`, `updatedAt`
- [ ] Adicionar `@@unique([equipmentTypeId, categoryId])`
- [ ] Adicionar `@@index([companyId])`, `@@index([equipmentTypeId])`
- [ ] Adicionar `@@map("equipment_accessory_templates")`
- [ ] Adicionar relações para `AccessoryCategory` e `EquipmentType`

### 1.4 Novo Model `Accessory` (ativo principal)

- [ ] Criar model com campos de identificação:
  - `id`, `companyId`, `categoryId`
  - `name`, `brand`, `model`
  - `serialNumber`, `patrimonyNumber`, `qrCode` (unique global), `anvisaNumber`
- [ ] Adicionar campos financeiros:
  - `ownership` (enum `AccessoryOwnership`)
  - `purchaseValue` (`@db.Decimal(12,2)`), `purchaseDate` (`@db.Date`)
  - `invoiceNumber`, `warrantyStart`, `warrantyEnd` (`@db.Date`)
- [ ] Adicionar campos de estado operacional:
  - `status` (`AccessoryStatus`, default `AVAILABLE`)
  - `criticality` (`EquipmentCriticality`, default `MEDIUM`)
  - `observations`
- [ ] Adicionar campos desnormalizados (sincronizados pela aplicação):
  - `currentLocationId String?` — localização física atual
  - `currentEquipmentId String?` — equipamento ao qual está vinculado agora
  - `lastMaintenanceAt DateTime?`
  - `totalMaintenances Int @default(0)`
- [ ] Adicionar campos de auditoria: `createdAt`, `updatedAt`, `deletedAt`
- [ ] Adicionar índices:
  - `@@index([companyId])`
  - `@@index([companyId, status])`
  - `@@index([companyId, categoryId])`
  - `@@index([companyId, currentEquipmentId])`
  - `@@index([serialNumber])`
  - `@@index([patrimonyNumber])`
  - `@@index([qrCode])`
  - `@@index([warrantyEnd])` — para alertas de garantia
- [ ] Adicionar `@@map("accessories")`
- [ ] Definir relações para: `AccessoryCategory`, `Location` (currentLocation), `Equipment` (currentEquipment), `AccessoryAssignment[]`, `AccessoryMovement[]`, `AccessoryMaintenance[]`, `AccessoryStatusHistory[]`, `Attachment[]`

### 1.5 Novo Model `AccessoryAssignment` (coração da rastreabilidade)

- [ ] Criar model com campos:
  - `id`, `companyId`, `accessoryId`, `equipmentId`
  - `assignedById`, `unassignedById`
  - `assignedAt` (`@default(now())`), `unassignedAt`
  - `reason`, `unassignReason`, `notes`
  - `isActive Boolean @default(true)`
  - `equipmentSnapshot Json?` — snapshot do equipment no momento do vínculo
- [ ] Adicionar índices:
  - `@@index([companyId])`
  - `@@index([accessoryId, isActive])` — query mais comum
  - `@@index([equipmentId, isActive])`
  - `@@index([assignedAt])`
- [ ] Adicionar `@@map("accessory_assignments")`
- [ ] Adicionar relações: `Accessory`, `Equipment`, `assignedBy User`, `unassignedBy User?`
- [ ] **Anotar:** índice único parcial deve ser criado via raw SQL (ver seção 2.3)

### 1.6 Novo Model `AccessoryMovement`

- [ ] Criar model com campos:
  - `id`, `companyId`, `accessoryId`
  - `requesterId`, `approverId`
  - `type MovementType` — reutiliza enum existente (`TRANSFER | LOAN`)
  - `status MovementStatus @default(ACTIVE)` — reutiliza enum existente
  - `originLocationId`, `destinationLocationId`
  - `reason`, `expectedReturnAt`, `returnedAt`, `notes`
  - `createdAt`, `updatedAt`
- [ ] Adicionar índices:
  - `@@index([companyId])`
  - `@@index([accessoryId, status])`
  - `@@index([accessoryId, createdAt(sort: Desc)])`
- [ ] Adicionar `@@map("accessory_movements")`
- [ ] Adicionar relações: `Accessory`, `Location` (origin/destination, nomes diferentes dos do EquipmentMovement), `requester User`, `approver User?`

### 1.7 Novo Model `AccessoryMaintenance`

- [ ] Criar model com campos:
  - `id`, `companyId`, `accessoryId`, `technicianId`
  - `type MaintenanceType` — reutiliza enum existente
  - `title`, `description`, `observations`
  - `scheduledAt`, `startedAt`, `completedAt`
  - `createdAt`, `updatedAt`
- [ ] Adicionar índices:
  - `@@index([companyId])`
  - `@@index([accessoryId])`
  - `@@index([accessoryId, completedAt(sort: Desc)])`
  - `@@index([technicianId])`
- [ ] Adicionar `@@map("accessory_maintenances")`
- [ ] Adicionar relações: `Accessory`, `technician User?`, `attachments Attachment[]`

### 1.8 Novo Model `AccessoryStatusHistory`

- [ ] Criar model com campos:
  - `id`, `accessoryId`
  - `fromStatus AccessoryStatus?`, `toStatus AccessoryStatus`
  - `changedById`, `reason`, `metadata Json?`
  - `createdAt`
- [ ] Adicionar índices:
  - `@@index([accessoryId])`
  - `@@index([accessoryId, createdAt(sort: Desc)])`
- [ ] Adicionar `@@map("accessory_status_history")`
- [ ] Adicionar relações: `Accessory`, `changedBy User`

### 1.9 Alterações nos Models Existentes

- [ ] **`Equipment`** — adicionar relações:
  ```prisma
  currentAccessories   Accessory[]          @relation("AccessoryCurrentEquipment")
  accessoryAssignments AccessoryAssignment[]
  ```

- [ ] **`EquipmentType`** — adicionar relação:
  ```prisma
  accessoryTemplates EquipmentAccessoryTemplate[]
  ```

- [ ] **`Location`** — adicionar relações:
  ```prisma
  currentAccessories     Accessory[]         @relation("AccessoryCurrentLocation")
  accessoryMovementsTo   AccessoryMovement[] @relation("AccessoryMovementDestination")
  accessoryMovementsFrom AccessoryMovement[] @relation("AccessoryMovementOrigin")
  ```

- [ ] **`Attachment`** — adicionar campos e relações:
  ```prisma
  accessoryId            String?  @map("accessory_id")
  accessoryMaintenanceId String?  @map("accessory_maintenance_id")
  accessory              Accessory?            @relation("AccessoryAttachments", ...)
  accessoryMaintenance   AccessoryMaintenance? @relation("AccessoryMaintenanceAttachments", ...)
  ```

- [ ] **`User`** — adicionar relações para operações de acessório:
  ```prisma
  accessoryAssignmentsCreated  AccessoryAssignment[]    @relation("AssignmentCreatedBy")
  accessoryAssignmentsClosed   AccessoryAssignment[]    @relation("AssignmentClosedBy")
  accessoryMovementsRequested  AccessoryMovement[]      @relation("AccessoryMovementRequester")
  accessoryMovementsApproved   AccessoryMovement[]      @relation("AccessoryMovementApprover")
  accessoryMaintenances        AccessoryMaintenance[]   @relation("AccessoryMaintenanceTechnician")
  accessoryStatusChanges       AccessoryStatusHistory[] @relation("AccessoryStatusChangedBy")
  ```

- [ ] **Executar `npx prisma validate`** — sem erros antes de continuar

---

## 2. Migrations com Índices Propostos

### 2.1 Gerar migration base

```bash
# Gera o arquivo de migration com todas as mudanças do schema
npx prisma migrate dev --name add_accessory_module --create-only
```

- [ ] Revisar o SQL gerado em `prisma/migrations/*/migration.sql` antes de aplicar
- [ ] Confirmar que nenhuma coluna existente foi alterada de forma destrutiva
- [ ] Confirmar que todos os `@map()` geraram nomes de tabela corretos em snake_case

### 2.2 Índices padrão — verificar no SQL gerado

- [ ] `accessories` — verificar índice em `company_id`
- [ ] `accessories` — verificar índice composto em `(company_id, status)`
- [ ] `accessories` — verificar índice composto em `(company_id, category_id)`
- [ ] `accessories` — verificar índice composto em `(company_id, current_equipment_id)`
- [ ] `accessories` — verificar índice em `serial_number`
- [ ] `accessories` — verificar índice em `patrimony_number`
- [ ] `accessories` — verificar índice em `qr_code` (unique)
- [ ] `accessories` — verificar índice em `warranty_end`
- [ ] `accessory_assignments` — verificar índice composto em `(accessory_id, is_active)`
- [ ] `accessory_assignments` — verificar índice composto em `(equipment_id, is_active)`
- [ ] `accessory_movements` — verificar índice composto em `(accessory_id, status)`
- [ ] `accessory_status_history` — verificar índice em `accessory_id`

### 2.3 Índices parciais — adicionar MANUALMENTE ao SQL da migration

> O Prisma não suporta índices únicos parciais nativamente. Adicionar ao final do arquivo `migration.sql` **antes de executar**:

```sql
-- ============================================================
-- PARTIAL UNIQUE INDEXES — não gerados automaticamente pelo Prisma
-- ============================================================

-- Garante que cada acessório possui no máximo 1 atribuição ativa por vez.
-- Esta é a constraint mais crítica do domínio de acessórios.
CREATE UNIQUE INDEX "accessory_single_active_assignment"
  ON "accessory_assignments"("accessory_id")
  WHERE "is_active" = TRUE;

-- Garante unicidade de número de patrimônio por empresa (ignora nulos e deletados)
CREATE UNIQUE INDEX "accessory_patrimony_per_company"
  ON "accessories"("company_id", "patrimony_number")
  WHERE "patrimony_number" IS NOT NULL
    AND "deleted_at" IS NULL;

-- Garante unicidade de número de série por empresa (ignora nulos e deletados)
CREATE UNIQUE INDEX "accessory_serial_per_company"
  ON "accessories"("company_id", "serial_number")
  WHERE "serial_number" IS NOT NULL
    AND "deleted_at" IS NULL;

-- Índice de busca por QR Code (único global por design — qrCode já tem @unique)
-- Já coberto pelo unique padrão. Nenhuma ação adicional necessária.
```

- [ ] Adicionar os índices parciais ao `migration.sql` gerado
- [ ] Aplicar a migration: `npx prisma migrate dev`
- [ ] Verificar no psql/DBeaver que os índices foram criados:
  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename IN ('accessories', 'accessory_assignments')
  ORDER BY tablename, indexname;
  ```

### 2.4 Verificação pós-migration

- [ ] `npx prisma migrate status` — todas as migrations aplicadas
- [ ] `npx prisma generate` — Prisma Client atualizado sem erros
- [ ] Testar que `prisma.accessory.findMany()` funciona sem erro de tipo

---

## 3. Análise e Adaptação das Regras de Negócio Multi-tenant

> O sistema usa `AuthenticatedUser` com `companyId | null` e `clientId | null`.
> A função `resolveScope()` em `EquipmentService` é o padrão a seguir.

### 3.1 Entender o isolamento atual

- [ ] Estudar `resolveScope()` em `equipment.service.ts` — entender como usuários de empresa vs. usuários cliente recebem escopos diferentes
- [ ] Entender que usuários `clientId != null` veem apenas equipamentos dos grupos de manutenção do seu cliente
- [ ] Confirmar que **todo** `findMany` de equipamento aplica `where: { companyId, deletedAt: null }`

### 3.2 Regras de scope para Accessory

- [ ] **Usuário da empresa:** vê todos os acessórios onde `companyId = currentUser.companyId`
- [ ] **Usuário cliente:** vê apenas acessórios atualmente vinculados (`currentEquipmentId != null`) a equipamentos visíveis ao seu cliente
  - Implementar `resolveAccessoryScope()` análogo ao `resolveScope()` do equipment:
    ```typescript
    // Pseudo-código — adaptar ao padrão existente
    private async resolveAccessoryScope(currentUser: AuthenticatedUser) {
      if (!currentUser.clientId) {
        return { companyId: currentUser.companyId!, equipmentIdFilter: null }
      }
      // Busca IDs dos equipamentos visíveis ao cliente
      const allowedEquipmentIds = await this.getClientVisibleEquipmentIds(currentUser.clientId)
      return {
        companyId: /* companyId do client */,
        equipmentIdFilter: { in: allowedEquipmentIds }
      }
    }
    ```
- [ ] Acessórios com `status = AVAILABLE` (sem equipamento vinculado) **não são visíveis** para usuários cliente
- [ ] Acessórios `deletedAt != null` **nunca** devem aparecer em listagens

### 3.3 Isolamento de escrita (mutations)

- [ ] Toda operação de create/update/delete de acessório deve validar `companyId` antes:
  ```typescript
  // Padrão obrigatório — replicar de movements.service.ts
  const accessory = await this.prisma.accessory.findFirst({
    where: { id, companyId, deletedAt: null },
  })
  if (!accessory) throw new NotFoundException('Acessório não encontrado')
  ```
- [ ] Na operação de **vínculo** (`assignAccessory`), validar que o `Equipment` também pertence à mesma `companyId`
- [ ] Na operação de **movimentação**, validar que `originLocationId` e `destinationLocationId` pertencem à mesma `companyId`
- [ ] Na operação de **manutenção**, validar que o técnico (`technicianId`) pertence à mesma `companyId` (ou é null)

### 3.4 Regras de negócio específicas do domínio

- [ ] **Vínculo único:** ao criar `AccessoryAssignment`, verificar que não existe outro `isActive = true` para o mesmo `accessoryId` (a constraint do DB garante, mas a mensagem de erro deve ser legível)
- [ ] **Status coerente com vínculo:**
  - `IN_USE` somente se houver `AccessoryAssignment` ativo
  - `AVAILABLE` somente se não houver `AccessoryAssignment` ativo
  - `UNDER_MAINTENANCE` pode coexistir com ou sem vínculo (definir regra de negócio)
- [ ] **Transação obrigatória** em toda operação que altere `Accessory.status` + crie registro relacionado:
  - assign → `prisma.$transaction([createAssignment, updateAccessory, createStatusHistory])`
  - unassign → `prisma.$transaction([closeAssignment, updateAccessory, createStatusHistory])`
  - movement → `prisma.$transaction([createMovement, updateAccessory.currentLocationId])`
- [ ] **Acessório SCRAPPED** não pode ser vinculado, movimentado ou ter manutenção criada
- [ ] **QR Code:** deve ser gerado automaticamente no create se não fornecido (ex: `ACC-${companyId.slice(0,6)}-${nanoid(8)}`)

---

## 4. Integridade, Segurança e Boas Práticas no Desenvolvimento

### 4.1 Estrutura de arquivos — seguir o padrão do módulo `equipment`

```
src/modules/accessories/
├── accessories.module.ts
├── accessories.controller.ts
├── accessories.service.ts
├── dto/
│   └── accessory.dto.ts
├── categories/
│   ├── categories.controller.ts
│   ├── categories.service.ts
│   └── dto/category.dto.ts
├── assignments/
│   ├── assignments.controller.ts
│   ├── assignments.service.ts
│   └── dto/assignment.dto.ts
├── movements/
│   ├── movements.controller.ts
│   ├── movements.service.ts
│   └── dto/movement.dto.ts
├── maintenances/
│   ├── maintenances.controller.ts
│   ├── maintenances.service.ts
│   └── dto/maintenance.dto.ts
└── templates/
    ├── templates.controller.ts
    ├── templates.service.ts
    └── dto/template.dto.ts
```

- [ ] Criar estrutura de pastas conforme acima
- [ ] Registrar `AccessoriesModule` no `AppModule`

### 4.2 DTOs e validação de entrada

- [ ] Instalar/confirmar que `class-validator` e `class-transformer` estão disponíveis
- [ ] `CreateAccessoryDto`:
  - [ ] `name` — `@IsString()`, `@MinLength(2)`, `@MaxLength(150)`
  - [ ] `categoryId` — `@IsOptional()`, `@IsUUID()`
  - [ ] `serialNumber` — `@IsOptional()`, `@IsString()`, `@MaxLength(100)`
  - [ ] `patrimonyNumber` — `@IsOptional()`, `@IsString()`, `@MaxLength(50)`
  - [ ] `qrCode` — `@IsOptional()`, `@IsString()` (se não enviado, gerar automaticamente)
  - [ ] `warrantyStart` / `warrantyEnd` — `@IsOptional()`, `@IsDateString()`, validar que `end >= start`
  - [ ] `purchaseValue` — `@IsOptional()`, `@IsNumber()`, `@Min(0)`
  - [ ] `criticality` — `@IsEnum(EquipmentCriticality)`
  - [ ] `ownership` — `@IsEnum(AccessoryOwnership)`

- [ ] `AssignAccessoryDto`:
  - [ ] `equipmentId` — `@IsUUID()`, `@IsNotEmpty()`
  - [ ] `reason` — `@IsOptional()`, `@IsString()`, `@MaxLength(500)`

- [ ] `UnassignAccessoryDto`:
  - [ ] `unassignReason` — `@IsOptional()`, `@IsString()`, `@MaxLength(500)`

- [ ] `CreateAccessoryMovementDto`:
  - [ ] `originLocationId` — `@IsUUID()`, `@IsNotEmpty()`
  - [ ] `destinationLocationId` — `@IsUUID()`, `@IsNotEmpty()`
  - [ ] `type` — `@IsEnum(MovementType)`
  - [ ] `expectedReturnAt` — obrigatório se `type === LOAN`

- [ ] Aplicar `ValidationPipe` — confirmar que está global no `main.ts`

### 4.3 Autorização e permissões

- [ ] Adicionar recursos de acessório ao `ResourcePermission` existente:
  ```
  resources: accessories | accessory_categories | accessory_assignments
             | accessory_movements | accessory_maintenances | accessory_templates
  actions:   create | read | update | delete | assign | unassign
  ```
- [ ] Aplicar `@UseGuards(JwtAuthGuard, PermissionGuard)` em todos os controllers
- [ ] Definir permissões padrão por role:
  - `COMPANY_ADMIN`, `COMPANY_MANAGER`: todas as actions
  - `TECHNICIAN`: read + create (manutenção) + assign/unassign
  - `CLIENT_ADMIN`, `CLIENT_USER`: read apenas (acessórios do seu escopo)
  - `CLIENT_VIEWER`: read apenas
- [ ] Confirmar que `@Permission('accessories', 'read')` usa o guard já existente em `common/guards/permission.guard.ts`

### 4.4 SELECT seguro (não expor dados de outra empresa)

- [ ] Definir `ACCESSORY_SELECT` constante (padrão do `EQUIPMENT_SELECT` existente) — nunca usar `select: undefined` (retornaria todos os campos)
- [ ] **Jamais** retornar `companyId` diretamente para clientes da API — filtrar no select ou usar um DTO de resposta
- [ ] Usar `Prisma.AccessorySelect` com `satisfies` para type safety:
  ```typescript
  const ACCESSORY_SELECT = { ... } satisfies Prisma.AccessorySelect
  type AccessoryRaw = Prisma.AccessoryGetPayload<{ select: typeof ACCESSORY_SELECT }>
  ```

### 4.5 Tratamento de erros

- [ ] `NotFoundException` quando acessório não encontrado (nunca revelar se não existe ou é de outra empresa)
- [ ] `ConflictException` quando tentar vincular acessório que já está `IN_USE` — mensagem clara
- [ ] `ConflictException` quando violar índice único do banco (serial/patrimônio duplicado) — capturar `PrismaClientKnownRequestError` com código `P2002`
- [ ] `BadRequestException` quando tentar operação inválida por status (ex: vincular acessório `SCRAPPED`)
- [ ] Confirmar que `PrismaExceptionFilter` existente em `common/filters/` trata `P2002` e `P2025`

### 4.6 Performance e boas práticas

- [ ] Usar `findFirst` com `where: { id, companyId }` — nunca `findUnique` sem validar tenant
- [ ] Paginação obrigatória em listagens — seguir `pagination.util.ts` existente
- [ ] Campos `Decimal` do Prisma: converter para `Number` antes de retornar (padrão da `normalizeEquipment` já existente)
- [ ] `lastMaintenanceAt` e `totalMaintenances` devem ser atualizados dentro da mesma transação ao completar uma `AccessoryMaintenance`
- [ ] Não fazer N+1 queries — usar `include` ou `select` com relações aninhadas quando necessário

---

## 5. Testes de Segurança e Integridade dos Dados

### 5.1 Testes de isolamento multi-tenant (críticos)

- [ ] **Tenant isolation — read:** Usuário da empresa A não pode ler acessórios da empresa B
  ```typescript
  // Tentar buscar acessório de outra empresa deve retornar 404 (não 403)
  GET /accessories/:idDeOutraEmpresa → 404 Not Found
  ```
- [ ] **Tenant isolation — write:** Usuário da empresa A não pode vincular acessório a equipamento da empresa B
- [ ] **Tenant isolation — locations:** Movimentação com `originLocationId` de outra empresa deve retornar 400
- [ ] **Tenant isolation — assignment:** Não deve ser possível criar `AccessoryAssignment` cruzando empresas diferentes

### 5.2 Testes de integridade do vínculo único

- [ ] Tentar vincular acessório que já está `IN_USE` → `409 Conflict`
- [ ] Criar dois `AccessoryAssignment` com `isActive=true` para o mesmo acessório → falha no banco (índice parcial)
- [ ] Após `unassign`, o `Accessory.currentEquipmentId` deve ser `null`
- [ ] Após `unassign`, `isActive` no assignment deve ser `false` e `unassignedAt` preenchido

### 5.3 Testes de consistência do estado (status machine)

- [ ] Acessório `SCRAPPED` não pode receber `assign` → `400 Bad Request`
- [ ] Acessório `LOST` não pode receber movimentação → `400 Bad Request`
- [ ] Ao criar `AccessoryAssignment`, `Accessory.status` deve ser `IN_USE`
- [ ] Ao fechar `AccessoryAssignment`, `Accessory.status` deve ser `AVAILABLE`
- [ ] `AccessoryStatusHistory` deve ter um registro para cada transição de status

### 5.4 Testes de integridade das transações

- [ ] Simular falha após criar `AccessoryAssignment` mas antes de atualizar `Accessory.status` — garantir rollback (usar mock de falha)
- [ ] Confirmar que nenhum acessório fica com `currentEquipmentId != null` e `status = AVAILABLE` simultaneamente

### 5.5 Testes de unicidade por empresa

- [ ] Tentar criar dois acessórios com o mesmo `serialNumber` na mesma empresa → `409 Conflict`
- [ ] Dois acessórios com o mesmo `serialNumber` em empresas diferentes → permitido (✅)
- [ ] Tentar criar dois acessórios com o mesmo `patrimonyNumber` na mesma empresa → `409 Conflict`
- [ ] `qrCode` deve ser globalmente único — tentar duplicar entre empresas → `409 Conflict`

### 5.6 Testes de autorização por role

- [ ] `CLIENT_VIEWER` tentando criar acessório → `403 Forbidden`
- [ ] `CLIENT_USER` tentando desvincular acessório → `403 Forbidden`
- [ ] `TECHNICIAN` criando manutenção de acessório → `201 Created` (se tiver permissão)
- [ ] Usuário sem `companyId` (ex: `SUPER_ADMIN` sem contexto) → tratar adequadamente

### 5.7 Testes de escopo do usuário cliente

- [ ] Usuário cliente vê apenas acessórios vinculados a equipamentos do seu escopo
- [ ] Usuário cliente não vê acessórios com `status = AVAILABLE` (não vinculados)
- [ ] Busca por QR Code deve respeitar o escopo do usuário

### 5.8 Testes de validação de DTO

- [ ] `warrantyEnd` anterior a `warrantyStart` → `400 Bad Request`
- [ ] `purchaseValue` negativo → `400 Bad Request`
- [ ] `categoryId` inválido (não UUID) → `400 Bad Request`
- [ ] `type = LOAN` sem `expectedReturnAt` → `400 Bad Request`
- [ ] `originLocationId === destinationLocationId` → `400 Bad Request`

---

## 6. Validação Final

### 6.1 Validação do schema e banco

- [ ] `npx prisma migrate status` — todas migrations aplicadas com sucesso
- [ ] `npx prisma db pull` — schema local está sincronizado com o banco
- [ ] `npx prisma validate` — nenhum erro de schema
- [ ] Verificar via SQL que os índices parciais existem:
  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE indexname LIKE 'accessory%'
  ORDER BY indexname;
  ```
- [ ] Verificar que `qr_code` tem constraint `UNIQUE` na tabela `accessories`

### 6.2 Validação das APIs (smoke test manual)

- [ ] `POST /accessories/categories` → cria categoria
- [ ] `GET /accessories/categories` → lista categorias da empresa
- [ ] `POST /accessories` → cria acessório com `status = AVAILABLE`
- [ ] `GET /accessories` → lista com paginação e filtros
- [ ] `GET /accessories/:id` → detalhe com histórico de vínculos
- [ ] `POST /accessories/:id/assign` → vincula a equipamento → `status = IN_USE`
- [ ] `POST /accessories/:id/unassign` → desvincula → `status = AVAILABLE`
- [ ] `GET /equipments/:id/accessories` → lista acessórios do equipamento
- [ ] `POST /accessories/:id/movements` → registra movimentação física
- [ ] `POST /accessories/:id/maintenances` → registra manutenção
- [ ] `GET /accessories/:id/history` → retorna timeline completa (status, vínculos, movimentações)
- [ ] `GET /accessories?qrCode=ACC-XXXXX` → busca por QR code

### 6.3 Validação da consistência dos dados desnormalizados

- [ ] Após assign: `accessories.current_equipment_id = equipmentId` ✅
- [ ] Após assign: `accessories.status = IN_USE` ✅
- [ ] Após unassign: `accessories.current_equipment_id = NULL` ✅
- [ ] Após unassign: `accessories.status = AVAILABLE` ✅
- [ ] Após movement: `accessories.current_location_id = destinationLocationId` ✅
- [ ] Após maintenance complete: `accessories.last_maintenance_at = completedAt` ✅
- [ ] Após maintenance complete: `accessories.total_maintenances += 1` ✅

### 6.4 Validação de alertas (EventType)

- [ ] Evento `ACCESSORY_WARRANTY_EXPIRING` está sendo disparado para acessórios com `warrantyEnd` nos próximos 30 dias
- [ ] Evento `ACCESSORY_ASSIGNED` está sendo disparado com payload correto
- [ ] Evento `ACCESSORY_UNASSIGNED` está sendo disparado com payload correto

### 6.5 Validação da documentação Swagger

- [ ] Todos os endpoints documentados com `@ApiOperation`, `@ApiResponse`
- [ ] DTOs com `@ApiProperty` nos campos obrigatórios
- [ ] Confirmar que o Swagger UI mostra o módulo de acessórios corretamente

---

## 7. Integração com a UI

### 7.1 Tab "Acessórios" na tela de detalhe do Equipment

- [ ] Adicionar aba "Acessórios" ao componente de detalhe de equipamento
- [ ] Listar acessórios atualmente vinculados com:
  - Nome, categoria, serial/patrimônio
  - Status badge (cor baseada no `AccessoryStatus`)
  - Alerta visual se `warrantyEnd` estiver vencendo (< 30 dias)
  - Botão "Desvincular"
- [ ] Botão "Vincular Acessório" → abre Sheet/Modal com duas abas:
  - "Buscar existente" — busca por nome, serial, patrimônio, QR code
  - "Cadastrar novo" — form inline de criação + vínculo imediato
- [ ] Sheet de desvinculação com campo de motivo

### 7.2 Módulo independente de Acessórios (nova rota)

- [ ] Adicionar rota `/accessories` no router da aplicação
- [ ] Listagem geral com filtros por:
  - Status, categoria, localização atual, equipamento atual
  - Garantia vencida / vencendo
  - Busca por texto (nome, serial, patrimônio)
- [ ] Paginação e ordenação na listagem
- [ ] Botão "Novo Acessório" → Sheet de criação independente (sem vínculo)
- [ ] Clicar em um acessório → página de detalhe

### 7.3 Página de detalhe do Acessório

- [ ] Header com nome, status badge, QR code icon (clicável para imprimir/exibir)
- [ ] Seção "Informações Gerais": categoria, serial, patrimônio, marca, modelo, criticidade
- [ ] Seção "Financeiro": valor de compra, data de compra, garantia (com alerta se vencida)
- [ ] Tab "Histórico de Vínculos" — timeline com todos os `AccessoryAssignment`:
  - Equipamento, período, quem vinculou/desvinculou, motivo
- [ ] Tab "Movimentações" — histórico de `AccessoryMovement`
- [ ] Tab "Manutenções" — histórico de `AccessoryMaintenance` com botão "Registrar Manutenção"
- [ ] Tab "Anexos"

### 7.4 Gestão de categorias (`AccessoryCategory`)

- [ ] CRUD de categorias acessível nas configurações da empresa
- [ ] Selector de categoria no form de criação de acessório

### 7.5 Templates por tipo de equipamento (`EquipmentAccessoryTemplate`)

- [ ] UI para configurar quais categorias são esperadas para cada `EquipmentType`
- [ ] No detalhe do equipamento, indicar categorias de acessório faltantes com base no template

### 7.6 Scanner de QR Code

- [ ] Botão/ação global de "Escanear QR" (ícone de câmera)
- [ ] Ao escanear, redirecionar para o detalhe do acessório
- [ ] Se acessório for `AVAILABLE`, oferecer opção de vincular a um equipamento

### 7.7 Checklist de integração técnica

- [ ] Criar service no frontend para consumir todos os endpoints de acessório
- [ ] Criar tipos TypeScript dos DTOs de resposta (ou compartilhar via pacote do monorepo)
- [ ] Atualizar a listagem de equipamentos para exibir o contador de acessórios vinculados (`_count.currentAccessories`)
- [ ] Garantir que o `QueryClient` invalida o cache do equipment ao vincular/desvincular acessório
- [ ] Adicionar toast de sucesso/erro nas operações de assign/unassign/movement

---

## Dependências entre Seções

```
1 (schema) → 2 (migration) → 3 (regras) → 4 (dev) → 5 (testes) → 6 (validação) → 7 (UI)
                                   ↑                      ↑
                           pode ocorrer                em paralelo
                           em paralelo              com 4 se houver
                           com o início de 4          mock de API
```

---

## Notas de Risco

| Risco | Mitigação |
|---|---|
| Índice único parcial não suportado nativamente pelo Prisma | Adicionar manualmente no SQL da migration antes de executar |
| Estado desnormalizado (`currentEquipmentId`) dessincronizado | Toda operação de assign/unassign em `$transaction` obrigatória |
| Usuário cliente vendo acessórios de outros clientes | Implementar `resolveAccessoryScope()` análogo ao `resolveScope()` do equipment |
| QR Code duplicado entre empresas | Campo com `@unique` global no schema — é intencional por design |
| Manutenção de acessório não atualiza `lastMaintenanceAt` | Checklist de teste 6.3 cobre isso — incluir na transação de complete |

---

_Gerado em 2025-05-23 — baseado na análise arquitetural do schema.prisma atual e nos padrões do módulo `equipment` existente._
