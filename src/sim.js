/* Lichtschlinge – gemeinsame Simulation für den Browser (allein, Host) und den Arena-Server. */
(function (root) {
'use strict';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const TYPES = {
  seeker:  { r: 11, hue: 330, value: 10 },
  drifter: { r: 12, hue: 185, value: 6 },
  dasher:  { r: 12, hue: 48,  value: 20 },
  cutter:  { r: 13, hue: 8,   value: 25 },
  bomb:    { r: 19, hue: 275, value: 30 }
};
const TYPE_KEYS = Object.keys(TYPES);
const PHASES = ['roam', 'aim', 'dash'];
const PLAYER_HUES = [190, 105, 36, 255];
const ARENA_HUES = [190, 105, 36, 255, 140, 215, 60, 300, 165, 20, 235, 85];
const COMBO_T = 3.6;
const TRAIL_LIFE = 2.6;
const BOMB_R = 190;
const PULSE_R = 250;
const PLAYER_R = 9;
const trailMax = m => 1250 + Math.min(m - 1, 20) * 50;

// ---------- Geometrie ----------
function segInter(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return { x: ax + t * rx, y: ay + t * ry };
  return null;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function polyArea(poly) {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  return Math.abs(s / 2);
}
function centroid(poly) {
  let x = 0, y = 0; for (const p of poly) { x += p.x; y += p.y; }
  return { x: x / poly.length, y: y / poly.length };
}
function bounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  return { x0, y0, x1, y1 };
}
const flat = pts => { const a = []; for (const p of pts) a.push(Math.round(p.x), Math.round(p.y)); return a; };
const unflat = a => { const p = []; for (let i = 0; i + 1 < a.length; i += 2) p.push({ x: a[i], y: a[i + 1] }); return p; };

// Schweif (flache Liste x,y,x,y,…) auf höchstens n Punkte ausdünnen, letzter Punkt bleibt
function thinTrail(tr, n) {
  const pts = tr.length / 2;
  if (pts <= n) return tr;
  const out = [], step = (pts - 1) / (n - 1);
  for (let i = 0; i < n; i++) { const k = Math.round(i * step) * 2; out.push(tr[k], tr[k + 1]); }
  return out;
}

// ---------- Raster für Nachbarschaftssuchen (wichtig bei vielen Spielern) ----------
class Hash {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(cx, cy) { return (cx + 1024) * 4096 + (cy + 1024); }
  insert(o) {
    const k = this.key(Math.floor(o.x / this.cell), Math.floor(o.y / this.cell));
    const a = this.map.get(k);
    if (a) a.push(o); else this.map.set(k, [o]);
  }
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.map.get(this.key(cx, cy));
      if (a) for (const o of a) fn(o);
    }
  }
}

// ---------- Welt ----------
// solo: allein im Browser · Raum: Host im Browser · arena: große, dauerhafte Welt auf dem Server
class World {
  constructor(opts) {
    this.w = opts.w; this.h = opts.h; this.solo = !!opts.solo; this.arena = !!opts.arena;
    this.players = new Map(); this.enemies = []; this.gems = []; this.events = [];
    this.gameT = 0; this.spawnT = 1; this.nid = 1; this.running = false; this.endT = 0; this.done = false;
    this.pHash = new Hash(400); this.eHash = new Hash(120);
    this.deaths = [];
    this.farT = 0;
  }
  addPlayer(id, name, hue) {
    const p = { id, name, hue, x: this.w / 2, y: this.h / 2, alive: true, tr: [], lastPT: 0 };
    this.resetStats(p);
    this.players.set(id, p);
    if (this.arena) this.place(p);
    return p;
  }
  resetStats(p) {
    Object.assign(p, { alive: true, score: 0, mult: 1, multMax: 1, comboT: 0, energy: 1, loops: 0, kills: 0, catch: 0, time: 0, steals: 0, spawnAt: this.gameT, spawnT: 1.2, tr: [], lastPT: this.gameT });
  }
  respawn(id) {
    const p = this.players.get(id);
    if (!p || p.alive) return p;
    this.resetStats(p);
    this.place(p);
    return p;
  }
  removePlayer(id) { this.players.delete(id); }
  // Neue Lichter in der Arena dort absetzen, wo schon andere sind – aber nicht mitten in Gegnern
  place(p) {
    const others = this.aliveList().filter(o => o !== p);
    for (let tries = 0; tries < 25; tries++) {
      let x, y;
      if (others.length) {
        const o = others[Math.floor(Math.random() * others.length)], a = rand(0, TAU), d = rand(900, 1600);
        x = o.x + Math.cos(a) * d; y = o.y + Math.sin(a) * d;
      } else { x = rand(this.w * 0.3, this.w * 0.7); y = rand(this.h * 0.3, this.h * 0.7); }
      x = clamp(x, 250, this.w - 250); y = clamp(y, 250, this.h - 250);
      let safe = true;
      this.eHash.query(x, y, 380, e => { if (Math.hypot(e.x - x, e.y - y) < 380) safe = false; });
      for (const o of others) if (Math.hypot(o.x - x, o.y - y) < 300) safe = false;
      if (safe || tries === 24) { p.x = x; p.y = y; return; }
    }
  }
  start() {
    const arr = [...this.players.values()];
    arr.forEach((p, i) => {
      const a = i / arr.length * TAU, r = arr.length > 1 ? Math.min(this.w, this.h) * 0.2 : 0;
      p.x = this.w / 2 + Math.cos(a) * r; p.y = this.h / 2 + Math.sin(a) * r;
    });
    this.running = true;
  }
  ev(o) { this.events.push(o); }
  aliveList() { const a = []; for (const p of this.players.values()) if (p.alive) a.push(p); return a; }
  level(p) { return this.arena ? this.gameT - p.spawnAt : this.gameT; }
  nearest(x, y, alive, maxR) {
    let best = null, bd = Infinity;
    const check = p => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } };
    if (this.arena) this.pHash.query(x, y, maxR, check); else alive.forEach(check);
    return best && bd <= maxR * maxR ? best : (this.arena ? null : best);
  }
  spawnEnemy(type, x, y, warm = 0.9, lvl = 0) {
    const T = TYPES[type];
    const e = { id: this.nid++, type, x, y, vx: 0, vy: 0, r: T.r, hue: T.hue, value: T.value, warm, rot: rand(0, TAU), a: rand(0, TAU), dead: false, stun: 0, phase: 'roam', pt: rand(1.2, 2.4), ax: 1, ay: 0, lvl, far: 0 };
    if (type === 'drifter') { const a = rand(0, TAU), s = rand(70, 130) + lvl * 90; e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s; }
    this.enemies.push(e);
    return e;
  }
  pickType(t) {
    const pool = [['seeker', 5], ['drifter', 4]];
    if (t > 12) pool.push(['bomb', 1.2]);
    if (t > 22) pool.push(['dasher', 2 + Math.min(2, (t - 22) / 30)]);
    if (t > 40) pool.push(['cutter', 1.5 + Math.min(1.5, (t - 40) / 40)]);
    let sum = 0; for (const p of pool) sum += p[1];
    let r = Math.random() * sum;
    for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
    return 'seeker';
  }
  spawnGroup(c, t, lvl) {
    const cnt = 3 + Math.floor(Math.random() * (3 + t / 40));
    const type = Math.random() < 0.55 ? 'drifter' : 'seeker';
    const a = rand(0, TAU), s = rand(60, 100);
    for (let i = 0; i < cnt; i++) {
      const e = this.spawnEnemy(type, clamp(c.x + rand(-45, 45), 20, this.w - 20), clamp(c.y + rand(-45, 45), 20, this.h - 20), 1.0 + i * 0.05, lvl);
      if (type === 'drifter') { e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s; }
    }
  }
  spawnPoint(minDist, alive) {
    for (let tries = 0; tries < 40; tries++) {
      const x = rand(40, this.w - 40), y = rand(60, this.h - 40);
      if (alive.every(p => Math.hypot(x - p.x, y - p.y) > minDist)) return { x, y };
    }
    return { x: rand(40, this.w - 40), y: rand(60, this.h - 40) };
  }
  spawnTick(dt, alive) {
    this.spawnT -= dt;
    const n = Math.max(1, alive.length), t = this.gameT;
    const cap = Math.min(60 + 15 * (n - 1), (7 + t / 4) * (1 + 0.6 * (n - 1)));
    if (this.spawnT > 0 || this.enemies.length >= cap) return;
    this.spawnT = Math.max(0.33, 1.5 - t * 0.011) * rand(0.7, 1.3) / (1 + 0.45 * (n - 1));
    const minDist = Math.min(this.w, this.h) * 0.3, lvl = Math.min(1, t / 150);
    if (Math.random() < 0.22 + Math.min(0.15, t / 600)) this.spawnGroup(this.spawnPoint(minDist, alive), t, lvl);
    else { const p = this.spawnPoint(minDist, alive); this.spawnEnemy(this.pickType(t), p.x, p.y, 0.9, lvl); }
    this.ev({ k: 'sp' });
  }
  // Arena: jedes Licht hat seinen eigenen Takt und Schwierigkeitsgrad; dichte Gegenden teilen sich die Obergrenze
  spawnTickArena(dt, alive) {
    for (const p of alive) {
      p.spawnT -= dt;
      if (p.spawnT > 0) continue;
      const t = this.level(p);
      p.spawnT = Math.max(0.45, 1.5 - t * 0.011) * rand(0.7, 1.3);
      let near = 0;
      this.eHash.query(p.x, p.y, 900, e => { if (Math.abs(e.x - p.x) < 900 && Math.abs(e.y - p.y) < 900) near++; });
      if (near >= Math.min(40, 7 + t / 4)) continue;
      let c = null;
      for (let tries = 0; tries < 12 && !c; tries++) {
        const a = rand(0, TAU), d = rand(480, 800);
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (x < 40 || y < 40 || x > this.w - 40 || y > this.h - 40) continue;
        let ok = true;
        this.pHash.query(x, y, 380, o => { if (Math.hypot(o.x - x, o.y - y) < 380) ok = false; });
        if (ok) c = { x, y };
      }
      if (!c) continue;
      const lvl = Math.min(1, t / 150);
      if (Math.random() < 0.22 + Math.min(0.15, t / 600)) this.spawnGroup(c, t, lvl);
      else this.spawnEnemy(this.pickType(t), c.x, c.y, 0.9, lvl);
    }
  }
  rebuildHashes() {
    this.pHash.clear();
    for (const p of this.players.values()) if (p.alive) this.pHash.insert(p);
    this.eHash.clear();
    for (const e of this.enemies) this.eHash.insert(e);
  }
  step(dt) {
    if (!this.running) return;
    this.gameT += dt;
    const alive = this.aliveList();
    this.rebuildHashes();
    if (this.arena) this.spawnTickArena(dt, alive);
    else if (alive.length) this.spawnTick(dt, alive);
    this.updateEnemies(dt, alive);
    this.updateGems(dt, alive);
    for (const p of alive) {
      if (p.mult > 1) {
        p.comboT -= dt;
        if (p.comboT <= 0) { p.mult--; p.comboT = 1.4; this.ev({ k: 'cl', id: p.id }); }
      }
    }
    if (this.arena) {
      this.collide(alive);
      this.despawnFar(dt);
    } else if (!alive.length) {
      this.endT += dt;
      if (this.endT > 1.6) { this.running = false; this.done = true; }
    }
  }
  updateEnemies(dt, alive) {
    const globalDiff = Math.min(1, this.gameT / 150), maxR = this.arena ? 1100 : Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.rot += dt * (e.type === 'cutter' ? 9 : 1.4);
      if (e.warm > 0) { e.warm -= dt; continue; }
      const diff = this.arena ? e.lvl : globalDiff;
      const tgt = this.nearest(e.x, e.y, alive, maxR);
      const dx = tgt ? tgt.x - e.x : 0, dy = tgt ? tgt.y - e.y : 0, d = Math.hypot(dx, dy) || 1;
      if (e.stun > 0) {
        e.stun -= dt; e.vx *= Math.pow(0.12, dt); e.vy *= Math.pow(0.12, dt);
      } else if (tgt) {
        switch (e.type) {
          case 'seeker': {
            const sp = 115 + diff * 120, acc = 260 + diff * 200;
            e.vx += dx / d * acc * dt; e.vy += dy / d * acc * dt;
            const v = Math.hypot(e.vx, e.vy); if (v > sp) { e.vx *= sp / v; e.vy *= sp / v; }
            break;
          }
          case 'drifter': {
            const v = Math.hypot(e.vx, e.vy), want = 80 + diff * 70;
            if (v < want) { e.vx *= 1 + dt; e.vy *= 1 + dt; }
            break;
          }
          case 'bomb': {
            e.vx += (dx / d * 45 - e.vx) * dt; e.vy += (dy / d * 45 - e.vy) * dt;
            break;
          }
          case 'cutter': {
            // Zielt auf den Schweif des nächsten Lichts, sonst auf das Licht
            let tx = tgt.x, ty = tgt.y;
            const tr = tgt.tr;
            if (tr.length > 16) { const i = Math.floor(tr.length * 0.2) * 2; tx = tr[i]; ty = tr[i + 1]; }
            const cx = tx - e.x, cy = ty - e.y, cd = Math.hypot(cx, cy) || 1, sp = 140 + diff * 80;
            e.vx += (cx / cd * sp - e.vx) * dt * 1.6; e.vy += (cy / cd * sp - e.vy) * dt * 1.6;
            break;
          }
          case 'dasher': {
            e.pt -= dt;
            if (e.phase === 'roam') {
              e.vx += (dx / d * 55 - e.vx) * dt * 2; e.vy += (dy / d * 55 - e.vy) * dt * 2;
              if (e.pt <= 0 && d < 700) { e.phase = 'aim'; e.pt = 0.65; e.ax = dx / d; e.ay = dy / d; }
            } else if (e.phase === 'aim') {
              e.vx *= Math.pow(0.02, dt); e.vy *= Math.pow(0.02, dt);
              if (e.pt > 0.2) { e.ax = dx / d; e.ay = dy / d; }
              if (e.pt <= 0) { e.phase = 'dash'; e.pt = 0.38; const s = 640 + diff * 220; e.vx = e.ax * s; e.vy = e.ay * s; }
            } else if (e.pt <= 0) { e.phase = 'roam'; e.pt = rand(1.4, 2.4); }
            break;
          }
        }
      } else { e.vx *= Math.pow(0.5, dt); e.vy *= Math.pow(0.5, dt); }
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); }
      if (e.x > this.w - e.r) { e.x = this.w - e.r; e.vx = -Math.abs(e.vx); }
      if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy); }
      if (e.y > this.h - e.r) { e.y = this.h - e.r; e.vy = -Math.abs(e.vy); }
      e.a = e.type === 'dasher' && e.phase === 'aim' ? Math.atan2(e.ay, e.ax) : (Math.hypot(e.vx, e.vy) > 5 ? Math.atan2(e.vy, e.vx) : e.a);
    }
    // Leichte Abstoßung untereinander, damit Schwärme nicht verschmelzen
    this.eHash.clear();
    for (const e of this.enemies) if (!e.dead) this.eHash.insert(e);
    for (const a of this.enemies) {
      if (a.warm > 0 || a.dead) continue;
      this.eHash.query(a.x, a.y, a.r + 20, b => {
        if (b.id <= a.id || b.warm > 0) return;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5;
          a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push;
        }
      });
    }
    this.enemies = this.enemies.filter(e => !e.dead);
  }
  updateGems(dt, alive) {
    for (const g of this.gems) {
      g.life -= dt;
      if (g.life <= 0) { g.dead = true; continue; }
      const p = this.nearest(g.x, g.y, alive, 150);
      if (p) {
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
        if (d < 150) { const f = (1 - d / 150) * 2400; g.vx += dx / d * f * dt; g.vy += dy / d * f * dt; }
        if (d < 18) {
          g.dead = true; p.score += 5 * p.mult; p.energy = Math.min(1, p.energy + 0.015);
          this.ev({ k: 'g', id: p.id, x: Math.round(g.x), y: Math.round(g.y) });
          continue;
        }
      }
      g.vx *= Math.pow(0.15, dt); g.vy *= Math.pow(0.15, dt);
      g.x += g.vx * dt; g.y += g.vy * dt;
    }
    this.gems = this.gems.filter(g => !g.dead);
  }
  // Arena: der Server prüft Berührungen selbst (mit etwas Spielraum zugunsten der Spieler)
  collide(alive) {
    for (const p of alive) {
      let hit = null;
      this.eHash.query(p.x, p.y, 40, e => { if (!hit && !e.dead && e.warm <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + PLAYER_R - 6) hit = e; });
      if (hit) this.killPlayer(p);
    }
  }
  despawnFar(dt) {
    this.farT += dt;
    if (this.farT < 1) return;
    this.farT = 0;
    for (const e of this.enemies) {
      let near = false;
      this.pHash.query(e.x, e.y, 1600, () => { near = true; });
      e.far = near ? 0 : e.far + 1;
      if (e.far > 6) e.dead = true;
    }
    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.gems.length > 3000) this.gems.splice(0, this.gems.length - 3000);
  }
  killPlayer(p, x, y) {
    if (!p.alive) return;
    p.alive = false; p.time = this.level(p); p.tr = [];
    if (typeof x === 'number' && typeof y === 'number') { p.x = x; p.y = y; }
    this.ev({ k: 'd', id: p.id, x: Math.round(p.x), y: Math.round(p.y), h: p.hue });
    this.deaths.push(p.id);
  }
  loopHue(p) { return this.solo ? Math.round((190 + this.gameT * 25 + 140) % 360) : p.hue; }
  handle(id, m) {
    const p = this.players.get(id);
    if (!p || !this.running || !m) return;
    if (m.t === 'p') { if (p.alive) this.move(p, m); }
    else if (m.t === 'loop' && p.alive && Array.isArray(m.poly)) this.resolveLoop(p, unflat(m.poly));
    else if (m.t === 'pulse' && p.alive) this.pulse(p);
    else if (m.t === 'die') this.killPlayer(p, m.x, m.y);
  }
  move(p, m) {
    let x = +m.x, y = +m.y;
    if (!isFinite(x) || !isFinite(y)) return;
    x = clamp(x, PLAYER_R, this.w - PLAYER_R); y = clamp(y, PLAYER_R, this.h - PLAYER_R);
    if (this.arena) {
      // Gegen Teleportieren: höchstens etwas schneller als das Licht fliegen kann
      const maxStep = 1700 * (this.gameT - p.lastPT) + 60, d = Math.hypot(x - p.x, y - p.y);
      if (d > maxStep) { x = p.x + (x - p.x) / d * maxStep; y = p.y + (y - p.y) / d * maxStep; }
      p.lastPT = this.gameT;
    }
    p.x = x; p.y = y;
    p.tr = Array.isArray(m.tr) ? m.tr.slice(0, 160).map(v => +v || 0) : [];
  }
  resolveLoop(p, poly) {
    if (poly.length < 3 || poly.length > 400 || polyArea(poly) < 600) return;
    const bb = bounds(poly);
    if (this.arena && (bb.x1 - bb.x0 > 1400 || bb.y1 - bb.y0 > 1400 || Math.hypot((bb.x0 + bb.x1) / 2 - p.x, (bb.y0 + bb.y1) / 2 - p.y) > 1400)) return;
    const c = centroid(poly), caught = [];
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, rr = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + 40;
    this.eHash.query(cx, cy, rr, e => { if (!e.dead && e.warm <= 0 && inPoly(e.x, e.y, poly)) { e.dead = true; caught.push(e); } });
    // Bomben reißen Nachbarn mit
    for (let i = 0; i < caught.length; i++) {
      const b = caught[i];
      if (b.type !== 'bomb') continue;
      this.ev({ k: 'b', x: Math.round(b.x), y: Math.round(b.y) });
      this.eHash.query(b.x, b.y, BOMB_R + 40, e => { if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < BOMB_R + e.r) { e.dead = true; caught.push(e); } });
    }
    let gemCount = 0;
    for (const g of this.gems) if (!g.dead && g.x >= bb.x0 && g.x <= bb.x1 && g.y >= bb.y0 && g.y <= bb.y1 && inPoly(g.x, g.y, poly)) { g.dead = true; gemCount++; }
    // Andere Lichter in der Schlinge verlieren ihre Kette
    for (const o of this.players.values()) {
      if (o === p || !o.alive || o.x < bb.x0 || o.x > bb.x1 || o.y < bb.y0 || o.y > bb.y1 || !inPoly(o.x, o.y, poly)) continue;
      const bonus = 25 * p.mult * Math.max(1, o.mult);
      p.score += bonus; p.steals++;
      o.mult = 1; o.comboT = 0;
      this.ev({ k: 'pv', id: o.id, by: p.id, x: Math.round(o.x), y: Math.round(o.y), bonus });
    }
    const n = caught.length, m0 = p.mult;
    p.loops++;
    let gain = gemCount * 5 * p.mult, label = '';
    if (n > 0) {
      let base = 0; for (const e of caught) base += e.value;
      gain += Math.round(base * p.mult * (1 + 0.5 * (n - 1)));
      p.kills += n; p.catch = Math.max(p.catch, n);
      label = n >= 8 ? 'SUPERNOVA' : n >= 6 ? 'GEWALTIG' : ['', '', 'DOPPELT', 'DREIFACH', 'VIERFACH', 'FÜNFFACH'][n];
      p.mult += n >= 3 ? 2 : 1; p.multMax = Math.max(p.multMax, p.mult); p.comboT = COMBO_T;
      p.energy = Math.min(1, p.energy + 0.1 + n * 0.08);
      for (const e of caught) {
        this.ev({ k: 'k', x: Math.round(e.x), y: Math.round(e.y), h: e.hue, b: e.type === 'bomb' ? 1 : 0, r: e.r });
        const cnt = e.type === 'bomb' ? 4 : e.type === 'drifter' ? 1 : 2;
        for (let i = 0; i < cnt; i++) {
          const a = rand(0, TAU), s = rand(40, 140);
          this.gems.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 7, dead: false });
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);
    }
    p.score += gain;
    this.ev({ k: 'l', id: p.id, poly: flat(poly), cx: Math.round(c.x), cy: Math.round(c.y), n, gain, label, m: m0, h: this.loopHue(p) });
  }
  pulse(p) {
    if (p.energy < 1) return;
    p.energy = 0;
    this.eHash.query(p.x, p.y, PULSE_R + 30, e => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < PULSE_R + e.r) {
        const f = 520 * (1 - d / (PULSE_R + e.r)) + 260;
        e.vx = dx / d * f; e.vy = dy / d * f; e.stun = 0.9;
        if (e.type === 'dasher') { e.phase = 'roam'; e.pt = rand(1.2, 2); }
      }
    });
    this.ev({ k: 'pu', id: p.id, x: Math.round(p.x), y: Math.round(p.y) });
  }
  resultOf(p) {
    return { id: p.id, name: p.name, hue: p.hue, score: p.score, multMax: p.multMax, kills: p.kills, loops: p.loops, catch: p.catch, steals: p.steals, time: p.alive ? this.level(p) : p.time };
  }
  results() { return [...this.players.values()].map(p => this.resultOf(p)).sort((a, b) => b.score - a.score); }
  enemyTuple(out, x) { out.push(x.id, TYPE_KEYS.indexOf(x.type), Math.round(x.x), Math.round(x.y), Math.round(x.a * 100), x.warm > 0 ? Math.round(x.warm * 100) : 0, x.stun > 0 ? 1 : 0, PHASES.indexOf(x.phase), Math.round(x.pt * 100)); }
  playerTuple(x, withName, tr) {
    const t = [x.id, Math.round(x.x), Math.round(x.y), x.alive ? 1 : 0, x.score, x.mult, Math.round(x.energy * 100), x.mult > 1 ? Math.round(clamp(x.comboT / COMBO_T, 0, 1) * 100) : 0, tr === undefined ? x.tr : tr];
    if (withName) t.push(x.hue, x.name);
    return t;
  }
  snapshot() {
    const e = [], g = [], p = [];
    for (const x of this.enemies) this.enemyTuple(e, x);
    for (const x of this.gems) g.push(Math.round(x.x), Math.round(x.y), Math.round(x.life * 10));
    for (const x of this.players.values()) p.push(this.playerTuple(x, false));
    return { t: 's', gt: Math.round(this.gameT * 100) / 100, e, g, p };
  }
  // Arena: nur, was im Blickfeld eines Lichts liegt
  snapshotFor(me, vw, vh) {
    const hw = vw / 2 + 120, hh = vh / 2 + 120, cx = me.x, cy = me.y;
    const inRect = (x, y) => Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh;
    const e = [], g = [], p = [];
    this.eHash.query(cx, cy, Math.max(hw, hh), x => { if (!x.dead && inRect(x.x, x.y)) this.enemyTuple(e, x); });
    for (const x of this.gems) if (inRect(x.x, x.y)) g.push(Math.round(x.x), Math.round(x.y), Math.round(x.life * 10));
    // Den eigenen Schweif kennt der Browser selbst; fremde Schweife reichen grob
    for (const x of this.players.values()) if (x === me || (x.alive && inRect(x.x, x.y))) p.push(this.playerTuple(x, true, x === me ? [] : thinTrail(x.tr, 18)));
    return { t: 's', gt: Math.round(this.level(me) * 100) / 100, e, g, p };
  }
  leaderboard() {
    const list = this.aliveList().sort((a, b) => b.score - a.score);
    return { top: list.slice(0, 10).map(p => [p.id, p.name, p.hue, p.score, Math.round(p.x), Math.round(p.y)]), n: this.players.size, alive: list.length, rank: new Map(list.map((p, i) => [p.id, i + 1])) };
  }
}

const api = { TAU, rand, clamp, TYPES, TYPE_KEYS, PHASES, PLAYER_HUES, ARENA_HUES, COMBO_T, TRAIL_LIFE, BOMB_R, PULSE_R, PLAYER_R, trailMax, thinTrail, segInter, segDist, inPoly, polyArea, centroid, bounds, flat, unflat, Hash, World };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LS = api;
})(typeof window !== 'undefined' ? window : globalThis);
