const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps', 'api', 'src', 'modules', 'notifications', 'notifications.gateway.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/organization: Socket/g, 'client: Socket');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed Gateway parameter');
