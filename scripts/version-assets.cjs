// Run after changing browser assets so cached files cannot mix different releases.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
for (const file of ['index.html', 'privacy.html']) {
  const target = path.join(root, file);
  const html = fs.readFileSync(target, 'utf8').replace(
    /\b(src|href)="([^"?:]+\.(?:js|css))(?:\?v=[a-f0-9]+)?"/g,
    (_, attr, asset) => {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, asset))).digest('hex').slice(0, 12);
      return `${attr}="${asset}?v=${hash}"`;
    }
  );
  fs.writeFileSync(target, html);
}
