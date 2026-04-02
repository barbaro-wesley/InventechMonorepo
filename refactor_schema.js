const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'apps', 'api', 'prisma', 'schema.prisma.backup');
const schemaOutPath = path.join(__dirname, 'apps', 'api', 'prisma', 'schema.prisma');

let content = fs.readFileSync(schemaPath, 'utf8');

// ENUMS
content = content.replace(/enum CompanyStatus/g, 'enum TenantStatus');
content = content.replace(/enum ClientStatus/g, 'enum OrgStatus');

// Models
content = content.replace(/model Company \{/g, 'model Tenant {');
content = content.replace(/model Client \{/g, 'model Organization {');
content = content.replace(/@@map\("companies"\)/g, '@@map("tenants")');
content = content.replace(/@@map\("clients"\)/g, '@@map("organizations")');

// Types
content = content.replace(/\bCompanyStatus\b/g, 'TenantStatus');
content = content.replace(/\bClientStatus\b/g, 'OrgStatus');
content = content.replace(/\bCompany\b/g, 'Tenant');
content = content.replace(/\bClient\b/g, 'Organization');

// Fields
content = content.replace(/\bcompanyId\b/g, 'tenantId');
content = content.replace(/\bclientId\b/g, 'organizationId');
content = content.replace(/\bcompany_id\b/g, 'tenant_id');
content = content.replace(/\bclient_id\b/g, 'organization_id');

// Add ServiceContract model
const serviceContractStr = `
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

model ServiceContract {
  id             String         @id @default(uuid())
  tenantId       String         @map("tenant_id")
  providerId     String         @map("provider_id")
  organizationId String         @map("client_id")
  status         String         @default("ACTIVE")
  startDate      DateTime       @map("start_date")
  endDate        DateTime?      @map("end_date")
  createdAt      DateTime       @default(now()) @map("created_at")

  tenant         Tenant         @relation(fields: [tenantId], references: [id])
  provider       Organization   @relation("ContractProvider", fields: [providerId], references: [id])
  organization   Organization   @relation("ContractClient", fields: [organizationId], references: [id])

  serviceOrders  ServiceOrder[]

  @@unique([tenantId, providerId, organizationId])
  @@map("service_contracts")
}
`;

// Insert it right before "model User {"
content = content.replace(/model User \{/, serviceContractStr + '\nmodel User {');

// Add contracts relations to Organization (formerly Client)
const orgContractsStr = `
  contractsAsProvider ServiceContract[] @relation("ContractProvider")
  contractsAsClient   ServiceContract[] @relation("ContractClient")
`;
// find `costCenters   CostCenter[]`
content = content.replace(/(costCenters\s+CostCenter\[\])/, orgContractsStr + '\n  $1');

// Add ServiceContract to ServiceOrder
content = content.replace(/(equipmentId\s+String\s+@map\("equipment_id"\))/, 'serviceContractId String? @map("service_contract_id")\n  $1');
content = content.replace(/(equipment\s+Equipment\s+@relation\(fields: \[equipmentId\], references: \[id\]\))/, 'serviceContract ServiceContract? @relation(fields: [serviceContractId], references: [id])\n  $1');

// Type overrides
// `is_internal` field
content = content.replace(/(reportName\s+String\?\s+@map\("report_name"\))/, 'isInternal Boolean @default(false) @map("is_internal")\n  $1');

fs.writeFileSync(schemaOutPath, content, 'utf8');
console.log('Restored and transformed schema.prisma');
