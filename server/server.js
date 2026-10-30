// Lichtschlinge – Arena-Server: eine große, dauerhaft laufende Welt für bis zu 200 Lichter.
// Der Server simuliert Gegner, Punkte und Berührungen; jedes Licht bewegt sich im eigenen Browser
// und meldet Position, Schweif und geschlossene Schlingen.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const LS = require('../src/sim.js');

const PORT = +process.env.PORT || 8787;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 200;
const WORLD_SIZE = +process.env.WORLD_SIZE || 7000;
const TICK_HZ = 30;          // Simulation
const SEND_EVERY = 2;        // Zustand an die Browser: 15-mal pro Sekunde
const MAX_BUFFER = 256 * 1024;
const LOG_S = +process.env.LOG_SECONDS || 60;

const world = new LS.World({ w: WORLD_SIZE, h: WORLD_SIZE, arena: true });
world.running = true;

const clients = new Map();   // id -> { ws, id, vw, vh, ev, msgs }
let nextId = 1;
let hall = [];               // Bestenliste seit Serverstart
const perf = { ticks: 0, ms: 0, maxMs: 0, bytes: 0, wire: 0 };
let wireSeen = new WeakMap();

// Spielseite mit eingetragener Server-Adresse ausliefern (dann reicht ein einziger Link)
let page = null;
try {
  page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
    .replace('<head>', '<head><script>window.LS_SERVER_URL = location.origin.replace(/^http/, "ws");</script>');
} catch (e) { console.warn('index.html nicht gefunden – nur WebSocket-Betrieb'); }

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/status') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ players: clients.size, alive: world.aliveList().length, max: MAX_PLAYERS, enemies: world.enemies.length }));
  }
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  if ((url === '/' || url === '/index.html') && page) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
    return res.end(page);
  }
  res.writeHead(404); res.end();
});

// Kompression spart bei JSON gut zwei Drittel der Daten
const wss = new WebSocketServer({
  server, maxPayload: 32 * 1024,
  perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 }, serverNoContextTakeover: false, clientNoContextTakeover: true, concurrencyLimit: 16 }
});

const send = (c, m) => { if (c.ws.readyState === 1) c.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
const cleanName = n => String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14) || 'Licht';
const num = (v, a, b, d) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

wss.on('connection', ws => {
  if (clients.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'full' })); ws.close(1013, 'voll'); return; }
  const c = { ws, id: 0, vw: 1600, vh: 900, ev: [], msgs: 0, alive: true };
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', raw => {
    // Einfache Drosselung gegen Fluten
    if (++c.msgs > 120) { if (c.msgs > 400) ws.terminate(); return; }
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (c.id) return;
      c.id = nextId++;
      c.vw = num(m.vw, 400, 3200, 1600); c.vh = num(m.vh, 300, 2400, 900);
      const hue = LS.ARENA_HUES[c.id % LS.ARENA_HUES.length];
      world.rebuildHashes();
      const p = world.addPlayer(c.id, cleanName(m.name), hue);
      clients.set(c.id, c);
      send(c, { t: 'welcome', id: c.id, hue, w: world.w, h: world.h, x: Math.round(p.x), y: Math.round(p.y) });
      return;
    }
    if (!c.id) return;
    if (m.t === 'view') { c.vw = num(m.vw, 400, 3200, c.vw); c.vh = num(m.vh, 300, 2400, c.vh); return; }
    if (m.t === 'spawn') {
      world.rebuildHashes();
      const p = world.respawn(c.id);
      if (p && p.alive) send(c, { t: 'spawned', x: Math.round(p.x), y: Math.round(p.y) });
      return;
    }
    if (m.t === 'p' || m.t === 'loop' || m.t === 'pulse' || m.t === 'die') world.handle(c.id, m);
  });
  ws.on('close', () => {
    if (!c.id) return;
    clients.delete(c.id);
    world.removePlayer(c.id);
  });
  ws.on('error', () => {});
});

// Verbindungen ohne Lebenszeichen aufräumen (hält auch Proxys wach)
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    try { c.ws.ping(); } catch (e) {}
  }
}, 20000);

function evPos(ev) {
  if (typeof ev.x === 'number') return ev;
  if (typeof ev.cx === 'number') return { x: ev.cx, y: ev.cy };
  return null;
}

let tickN = 0;
function tick() {
  const t0 = process.hrtime.bigint();
  world.step(1 / TICK_HZ);
  tickN++;

  // Ereignisse an die Lichter verteilen, in deren Nähe sie passieren
  const evs = world.events; world.events = [];
  if (evs.length) {
    for (const c of clients.values()) {
      const me = world.players.get(c.id);
      if (!me) continue;
      const hw = c.vw / 2 + 300, hh = c.vh / 2 + 300;
      for (const ev of evs) {
        if (ev.id === c.id || ev.by === c.id) { c.ev.push(ev); continue; }
        if (ev.k === 'cl') continue;
        const pos = evPos(ev);
        if (pos && Math.abs(pos.x - me.x) < hw && Math.abs(pos.y - me.y) < hh) c.ev.push(ev);
      }
    }
  }

  // Verglühte Lichter: Ergebnis und Bestenliste
  if (world.deaths.length) {
    for (const id of world.deaths) {
      const p = world.players.get(id), c = clients.get(id);
      if (!p) continue;
      const res = world.resultOf(p);
      if (res.score > 0) {
        hall.push({ name: res.name, hue: res.hue, score: res.score, multMax: res.multMax, kills: res.kills, steals: res.steals });
        hall.sort((a, b) => b.score - a.score); hall = hall.slice(0, 10);
      }
      let rank = 1;
      for (const o of world.players.values()) if (o !== p && o.alive && o.score > res.score) rank++;
      if (c) send(c, { t: 'dead', res, rank, n: world.players.size, hall });
    }
    world.deaths = [];
  }

  if (tickN % SEND_EVERY === 0) {
    for (const c of clients.values()) {
      const me = world.players.get(c.id);
      if (!me) continue;
      if (c.ws.bufferedAmount > MAX_BUFFER) { c.ev = []; continue; } // langsame Leitung: dieses Bild auslassen
      const s = world.snapshotFor(me, c.vw, c.vh);
      s.ev = c.ev; c.ev = [];
      const str = JSON.stringify(s);
      perf.bytes += str.length;
      send(c, str);
    }
  }

  if (tickN % TICK_HZ === 0) {
    const lb = world.leaderboard();
    for (const c of clients.values()) {
      c.msgs = 0;
      send(c, { t: 'lb', top: lb.top, n: lb.n, alive: lb.alive, rank: lb.rank.get(c.id) || 0 });
    }
  }

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  perf.ticks++; perf.ms += ms; perf.maxMs = Math.max(perf.maxMs, ms);
}

// Fester Takt, der Verzögerungen aufholt, ohne zu stapeln
let next = Date.now();
function loop() {
  const now = Date.now();
  let n = 0;
  while (now >= next && n < 3) { tick(); next += 1000 / TICK_HZ; n++; }
  if (now - next > 500) next = now;
  setTimeout(loop, Math.max(1, next - Date.now()));
}
loop();

setInterval(() => {
  if (!perf.ticks) return;
  for (const c of clients.values()) {
    const sock = c.ws._socket, w = sock ? sock.bytesWritten : 0;
    perf.wire += w - (wireSeen.get(c) || 0); wireSeen.set(c, w);
  }
  console.log(`[arena] ${clients.size} Lichter, ${world.enemies.length} Gegner, ${world.gems.length} Funken · Takt Ø ${(perf.ms / perf.ticks).toFixed(2)} ms, max ${perf.maxMs.toFixed(1)} ms · JSON ${(perf.bytes / 1024 / LOG_S).toFixed(0)} KB/s, über die Leitung ${(perf.wire / 1024 / LOG_S).toFixed(0)} KB/s`);
  perf.ticks = 0; perf.ms = 0; perf.maxMs = 0; perf.bytes = 0; perf.wire = 0;
}, LOG_S * 1000);

server.listen(PORT, () => console.log(`Lichtschlinge-Arena läuft auf Port ${PORT} (max. ${MAX_PLAYERS} Lichter, Welt ${WORLD_SIZE}×${WORLD_SIZE})`));

const stop = () => { console.log('Arena wird beendet'); for (const c of clients.values()) try { c.ws.close(1001, 'Neustart'); } catch (e) {} server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
