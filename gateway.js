// Local Modbus TCP poller. Serves http://127.0.0.1:8085/api/telemetry
// (replaces the Termux Python server) and talks to the LTE gateway directly.
const net = require('net');
const http = require('http');
const REG = require('./registers');

class ModbusTcp {
  constructor(host, port, timeout) {
    this.host = host; this.port = port; this.timeout = timeout;
    this.sock = null; this.tid = 0;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const s = net.createConnection({ host: this.host, port: this.port });
      const t = setTimeout(() => { s.destroy(); reject(new Error('Gateway connect timeout')); }, Math.max(this.timeout, 3000));
      s.once('connect', () => { clearTimeout(t); s.setNoDelay(true); this.sock = s; resolve(); });
      s.once('error', e => { clearTimeout(t); reject(new Error('Gateway unreachable: ' + e.message)); });
      s.on('close', () => { if (this.sock === s) this.sock = null; });
      s.on('error', () => {});
    });
  }
  async read(unit, addr, count) {
    if (!this.sock) await this.connect();
    const sock = this.sock;
    return new Promise((resolve, reject) => {
      const tid = (this.tid = (this.tid + 1) & 0xffff);
      const req = Buffer.alloc(12);
      req.writeUInt16BE(tid, 0); req.writeUInt16BE(0, 2); req.writeUInt16BE(6, 4);
      req.writeUInt8(unit, 6); req.writeUInt8(3, 7);
      req.writeUInt16BE(addr, 8); req.writeUInt16BE(count, 10);
      let acc = Buffer.alloc(0);
      const done = () => { clearTimeout(timer); sock.removeListener('data', onData); sock.removeListener('close', onClose); };
      const fail = (msg, kill) => { done(); if (kill) sock.destroy(); reject(new Error(msg)); };
      const onClose = () => fail('Connection closed', false);
      const onData = d => {
        acc = Buffer.concat([acc, d]);
        if (acc.length < 9) return;
        const len = acc.readUInt16BE(4);
        if (acc.length < 6 + len) return;
        if (acc.readUInt16BE(0) !== tid) return fail('Transaction mismatch', true);
        if (acc[7] & 0x80) return fail('Modbus exception ' + acc[8], false);
        done();
        const regs = [];
        for (let i = 0; i < acc[8] / 2; i++) regs.push(acc.readUInt16BE(9 + 2 * i));
        resolve(regs);
      };
      const timer = setTimeout(() => fail('Timeout (slave ' + unit + ')', true), this.timeout);
      sock.on('data', onData); sock.on('close', onClose);
      sock.write(req);
    });
  }
  close() { if (this.sock) this.sock.destroy(); this.sock = null; }
}

function decode(blocks, f) {
  const size = f.type === 'f32' ? 2 : f.type === 'i64' ? 4 : 1;
  const b = blocks.find(b => f.addr >= b.start && f.addr + size <= b.start + b.regs.length);
  if (!b) return undefined;
  const r = b.regs, o = f.addr - b.start;
  let v;
  if (f.type === 'u16') v = r[o];
  else if (f.type === 'i16') v = r[o] >= 32768 ? r[o] - 65536 : r[o];
  else if (f.type === 'f32') {
    const buf = Buffer.alloc(4); buf.writeUInt16BE(r[o], 0); buf.writeUInt16BE(r[o + 1], 2);
    v = buf.readFloatBE(0);
  } else if (f.type === 'i64') {
    const buf = Buffer.alloc(8); for (let i = 0; i < 4; i++) buf.writeUInt16BE(r[o + i], i * 2);
    v = Number(buf.readBigInt64BE(0));
  }
  if (typeof v !== 'number' || !isFinite(v)) return undefined;
  return +(v * (f.scale || 1)).toFixed(3);
}

async function readDevice(mb, slave, def) {
  const blocks = [];
  for (const blk of def.blocks) {
    blocks.push({ start: blk.start, regs: await mb.read(slave, blk.start, blk.count) });
  }
  const out = {};
  for (const [name, f] of Object.entries(def.fields)) {
    const v = decode(blocks, f);
    if (v !== undefined) out[name] = v;
  }
  return out;
}

const INV_STATE = ['STANDBY (OPEN)', 'ON-GRID', 'OFF-GRID / V-F', 'FAULT'];
let client = null, inflight = null, cache = null;

async function poll(host, port, timeout) {
  if (!client || client.host !== host || client.port !== port || client.timeout !== timeout) {
    if (client) client.close();
    client = new ModbusTcp(host, port, timeout);
  }
  if (!client.sock) await client.connect();   // throws if gateway unreachable

  const inverters = [], meters = [];
  for (const slave of REG.inverters.slaves) {
    try {
      const d = await readDevice(client, slave, REG.inverters);
      d.state = INV_STATE[d.stateRaw] || 'ON-GRID'; delete d.stateRaw;
      d.pvTotalKw = +((d.pv1Kw || 0) + (d.pv2Kw || 0)).toFixed(2);
      if (d.activeKw !== undefined) {
        d.apparentKva = +Math.hypot(d.activeKw, d.reactiveKvar || 0).toFixed(2);
        d.pf = d.apparentKva > 0.1 ? +(Math.abs(d.activeKw) / d.apparentKva).toFixed(3) : 1;
      }
      inverters.push(d);
    } catch (e) { inverters.push({ state: 'COMM LOSS', error: e.message }); }
  }
  for (const slave of REG.meters.slaves) {
    try {
      const d = await readDevice(client, slave, REG.meters);
      d.online = true; meters.push(d);
    } catch (e) { meters.push({ online: false, error: e.message }); }
  }
  return { connected: true, timestamp: new Date().toISOString(), inverters, meters };
}

function pollCached(host, port, timeout) {
  if (cache && Date.now() - cache.t < 500 && cache.key === host + port) return Promise.resolve(cache.data);
  if (inflight) return inflight;
  inflight = poll(host, port, timeout)
    .then(data => { cache = { t: Date.now(), key: host + port, data }; return data; })
    .finally(() => { inflight = null; });
  return inflight;
}

function startServer(listenPort = 8085) {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    const origin = req.headers.origin || '';
    // Only the desktop app (file://) may call this; block normal websites.
    if (/^https?:/i.test(origin)) { res.writeHead(403); return res.end(); }
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...headers, 'Access-Control-Allow-Headers': '*' }); return res.end(); }
    if (u.pathname !== '/api/telemetry') { res.writeHead(404, headers); return res.end('{}'); }
    const host = (u.searchParams.get('ip') || '').trim();
    const port = parseInt(u.searchParams.get('port'), 10) || 502;
    const timeout = Math.min(Math.max(parseInt(u.searchParams.get('timeout'), 10) || 1500, 300), 15000);
    if (!/^[A-Za-z0-9.\-]{1,253}$/.test(host) || port < 1 || port > 65535) {
      res.writeHead(400, headers); return res.end(JSON.stringify({ connected: false, error: 'Bad gateway address' }));
    }
    try {
      const data = await pollCached(host, port, timeout);
      res.writeHead(200, headers); res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(503, headers); res.end(JSON.stringify({ connected: false, error: e.message }));
    }
  });
  server.on('error', e => console.error('Telemetry server error:', e.message));
  server.listen(listenPort, '127.0.0.1');
  return server;
}

module.exports = { startServer, poll };
