const https = require('https');
const fs = require('fs');
const path = require('path');

const components = [
  'button',
  'dropdown-menu',
  'avatar',
  'tooltip',
  'separator',
  'scroll-area'
];

const uiPath = path.join(__dirname, 'src', 'components', 'ui');
if (!fs.existsSync(uiPath)) {
  fs.mkdirSync(uiPath, { recursive: true });
}

components.forEach(component => {
  const url = `https://ui.shadcn.com/registry/styles/default/${component}.json`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.files && json.files.length > 0) {
          json.files.forEach(file => {
            const filePath = path.join(uiPath, file.name);
            fs.writeFileSync(filePath, file.content);
            console.log(`Saved ${file.name}`);
          });
        }
      } catch(e) {
        console.error(`Failed to parse ${component}.json`);
      }
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${component}:`, err);
  });
});
