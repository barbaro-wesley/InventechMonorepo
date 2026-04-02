const fs = require('fs');
const path = require('path');

// 1. Fix Reports Service
const reportsFile = path.join(__dirname, 'apps', 'api', 'src', 'modules', 'reports', 'reports.service.ts');
if (fs.existsSync(reportsFile)) {
  let content = fs.readFileSync(reportsFile, 'utf8');
  content = content.replace(/\.client\?/g, '.organization?');
  content = content.replace(/os\.client/g, 'os.organization');
  content = content.replace(/eq\.client/g, 'eq.organization');
  content = content.replace(/s\.client/g, 's.organization');
  fs.writeFileSync(reportsFile, content, 'utf8');
}

// 2. Fix Service Orders Service (also uses .client)
const soFile = path.join(__dirname, 'apps', 'api', 'src', 'modules', 'service-orders', 'service-orders.service.ts');
if (fs.existsSync(soFile)) {
  let content = fs.readFileSync(soFile, 'utf8');
  content = content.replace(/\.client\?/g, '.organization?');
  content = content.replace(/os\.client/g, 'os.organization');
  fs.writeFileSync(soFile, content, 'utf8');
}

// 3. Fix Users Service
const usersFile = path.join(__dirname, 'apps', 'api', 'src', 'modules', 'users', 'users.service.ts');
if (fs.existsSync(usersFile)) {
  let content = fs.readFileSync(usersFile, 'utf8');
  content = content.replace(/company:/g, 'tenant:');
  fs.writeFileSync(usersFile, content, 'utf8');
}

// 4. Fix seed2.ts
const seedFile = path.join(__dirname, 'apps', 'api', 'prisma', 'seed2.ts');
if (fs.existsSync(seedFile)) {
  let content = fs.readFileSync(seedFile, 'utf8');
  content = content.replace(/companyId/g, 'tenantId');
  content = content.replace(/clientId/g, 'organizationId');
  content = content.replace(/\.company/g, '.tenant');
  content = content.replace(/\.client/g, '.organization');
  content = content.replace(/company:/g, 'tenant:');
  content = content.replace(/client:/g, 'organization:');
  fs.writeFileSync(seedFile, content, 'utf8');
}

console.log('Fixed final TS references');
