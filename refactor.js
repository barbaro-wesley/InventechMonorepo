const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, 'apps', 'api', 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function refactorFile(filePath) {
  if (!filePath.endsWith('.ts')) return;

  const originalContent = fs.readFileSync(filePath, 'utf-8');
  let content = originalContent;

  // Safe Exact Property Replacements
  // Match property declarations or accesses, like `companyId?: string`, `.companyId =`, `{ companyId:`, `{ companyId }`
  content = content.replace(/\bcompanyId\b/g, 'tenantId');
  content = content.replace(/\bclientId\b/g, 'organizationId');
  
  // Relations usage: user.company -> user.tenant, user.client -> user.organization
  // Only replace property accesses and destructurings carefully, avoiding PrismaClient etc.
  content = content.replace(/\.company\b/g, '.tenant');
  // Avoid replacing .client since Prisma uses prisma.$transaction(async (txClient) => txClient) which is sometimes called client
  content = content.replace(/user\.client\b/g, 'user.organization');
  content = content.replace(/dto\.client\b/g, 'dto.organization');

  // Repositories
  content = content.replace(/\bCompaniesRepository\b/g, 'TenantsRepository');
  content = content.replace(/\bClientsRepository\b/g, 'OrganizationsRepository');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

console.log("Starting refactor in API...");
walkDir(API_DIR, refactorFile);
console.log("Done refactoring keys.");
