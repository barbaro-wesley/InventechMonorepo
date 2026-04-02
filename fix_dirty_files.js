const fs = require('fs');

const files = [
  'apps/api/src/modules/reports/reports.service.ts',
  'apps/api/src/modules/service-orders/service-orders.service.ts',
  'apps/api/prisma/seed2.ts'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(/os\.client/g, 'os.organization');
    s = s.replace(/eq\.client/g, 'eq.organization');
    s = s.replace(/s\.client/g, 's.organization');
    s = s.replace(/companyId/g, 'tenantId');
    s = s.replace(/clientId/g, 'organizationId');
    
    // For object keys or fields like company: { connects }
    s = s.replace(/company:/g, 'tenant:');
    s = s.replace(/client:/g, 'organization:');
    
    // For Prisma relations like prisma.company
    s = s.replace(/\.company/g, '.tenant');
    s = s.replace(/\.client/g, '.organization');

    fs.writeFileSync(f, s);
    console.log(`Fixed ${f}`);
  }
});
