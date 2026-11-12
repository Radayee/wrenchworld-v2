// WRENCHWORLD — карта как данные: стены и крыша по тайлам, объекты, места под машины, пути людей и машин, стройка.
(function (WW) {
  const U = WW.U, D = WW.D, MAP = D.MAP, N = WW.N = {};
  const W = MAP.W, H = MAP.H, I = (x, y) => y * W + x;
  let cache = null; // {S, ver, slots, walk, car}
  N.dirty = () => { cache = null; };
  const DIR = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // r: куда открыто место (откуда заезжают)
  const SW = 2.6, SL = 5.6; // габарит места

  // стартовая планировка «Заправка Попса» — из старой фиксированной карты
  N.mk = function (upg) {
    upg = upg || {};
    const m = { ver: 1, walls: {}, roof: {}, objs: [], nid: 1 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D.blocked(x, y, upg)) m.walls[I(x, y)] = 1;
    for (let y = 2; y <= 10; y++) for (let x = 3; x <= 33; x++) if (upg.bay3 || x < 21 || x > 25) m.roof[I(x, y)] = 1;
    const add = (t, x, y, r) => m.objs.push({ id: m.nid++, t, x, y, r: r || 0 });
    add('lift', 11.5, 6.5, 0); add('lift', 17.5, 6.5, 0); if (upg.bay3) add('lift', 23.5, 6.5, 0); if (upg.bay4) add('lift', 19.5, 17.5, 2);
    for (const x of [35.6, 38.3, 41.0, 43.7]) add('yard', x, 6.2, 0);
    for (const x of [37, 39.8, 42.6]) add('park', x, 17.6, 2);
    for (const x of [3.6, 6.4, 9.2].concat(upg.lot2 ? [12.0] : [])) add('proj', x, 16.4, 2);
    for (const x of [3.6, 6.4, 9.2].concat(upg.lot2 ? [12.0] : [])) add('sale', x, 22.3, 0);
    add('shelf', 4.4, 4.0); add('shelf', 4.4, 6.2); add('shelf', 4.4, 8.4); add('shelf', 7.6, 4.0); add('shelf', 7.6, 8.4);
    add('desk', 30.4, 5.5); add('toolbox', 13.4, 3.6); add('toolbox', 19.4, 3.6);
    add('b_chassis', 9.5, 5, 1); add('b_elec', 15.5, 5, 1);
    if (upg.waiting) add('chairs', 32.5, 8); if (upg.rest) add('sofa', 28, 3.5);
    return m;
  };
  const M = () => WW.S.map;
  N.def = o => D.build[o.t];
  // прямоугольник объекта [x0,y0,x1,y1]
  N.rect = function (t, x, y, r) {
    const d = D.build[t]; let w, h;
    if (d.slot) { w = SW; h = SL; } else { w = d.w || 1; h = d.h || 1; }
    if (r % 2) { const q = w; w = h; h = q; }
    return [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
  };
  function get() {
    const S = WW.S; if (cache && cache.S === S && cache.ver === S.map.ver) return cache;
    const m = S.map, slots = []; let nb = 0;
    for (const o of m.objs) {
      const d = D.build[o.t]; if (!d.slot) continue;
      const v = DIR[o.r || 0];
      slots.push({ id: 's' + o.id, obj: o.id, kind: d.slot, x: o.x, y: o.y, ang: Math.atan2(-v[1], -v[0]), ax: o.x + v[0] * 4.3, ay: o.y + v[1] * 4.3, r: o.r || 0, n: d.slot === 'bay' ? 'Бокс ' + (++nb) : null, indoor: !!m.roof[I(Math.floor(o.x), Math.floor(o.y))], rect: N.rect(o.t, o.x, o.y, o.r || 0) });
    }
    const walk = new Uint8Array(W * H), car = new Uint8Array(W * H);
    for (const k in m.walls) { const i = +k, x = i % W, y = Math.floor(i / W); walk[i] = 1; car[i] = 3; for (const v of DIR) { const nx = x + v[0], ny = y + v[1]; if (nx >= 0 && ny >= 0 && nx < W && ny < H) car[I(nx, ny)] = Math.max(car[I(nx, ny)], 1); } }
    for (const s of slots) { const r = s.rect; for (let y = Math.floor(r[1] + .2); y <= Math.floor(r[3] - .2); y++) for (let x = Math.floor(r[0] + .2); x <= Math.floor(r[2] - .2); x++) if (x >= 0 && y >= 0 && x < W && y < H) car[I(x, y)] = Math.max(car[I(x, y)], 2); }
    cache = { S, ver: m.ver, slots, walk, car }; return cache;
  }
  N.slots = () => get().slots;
  N.slot = id => get().slots.find(s => s.id === id);
  N.has = t => M().objs.some(o => o.t === t);
  N.objs = t => M().objs.filter(o => o.t === t);
  N.indoor = (x, y) => !!M().roof[I(Math.floor(x), Math.floor(y))];
  N.wall = (x, y) => !!M().walls[I(x, y)];
  N.bench = function (sk, x, y) { const l = N.objs(D.benchOf(sk)); if (!l.length) return null; if (x == null) return l[0]; return l.slice().sort((a, b) => U.dist(a.x, a.y, x, y) - U.dist(b.x, b.y, x, y))[0]; };
  N.nearTool = (x, y) => N.objs('toolbox').some(o => U.dist(o.x, o.y, x, y) <= 5.5);

  // ---------- точки, куда ходят люди ----------
  function freeNear(x, y) { const g = get().walk; for (const d of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [2, 0], [-2, 0], [0, -2]]) { const tx = Math.floor(x + d[0]), ty = Math.floor(y + d[1]); if (tx >= 0 && ty >= 0 && tx < W && ty < H && !g[I(tx, ty)]) return [tx + .5, ty + .5]; } return [x, y]; }
  N.spot = function (name, x, y, k) {
    const desk = N.objs('desk')[0];
    if (name === 'desk') return desk ? [desk.x, desk.y - 1.1] : MAP.spots.gate.slice();
    if (name === 'client') return desk ? [desk.x + ((k || 0) % 3 - 1) * .5, desk.y + 1.3] : [MAP.spots.gate[0] + 1, MAP.spots.gate[1] - 1];
    if (name === 'chair') { const c = N.objs('chairs')[0]; if (c) return [c.x - .1, c.y + ((k || 0) % 3 - 1) * .9]; return desk ? [desk.x + 1.6 + (k || 0) % 2 * .7, desk.y + 2.6] : MAP.spots.gate.slice(); }
    if (name === 'rest') { const s = N.objs('sofa')[0]; if (s) return freeNear(s.x + ((k || 0) % 3 - 1) * .7, s.y + 1); return desk ? freeNear(desk.x - 2.6 + (k || 0) % 3 * .8, desk.y - 1.6) : MAP.spots.gate.slice(); }
    if (name === 'store') { const l = N.objs('shelf'); if (!l.length) return N.spot('desk'); const s = l.slice().sort((a, b) => U.dist(a.x, a.y, x, y) - U.dist(b.x, b.y, x, y))[0]; const g = get().walk; for (const dx of [1, -1]) { const tx = Math.floor(s.x + dx), ty = Math.floor(s.y); if (!g[I(tx, ty)]) return [tx + .5, ty + .5 + ((k || 0) % 2) * .4 - .2]; } return freeNear(s.x, s.y + 1.5); }
    if (name === 'bench') { const b = N.bench(k, x, y); return b ? freeNear(b.x + ((b.r || 0) % 2 ? 1 : 0), b.y + ((b.r || 0) % 2 ? 0 : 1)) : N.spot('store', x, y); }
    return MAP.spots.gate.slice();
  };

  // ---------- A* ----------
  function astar(g, sx, sy, tx, ty, lim) {
    const Nn = W * H, gs = new Float32Array(Nn).fill(1e9), from = new Int32Array(Nn).fill(-1), closed = new Uint8Array(Nn), open = [];
    const s = I(sx, sy), t = I(tx, ty); gs[s] = 0; open.push(s);
    const h = i => { const dx = Math.abs(i % W - tx), dy = Math.abs(Math.floor(i / W) - ty); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
    let found = false;
    while (open.length) {
      let bi = 0, bf = 1e9; for (let i = 0; i < open.length; i++) { const f = gs[open[i]] + h(open[i]); if (f < bf) { bf = f; bi = i; } }
      const cur = open.splice(bi, 1)[0]; if (cur === t) { found = true; break; }
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cy = Math.floor(cur / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = I(nx, ny); if ((g[ni] > lim && ni !== t) || closed[ni]) continue;
        if (dx && dy && (g[I(nx, cy)] > lim || g[I(cx, ny)] > lim)) continue;
        const ng = gs[cur] + (dx && dy ? 1.414 : 1) + (g[ni] ? 6 : 0); if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; open.push(ni); }
      }
    }
    if (!found) return null;
    const pts = []; let c = from[t]; while (c !== -1 && c !== s) { pts.push([c % W + .5, Math.floor(c / W) + .5]); c = from[c]; }
    return pts.reverse();
  }
  const cl = (v, m) => U.clamp(Math.floor(v), 0, m - 1);
  N.path = function (ax, ay, bx, by) {
    const g = get().walk, sx = cl(ax, W), sy = cl(ay, H), tx = cl(bx, W), ty = cl(by, H);
    if (sx === tx && sy === ty) return [[bx, by]];
    const p = astar(g, sx, sy, tx, ty, 0); if (!p) return [[bx, by]];
    p.push([bx, by]); return p;
  };
  function los(g, a, b, lim) { const d = U.dist(a[0], a[1], b[0], b[1]), n = Math.ceil(d / .35); for (let i = 1; i < n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; if (x < 0 || y < 0 || x >= W || y >= H) continue; if (g[I(Math.floor(x), Math.floor(y))] > lim) return false; } return true; }
  // путь машины: стены раздуты на клетку, чужие места объезжаются
  N.carPath = function (ax, ay, bx, by) {
    const g = get().car, sx = cl(ax, W), sy = cl(ay, H), tx = cl(bx, W), ty = cl(by, H);
    let p = (sx === tx && sy === ty) ? [] : (astar(g, sx, sy, tx, ty, 0) || astar(g, sx, sy, tx, ty, 1) || astar(g, sx, sy, tx, ty, 2) || []);
    const pts = [[ax, ay]].concat(p, [[bx, by]]), out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(g, pts[i], pts[j], 0)) j--; out.push(pts[j]); i = j; }
    return out.slice(1);
  };
  // полный маршрут: из места → подъезд → … → подъезд цели → место
  N.route = function (x, y, fromSlot, dest) {
    const pts = []; let sx = x, sy = y;
    if (fromSlot) { const s = N.slot(fromSlot); if (s) { pts.push([s.ax, s.ay]); sx = s.ax; sy = s.ay; } }
    else if (x > W) { pts.push([W - 1.5, MAP.roadY]); sx = W - 1.5; sy = MAP.roadY; }
    if (dest === 'exit') { for (const p of N.carPath(sx, sy, 1.5, MAP.roadY)) pts.push(p); pts.push([-6, MAP.roadY]); }
    else { const d = N.slot(dest); for (const p of N.carPath(sx, sy, d.ax, d.ay)) pts.push(p); pts.push([d.x, d.y]); }
    return pts;
  };
  N.roadIn = () => [W + 4, MAP.roadY];

  // ---------- стройка ----------
  const hit = (a, b) => a[0] < b[2] - .05 && a[2] > b[0] + .05 && a[1] < b[3] - .05 && a[3] > b[1] + .05;
  N.objAt = function (x, y) { const m = M(); for (let i = m.objs.length - 1; i >= 0; i--) { const o = m.objs[i], r = N.rect(o.t, o.x, o.y, o.r || 0); if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return o; } return null; };
  N.snap = function (t, x, y, r) { const d = D.build[t]; if (d.paint) return [Math.floor(x), Math.floor(y)]; let w = d.slot ? 3 : (d.w || 1), h = d.slot ? 6 : (d.h || 1); if (r % 2) { const q = w; w = h; h = q; } return [w % 2 ? Math.floor(x) + .5 : Math.round(x), h % 2 ? Math.floor(y) + .5 : Math.round(y)]; };
  N.canPlace = function (t, x, y, r) {
    const S = WW.S, m = M(), d = D.build[t]; r = r || 0;
    if (d.paint) {
      if (x < 1 || y < 1 || x > W - 2 || y > 25) return 'за границей участка';
      if (t === 'wall') { if (m.walls[I(x, y)]) return 'здесь уже стена'; for (const o of m.objs) { const q = N.rect(o.t, o.x, o.y, o.r || 0); if (hit([x, y, x + 1, y + 1], q)) return 'мешает объект'; } for (const s of N.slots()) if (Math.floor(s.ax) === x && Math.floor(s.ay) === y) return 'перекроет заезд'; for (const id in S.cars) { const c = S.cars[id]; if ((c.slot || c.mv) && Math.abs(c.x - x - .5) < 1.6 && Math.abs(c.y - y - .5) < 1.6) return 'здесь машина'; } }
      if (t === 'roof' && m.roof[I(x, y)]) return 'здесь уже крыша';
      return '';
    }
    const q = N.rect(t, x, y, r);
    if (q[0] < .4 || q[1] < .8 || q[2] > W - .4 || q[3] > 26.2) return 'за границей участка';
    for (let ty = Math.floor(q[1] + .05); ty <= Math.floor(q[3] - .05); ty++) for (let tx = Math.floor(q[0] + .05); tx <= Math.floor(q[2] - .05); tx++) if (m.walls[I(tx, ty)]) return 'мешает стена';
    for (const o of m.objs) if (hit(q, N.rect(o.t, o.x, o.y, o.r || 0))) return 'место занято';
    if (d.slot) { const v = DIR[r], ax = x + v[0] * 4.3, ay = y + v[1] * 4.3; if (ax < .5 || ay < .5 || ax > W - .5 || ay > 27.5) return 'заезд за границей участка'; if (m.walls[I(Math.floor(ax), Math.floor(ay))]) return 'заезд упирается в стену'; for (const s of N.slots()) if (ax > s.rect[0] && ax < s.rect[2] && ay > s.rect[1] && ay < s.rect[3]) return 'заезд через чужое место'; for (const s of N.slots()) if (s.ax > q[0] && s.ax < q[2] && s.ay > q[1] && s.ay < q[3]) return 'перекроет чужой заезд'; }
    return '';
  };
  N.cost = t => Math.round(D.build[t].cost * WW.G.px() / (D.build[t].paint ? 1 : 5)) * (D.build[t].paint ? 1 : 5);
  function sync() { const S = WW.S; S.map.ver++; cache = null; S.upg.waiting = N.has('chairs'); S.upg.rest = N.has('sofa'); WW.emit('mapchange'); }
  N.place = function (t, x, y, r) {
    const S = WW.S, m = M(), why = N.canPlace(t, x, y, r); if (why) return why;
    const c = N.cost(t); if (S.money < c) return 'не хватает денег';
    WW.G.money(-c, 'upgrade');
    if (t === 'wall') m.walls[I(x, y)] = 1; else if (t === 'roof') m.roof[I(x, y)] = 1; else m.objs.push({ id: m.nid++, t, x, y, r: r || 0 });
    sync(); return '';
  };
  // снос: объект под курсором, иначе стена, иначе крыша; возврат 50%
  N.removeAt = function (x, y) {
    const S = WW.S, m = M(), o = N.objAt(x, y), G = WW.G;
    if (o) {
      const d = D.build[o.t];
      if (d.slot) { const sid = 's' + o.id; if (S.slotCar[sid]) return 'место занято или забронировано машиной'; if (d.slot === 'bay' && N.slots().filter(s => s.kind === 'bay').length <= 1) return 'последний пост сносить нельзя'; }
      if (o.t === 'desk' && N.objs('desk').length <= 1) return 'нужна хотя бы одна стойка';
      if (d.bench && S.bench && S.bench.some(b => b.sk === d.bench && b.status === 'doing')) return 'на станке идёт работа';
      m.objs = m.objs.filter(q => q !== o); G.money(Math.round(N.cost(o.t) * .5), 'upgrade'); sync(); return '';
    }
    const tx = Math.floor(x), ty = Math.floor(y), i = I(tx, ty);
    if (m.walls[i]) { delete m.walls[i]; sync(); return ''; }
    if (m.roof[i]) { delete m.roof[i]; sync(); return ''; }
    return 'здесь нечего сносить';
  };
  // старые сейвы (v2): построить карту из купленных апгрейдов и пересадить машины
  N.migrate = function (S) {
    const old = D.MAP.slots, m = S.map = N.mk(S.upg); cache = null;
    const byKind = {}; for (const s of old) { if (s.upg && !S.upg[s.upg]) continue; (byKind[s.kind] = byKind[s.kind] || []).push(s.id); }
    const fresh = {}; for (const s of N.slots()) (fresh[s.kind] = fresh[s.kind] || []).push(s.id);
    const map = {}; for (const k in byKind) byKind[k].forEach((id, i) => { map[id] = fresh[k][i]; });
    const sc = {}; for (const id in S.slotCar) if (map[id]) sc[map[id]] = S.slotCar[id]; S.slotCar = sc;
    for (const id in S.cars) { const c = S.cars[id]; if (c.slot) { c.slot = map[c.slot] || null; if (c.slot) { const s = N.slot(c.slot); c.x = s.x; c.y = s.y; c.ang = s.ang; } } if (c.dest && c.dest !== 'exit') c.dest = map[c.dest] || c.dest; if (c.mv) { c.mv = null; if (c.dest === 'exit') delete S.cars[id]; else if (c.dest && N.slot(c.dest)) { const s = N.slot(c.dest); c.slot = c.dest; c.dest = null; c.x = s.x; c.y = s.y; c.ang = s.ang; S.slotCar[c.slot] = c.id; } } }
    // машины, оставшиеся без места: клиентские с нарядом и свои — ставим на свободное, прочие убираем
    const free = kinds => { for (const k of kinds) for (const s of N.slots()) if (s.kind === k && !S.slotCar[s.id]) return s; return null; };
    for (const id in S.cars) {
      const c = S.cars[id]; c.dest = null; c.push = null;
      if (!c.slot && !c.away && (c.owner === 'player' || c.owner === 'client')) {
        const o = c.order && S.orders[c.order], s = (c.owner === 'player' || o) ? free(c.owner === 'player' ? ['proj', 'yard', 'park'] : ['park', 'yard', 'proj']) : null;
        if (s) { c.slot = s.id; S.slotCar[s.id] = c.id; c.x = s.x; c.y = s.y; c.ang = s.ang; if (o) o.arrived = true; }
        else { if (o) delete S.orders[c.order]; if (c.owner === 'client') delete S.cars[id]; }
      }
      if (S.cars[id]) c.lot = !!c.slot;
    }
    delete S.upg.bay3; delete S.upg.bay4; delete S.upg.lot2;
  };
})(globalThis.WW);
