const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js'), P = require('./progression.js'), W = require('./world.js');
const make = () => P.createRun(P.freshProgress(), P.defaultBuild(), () => .5);
function fight(run, encounter) {
  const b = P.battleFor(run, encounter, () => .99);
  for (let i = 0; i < 2400 && b.phase === 'fighting'; i++) {
    if (!b.player.cast) {
      const choices = b.charge >= 12 ? ['nova', 'quick', 'fire', 'heavy'] : ['quick', 'fire', 'heavy'];
      for (const id of choices) if (b.choose(id).ok) break;
    }
    b.advance(.05);
  }
  return b;
}
test('永久資料與本局配置、招式等級完全分離', () => { const p = P.freshProgress(), r = P.createRun(p); r.moveLevels.fire = 8; r.build.moves.pop(); assert.equal(p.moves.fire, 1); assert.equal(P.createRun(p).moveLevels.fire, 1); assert.equal(P.defaultBuild().moves.length, 2); });
test('重複招式永久最高 3、本局無上限且收益遞減', () => { const p = P.freshProgress(), r = P.createRun(p); for (let i = 0; i < 30; i++) P.acquireMove(p, r, 'fire'); assert.equal(p.moves.fire, 3); assert.equal(r.moveLevels.fire, 31); assert.ok(P.moveScale(31) > P.moveScale(30)); assert.ok(P.moveScale(4) - P.moveScale(3) < P.moveScale(3) - P.moveScale(2)); assert.ok(P.moveScale(21) - P.moveScale(20) < P.moveScale(11) - P.moveScale(10)); });
test('魔法書必須擁有且滿足永久等級才能理解', () => { const p = P.freshProgress(), r = P.createRun(p); r.moveLevels.fire = 99; assert.equal(P.understandBook(p, r, 'inferno'), false); p.books.push('inferno'); assert.equal(P.understandBook(p, r, 'inferno'), false); p.moves.fire = 3; assert.equal(P.understandBook(p, r, 'inferno'), true); assert.equal(p.moves.inferno, 1); P.understandBook(p, r, 'inferno'); assert.equal(p.moves.inferno, 1); });
test('儲存重讀、毀損資料與無權存取均有處理', () => { let raw; const storage = { getItem: () => raw, setItem: (_, v) => { raw = v; } }; const p = P.freshProgress(); p.moves.fire = 3; p.books.push('inferno'); assert.equal(P.saveProgress(storage, p), true); assert.equal(P.loadProgress(storage).progress.moves.fire, 3); raw = '{oops'; assert.ok(P.loadProgress(storage).warning); assert.equal(P.saveProgress({ setItem() { throw Error('denied'); } }, p), false); });
test('EXP 等級差符合設定節點且平滑內插', () => { for (const [gap, value] of D.balance.expGap) assert.equal(P.expMultiplier(gap), value); assert.ok(P.expMultiplier(-7) > .3 && P.expMultiplier(-7) < .7); assert.equal(P.expMultiplier(-100), .05); });
test('角色升級自動提升五項數值，不產生配點且拒絕舊配點 API',()=>{const r=make(),before=P.statsFor(r);r.exp=P.levelCost(r.level)-1;const reward=P.grantExp(r,3);assert.ok(reward.levels>=1);assert.equal(r.points,0);for(const k of Object.keys(before))assert.ok(P.statsFor(r)[k]>before[k]);assert.deepEqual(reward.beforeStats,before);assert.deepEqual(reward.afterStats,P.statsFor(r));assert.equal(P.allocate(r,'hp'),false);});
test('技能與裝備影響能力，能力衰退僅套用一次', () => { const r = make(); assert.equal(P.statsFor(r).stamina, 59); r.debuffIds = ['fatigue']; assert.equal(P.statsFor(r).stamina, 59 * .92); assert.equal(P.battleFor(r, { type: 'slime', level: 1 }).player.stats.stamina, 59 * .92); });
test('未解鎖技能、装備、錯誤欄位被拒絕', () => { const p = P.freshProgress(), b = P.defaultBuild(); b.talents[0] = 'unknown'; assert.throws(() => P.createRun(p, b)); b.talents = []; b.equipment.weapon = 'hood'; assert.throws(() => P.createRun(p, b)); });
test('必殺技必須充能且支付資源，含中斷與回復效果', () => { const run=make(),cost=D.moves.nova.ultimateChargeCost;run.build.ultimate='nova';run.level=20;const b = P.battleFor(run, { type: 'boss', level: 5 }, () => .99); assert.equal(b.choose('nova').ok, false); b.charge=cost; assert.equal(b.charge, cost); const mp = b.player.mana; b.player.stamina = 30; assert.equal(b.choose('nova').ok, true); assert.equal(b.player.mana, mp - 25); assert.equal(b.charge, 0); b.advance(b.player.cast.duration); assert.equal(b.player.stamina, 50); assert.ok(b.events.some(e => e.type === 'interrupt')); const noMP = P.battleFor(make(), { type: 'boss', level: 5 }); noMP.build.ultimate='nova'; noMP.charge = cost; noMP.player.mana = 24; assert.equal(noMP.choose('nova').ok, false); assert.equal(noMP.charge, cost); });
test('疾風靴閃避縮短讀條、巨劍提高傷害與攻擊時間', () => { const r = make(); r.build.moves.push('heavy');r.moveLevels.heavy=1;r.build.equipment.feet = 'windboots'; const b = P.battleFor(r, { type: 'wolf', level: 1 }, () => 0); b.choose('heavy'); const end = b.player.cast.endAt; b.advance(b.enemy.cast.duration+.01); assert.equal(b.player.cast.endAt, end - .5); r.build.equipment.weapon = 'greatsword'; const c = P.battleFor(r, { type: 'slime', level: 1 }); assert.equal(c.getMove('quick').attackTime, 105); assert.equal(c.getMove('quick').multiplier, .8 * 1.35); });
test('運氣影響爆擊、爆傷與 EXP；敏捷影響閃避', () => { const r = make(), b = P.battleFor(r, { type: 'slime', level: 1 }), low = b.rule('critChance', b.player), lowDodge = b.rule('dodgeChance', b.player); b.player.stats.luck += 10; b.player.stats.agility += 10; assert.ok(b.rule('critChance', b.player) > low); assert.ok(b.rule('critMultiplier', b.player) > 1.5); assert.ok(b.rule('dodgeChance', b.player) > lowDodge); const other = make(); other.allocated.luck = 10; assert.ok(P.grantExp(other, 1).amount > P.grantExp(r, 1).amount); });
test('中立型碰觸不進戰鬥、可主動互動', () => { const r = make(), e = r.world.enemies[0]; r.position = { x: e.x, y: e.y }; r.world.enemies = [e]; assert.equal(W.update(r, .1, { x: 0, y: 0 }), null); assert.equal(W.nearby(r).entity.id, e.id); });
test('主動型追擊、警戒型近距離觸發、膽怯型逃跑', () => { for (const [type, level, expected] of [['goblin', 1, 1], ['wolf', 1, 1], ['timid', 5, -1]]) { const r = make(); r.level = level; r.position = { x: 500, y: 1000 }; const e = { id: 'test', type, level: 1, x: 570, y: 1000, homeX: 570, homeY: 1000, defeatedUntil: 0 }; r.world.enemies = [e]; W.update(r, .1, { x: 0, y: 0 }); assert.equal(Math.sign(570 - e.x), expected); } });
test('邊界、探索發現、小地圖標記與區域難度', () => { const r = make(); r.position = { x: D.dungeons[0].x, y: D.dungeons[0].y + 65 }; W.update(r, .1, { x: 0, y: 0 }); assert.ok(r.world.discoveredDungeons.includes('abandoned_mine')); assert.equal(W.nearby(r).kind, 'dungeon'); assert.equal(W.blocked(-1, 300), true); assert.ok(P.regionLevel(1200, 1050) > P.regionLevel(100, 100)); });
test('完整玩法核心：普通戰鬥 → EXP → 四場地下城 → 永久獎勵 → 新局保留', () => {
  const p = P.freshProgress(), r = P.createRun(p);
  const normal = fight(r, { type: 'slime', level: 2 }); assert.equal(normal.phase, 'victory'); P.grantExp(r, 2); assert.deepEqual(p.moves, P.freshProgress().moves);
  r.level=50; r.dungeon = { id: 'abandoned_mine', stage: 0 };
  for (let i = 0; i < 4; i++) { r.dungeon.stage = i; const encounter = P.dungeonEncounter(r); const b = fight(r, encounter); assert.equal(b.phase, 'victory', `地下城第 ${i + 1} 場應可通關`); for (const key of ['hp', 'stamina', 'mana']) assert.ok(b.player[key]<=b.player.stats[key]); r.dungeonResources=Object.fromEntries(['hp','mana','stamina'].map(k=>[k,b.player[k]]));P.carryBattleCharge(r,b);P.grantExp(r, encounter.level); if (r.points) P.allocate(r, 'stamina'); }
  const rewards=P.dungeonReward(p,r,()=>0,{combination:'move_gear'}),moveReward=rewards.find(x=>x.kind==='moves'); assert.ok(moveReward&&p.moves[moveReward.id]);assert.ok(p.equipment.includes('mining_guard'));assert.equal(rewards.length,2);const next=P.createRun(p);assert.equal(next.level,1);assert.equal(next.moveLevels[moveReward.id],1);assert.equal(next.deaths,0);

});

test('新能力替換只允許有效欄位，票券使用後不可重用', () => {
  const p = P.freshProgress(), r = P.createRun(p), old = [...r.build.moves];
  assert.equal(P.receiveAbility(p, r, 'moves', 'spark').isNew, true);
  assert.equal(P.resolveAcquisition(r, 'moves', 'spark', 4), false);
  assert.equal(P.resolveAcquisition(r, 'moves', 'spark', -1), false);
  assert.deepEqual(r.build.moves, old);
  assert.equal(P.resolveAcquisition(r, 'moves', 'spark', 2), true);
  assert.equal(r.build.moves[2], 'spark');
  assert.equal(P.resolveAcquisition(r, 'moves', 'spark', 0), false);
  assert.equal(r.pendingAcquisitions.length, 0);
});

test('放棄新能力仍永久收藏，重複取得只升級而不重開替換', () => {
  const p = P.freshProgress(), r = P.createRun(p), old = [...r.build.moves];
  P.receiveAbility(p, r, 'moves', 'spark');
  assert.equal(P.resolveAcquisition(r, 'moves', 'spark'), true);
  assert.deepEqual(r.build.moves, old);
  assert.equal(p.moves.spark, 1);
  assert.equal(P.resolveAcquisition(r, 'moves', 'spark', 0), false);
  const duplicate = P.receiveAbility(p, r, 'moves', 'spark');
  assert.equal(duplicate.isNew, false);
  assert.equal(duplicate.after, 2);
  assert.equal(r.pendingAcquisitions.length, 0);
});

test('類比移動幅度控制速度且斜向不超速',()=>{
  const slow=make(),fast=make(),diagonal=make();
  for(const r of [slow,fast,diagonal]) {r.position={x:350,y:350};r.world.enemies=[];}
  W.update(slow,.1,{x:.4,y:0}); W.update(fast,.1,{x:1,y:0}); W.update(diagonal,.1,{x:1,y:1});
  const origin={x:350,y:350}; assert.ok(Math.abs(W.distance(origin,slow.position)/W.distance(origin,fast.position)-.4)<1e-8);
  assert.ok(Math.abs(W.distance(origin,diagonal.position)-W.distance(origin,fast.position))<1e-8);
});
