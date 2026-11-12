// Проверка новых систем: эвакуатор, толкание, фургон, станок, миграция сейва v2.
const path = require('path');
for (const f of ['util', 'data', 'map', 'car', 'sim', 'pawns', 'orders', 'market', 'events']) require(path.join(__dirname, '..', 'js', f + '.js'));
const WW = globalThis.WW, { G, O, P, M, C, D, N } = WW;
const cnt = { towIn: 0, towOut: 0, van: 0, push: 0, late: 0 };
const _tow = G.tow, _van = G.van, _sp = G.startPush;
G.tow = (c, m, d) => { cnt[m === 'in' ? 'towIn' : 'towOut']++; return _tow(c, m, d); };
G.van = (c, s) => { cnt.van++; return _van(c, s); }; G.startPush = c => { if (c.push && !(c.mv && c.mv.push)) cnt.push++; return _sp(c); };
G.newGame('legacy', 777); const S = WW.S; S.set.tut = false; P.hire(S.cands.find(c => c.role === 'mech').id);
function day() { while (S.phase === 'day') { for (const id in S.orders) { const o = S.orders[id]; if (o.type !== 'own' && o.stage === 'diag' && o.decide) O.autoEstimate(o); } G.step(1); for (const sid in S.slotCar) { const c = S.cars[S.slotCar[sid]]; if (!c) throw new Error('slot ' + sid + ' -> нет машины'); } } if (S.phase === 'race') { M.raceSim(); M.raceFinish(); } }
for (let d = 0; d < 25; d++) { S.set.due = ['opt', 'norm', 'pess', 'custom'][d % 4]; S.set.duePct = 130; day(); if (S.phase !== 'summary') throw new Error('фаза ' + S.phase); G.nextDay(); }
console.log('25 дней:', JSON.stringify(cnt), 'нарядов', S.stats.orders, 'касса', Math.round(S.money), 'машин на участке без места:', Object.values(S.cars).filter(c => c.lot && !c.slot && !c.mv).length);
if (!cnt.towIn || !cnt.van || !cnt.push) throw new Error('не все системы сработали');
// миграция: превращаем состояние в формат v2 и загружаем
const j = JSON.parse(G.save()); const legacy = D.MAP.slots, byKind = {}; for (const s of N.slots()) (byKind[s.kind] = byKind[s.kind] || []).push(s.id);
const back = {}; for (const k in byKind) byKind[k].forEach((id, i) => { const l = legacy.filter(x => x.kind === k && !x.upg)[i]; if (l) back[id] = l.id; });
j.v = 2; delete j.map; delete j.parts; delete j.bench; delete j.junk; delete j.veh; delete j.runs; const sc = {}; for (const id in j.slotCar) if (back[id]) sc[back[id]] = j.slotCar[id]; j.slotCar = sc;
for (const id in j.cars) { const c = j.cars[id]; c.slot = c.slot ? (back[c.slot] || null) : null; delete c.lot; c.mv = null; c.push = null; }
for (const p of j.pawns.concat(j.cands)) { p.pri = { desk: p.pri.desk, diag: p.pri.diag, mech: p.pri.eng, body: p.pri.body }; delete p.spec; }
j.upg.bay3 = true; j.upg.waiting = true;
if (!G.load(JSON.stringify(j))) throw new Error('миграция не загрузилась');
const S2 = WW.S; console.log('миграция v2→v3: боксов', N.slots().filter(s => s.kind === 'bay').length, 'зона ожидания', N.has('chairs'), 'машин с местом', Object.values(S2.cars).filter(c => c.slot).length, 'спецы', S2.pawns.map(p => p.spec).join(','));
for (let d = 0; d < 5; d++) { while (WW.S.phase === 'day') { for (const id in WW.S.orders) { const o = WW.S.orders[id]; if (o.type !== 'own' && o.stage === 'diag' && o.decide) O.autoEstimate(o); } G.step(1); } if (WW.S.phase === 'race') { M.raceSim(); M.raceFinish(); } G.nextDay(); }
console.log('после миграции отыграно 5 дней, нарядов', WW.S.stats.orders, '— OK');
