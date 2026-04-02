const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, 'apps', 'api', 'src');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
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

  // Class / Interfaces names
  content = content.replace(/\bCompaniesModule\b/g, 'TenantsModule');
  content = content.replace(/\bCompaniesService\b/g, 'TenantsService');
  content = content.replace(/\bCompaniesRepository\b/g, 'TenantsRepository');
  content = content.replace(/\bCompaniesController\b/g, 'TenantsController');

  content = content.replace(/\bClientsModule\b/g, 'OrganizationsModule');
  content = content.replace(/\bClientsService\b/g, 'OrganizationsService');
  content = content.replace(/\bClientsRepository\b/g, 'OrganizationsRepository');
  content = content.replace(/\bClientsController\b/g, 'OrganizationsController');

  // Enums
  content = content.replace(/\bUserRole\b/g, 'GlobalUserRole');
  content = content.replace(/\bCompanyStatus\b/g, 'TenantStatus');
  content = content.replace(/\bClientStatus\b/g, 'OrgStatus');

  // Prisma Methods (e.g. prisma.company -> prisma.tenant)
  content = content.replace(/\.company\./g, '.tenant.');
  content = content.replace(/\.company\b/g, '.tenant');
  content = content.replace(/client: /g, 'organization: ');
  // Cannot do .client blindly, so only specific ones:
  content = content.replace(/prisma\.client\b/g, 'prisma.organization');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

walkDir(API_DIR, refactorFile);
console.log("Done fixing classes and instances.");
