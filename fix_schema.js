const fs = require('fs');
const file = './apps/api/prisma/schema.prisma';
let lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Fix Company relation
  if (line.match(/^\s+company\s+Tenant/)) {
    lines[i] = line.replace(/^\s+company/, '  tenant');
  }

  // Fix Client relation
  if (line.match(/^\s+client\s+Organization/)) {
    lines[i] = line.replace(/^\s+client/, '  organization');
  }
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed Prisma relationships');
