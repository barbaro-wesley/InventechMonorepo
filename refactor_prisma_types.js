const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let file = path.join(dir, f);
    if (fs.statSync(file).isDirectory()) {
      replaceInDir(file);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(file, 'utf8');
      
      content = content.replace(/CompanySelect/g, 'TenantSelect');
      content = content.replace(/CompanyGetPayload/g, 'TenantGetPayload');
      content = content.replace(/CompanyWhereInput/g, 'TenantWhereInput');
      content = content.replace(/CompanyCreateInput/g, 'TenantCreateInput');
      content = content.replace(/CompanyUpdateInput/g, 'TenantUpdateInput');
      content = content.replace(/CompanyOrderByWithRelationInput/g, 'TenantOrderByWithRelationInput');

      content = content.replace(/ClientSelect/g, 'OrganizationSelect');
      content = content.replace(/ClientGetPayload/g, 'OrganizationGetPayload');
      content = content.replace(/ClientWhereInput/g, 'OrganizationWhereInput');
      content = content.replace(/ClientCreateInput/g, 'OrganizationCreateInput');
      content = content.replace(/ClientUpdateInput/g, 'OrganizationUpdateInput');
      content = content.replace(/ClientOrderByWithRelationInput/g, 'OrganizationOrderByWithRelationInput');

      if(content.includes('get company()')) {
        content = content.replace(/get company\(\)/, 'get tenant()');
      }

      fs.writeFileSync(file, content, 'utf8');
    }
  });
}

replaceInDir(path.join(__dirname, 'apps', 'api', 'src'));
