const fs = require('fs');
const path = require('path');

const prismaServicePath = path.join(__dirname, 'apps', 'api', 'src', 'prisma', 'prisma.service.ts');
let prismaService = fs.readFileSync(prismaServicePath, 'utf8');
prismaService = prismaService.replace(/get company\(\)/, 'get tenant()');
prismaService = prismaService.replace(/get client\(\) \{ return this\._db\.client \}/, 'get organization() { return this._db.organization }');
prismaService = prismaService.replace(/'Company'/, "'Tenant'");
prismaService = prismaService.replace(/'Client'/, "'Organization'");
fs.writeFileSync(prismaServicePath, prismaService);

const storageServicePath = path.join(__dirname, 'apps', 'api', 'src', 'modules', 'storage', 'storage.service.ts');
if(fs.existsSync(storageServicePath)) {
  let storageService = fs.readFileSync(storageServicePath, 'utf8');
  storageService = storageService.replace(/this\.organization/g, 'this.client');
  fs.writeFileSync(storageServicePath, storageService);
}

const schemaPath = path.join(__dirname, 'apps', 'api', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
schema = schema.replace(/enum UserRole \{/g, 'enum GlobalUserRole {');
schema = schema.replace(/role\s+UserRole/g, 'role           GlobalUserRole');
fs.writeFileSync(schemaPath, schema);
