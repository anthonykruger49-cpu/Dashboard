// Downloads CDN libraries into app/vendor and rewrites index.html so the
// installed app works fully offline.
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'app', 'index.html');
const vendorDir = path.join(__dirname, '..', 'app', 'vendor');

const libs = [
  { url: 'https://cdn.jsdelivr.net/npm/chart.js', file: 'chart.umd.js' },
  { url: 'https://cdn.tailwindcss.com', file: 'tailwind.js' },
  { url: 'https://unpkg.com/lucide@latest', file: 'lucide.js' }
];

(async () => {
  fs.mkdirSync(vendorDir, { recursive: true });
  let html = fs.readFileSync(htmlPath, 'utf8');

  for (const { url, file } of libs) {
    if (!html.includes(url)) { console.log('skip (not found in html):', url); continue; }
    console.log('downloading', url);
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
    fs.writeFileSync(path.join(vendorDir, file), Buffer.from(await res.arrayBuffer()));
    html = html.split(url).join('vendor/' + file);
  }

  // Google Fonts need internet; remove the links so the app falls back to system fonts offline.
  html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');

  fs.writeFileSync(htmlPath, html);
  console.log('Offline assets ready.');
})().catch(e => { console.error(e); process.exit(1); });
