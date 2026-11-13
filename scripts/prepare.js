// Prepares app/index.html for the desktop app:
//  1) downloads CDN libraries so the app works offline
//  2) points LIVE mode at the built-in local Modbus bridge
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'app', 'index.html');
const vendorDir = path.join(__dirname, '..', 'app', 'vendor');

const libs = [
  { url: 'https://cdn.jsdelivr.net/npm/chart.js', file: 'chart.umd.js' },
  { url: 'https://cdn.tailwindcss.com', file: 'tailwind.js' },
  { url: 'https://unpkg.com/lucide@latest', file: 'lucide.js' }
];

function patch(html, from, to, label) {
  if (!html.includes(from)) throw new Error('Patch target not found: ' + label);
  return html.split(from).join(to);
}

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
  html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');

  if (!html.includes('__DESKTOP_PATCHED__')) {
    // default endpoint = built-in local bridge
    html = patch(html, "'/api/telemetry'", "'http://127.0.0.1:8085/api/telemetry'", 'apiUrl');
    // send gateway IP / port / timeout with every poll
    html = patch(html,
      "fetch(state.gateway.apiUrl, { cache: 'no-store' })",
      "fetch(state.gateway.apiUrl + (state.gateway.apiUrl.includes('?') ? '&' : '?') + 'ip=' + encodeURIComponent(state.gateway.ip) + '&port=' + state.gateway.port + '&timeout=' + state.gateway.timeout, { cache: 'no-store' })",
      'fetch call');
    // merge live values into existing objects instead of replacing them
    html = patch(html, 'state.inverters = data.inverters;',
      'state.inverters = state.inverters.map((o, i) => Object.assign({}, o, data.inverters[i]));', 'inverters');
    html = patch(html, 'state.meters = data.meters;',
      'state.meters = state.meters.map((o, i) => Object.assign({}, o, data.meters[i]));', 'meters');
    html = html.replace('</body>', '<!-- __DESKTOP_PATCHED__ -->\n</body>');
  }

  fs.writeFileSync(htmlPath, html);
  console.log('Desktop assets ready.');
})().catch(e => { console.error(e); process.exit(1); });
