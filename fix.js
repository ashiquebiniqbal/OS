const fs = require('fs');
const files = ['js/apps/agents.js', 'js/apps/blockchain.js', 'js/apps/bridge.js', 'js/apps/saas.js'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/win\.content/g, 'win.querySelector(".window-content")');
  fs.writeFileSync(file, content);
}
console.log('Fixed');
