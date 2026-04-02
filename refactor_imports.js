const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'apps', 'api', 'src', 'modules');

function replaceInDir(dir, searchRegex, replaceStr) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let file = path.join(dir, f);
    if (fs.statSync(file).isDirectory()) {
      replaceInDir(file, searchRegex, replaceStr);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(file, 'utf8');
      let newContent = content.replace(searchRegex, replaceStr);
      if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Updated imports in ${file}`);
      }
    }
  });
}

// Em tenants
replaceInDir(path.join(apiDir, 'tenants'), /companies/g, 'tenants');
replaceInDir(path.join(apiDir, 'tenants'), /create-company/g, 'create-tenant');
replaceInDir(path.join(apiDir, 'tenants'), /update-company/g, 'update-tenant');
replaceInDir(path.join(apiDir, 'tenants'), /list-companies/g, 'list-tenants');

// Em organizations
replaceInDir(path.join(apiDir, 'organizations'), /clients/g, 'organizations');
replaceInDir(path.join(apiDir, 'organizations'), /create-client/g, 'create-organization');
replaceInDir(path.join(apiDir, 'organizations'), /update-client/g, 'update-organization');
replaceInDir(path.join(apiDir, 'organizations'), /list-clients/g, 'list-organizations');

// reports module imports `../companies/companies.module` -> `../tenants/tenants.module`
replaceInDir(path.join(apiDir, 'reports'), /companies/g, 'tenants');
replaceInDir(path.join(apiDir, 'reports'), /clients/g, 'organizations');

// users service `.organization` instead of `.client` on create object.
let usersServicePath = path.join(apiDir, 'users', 'users.service.ts');
if(fs.existsSync(usersServicePath)) {
  let content = fs.readFileSync(usersServicePath, 'utf8');
  content = content.replace(/organization: \{/g, 'organization: data.organizationId ? { connect: { id: data.organizationId } } : undefined, // organization: {');
  content = content.replace(/tenant: \{/g, 'tenant: data.tenantId ? { connect: { id: data.tenantId } } : undefined, // tenant: {');
  fs.writeFileSync(usersServicePath, content, 'utf8');
}
