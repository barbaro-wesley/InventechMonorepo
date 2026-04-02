const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'apps', 'api', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Replace relation names where the type is Tenant or Organization
schema = schema.replace(/company(\s+Tenant(\?|\[\]))/g, 'tenant$1');
schema = schema.replace(/client(\s+Organization(\?|\[\]))/g, 'organization$1');

// Revert UserRole instead of GlobalUserRole to avoid TS export issues
schema = schema.replace(/enum GlobalUserRole \{/g, 'enum UserRole {');
schema = schema.replace(/role\s+GlobalUserRole/g, 'role           UserRole');

fs.writeFileSync(schemaPath, schema);

// Revert UserRole in all TS files too 
function replaceInDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let file = path.join(dir, f);
    if (fs.statSync(file).isDirectory()) {
      replaceInDir(file);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(file, 'utf8');
      if(content.includes('GlobalUserRole')) {
         content = content.replace(/GlobalUserRole/g, 'UserRole');
         fs.writeFileSync(file, content, 'utf8');
      }
    }
  });
}

replaceInDir(path.join(__dirname, 'apps', 'api', 'src'));
replaceInDir(path.join(__dirname, 'apps', 'api', 'prisma'));
