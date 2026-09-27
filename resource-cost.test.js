const test=require('node:test'),assert=require('node:assert/strict');
const P=require('./progression'),D=require('./data');require('./content-v1');
test('基本招式保持低耗，新招式下修且重複註冊不重複打折',()=>{
 for(const [id,key,n]of [['quick','stamina',3],['fire','mana',5],['spark','mana',16],['heavy','stamina',20],['double_slash','stamina',11]])assert.equal(D.moves[id].cost[key],n);
 const before=JSON.stringify(Object.values(D.moves).map(m=>m.cost));D.applyResourceCostBalance();assert.equal(JSON.stringify(Object.values(D.moves).map(m=>m.cost)),before);
});
test('實戰扣款等於顯示消耗，敵人共用招式保留原消耗',()=>{
 const p=P.freshProgress();p.moves.spark=1;const r=P.createRun(p);r.build.moves=['spark'];const b=P.battleFor(r,{type:'greywind_0',level:1},()=>.99);
 const cost=b.preview('spark').cost.mana,before=b.player.mana;assert.equal(b.choose('spark').ok,true);assert.equal(b.player.mana,before-cost);assert.equal(b.getMove('spark',b.enemy).cost.mana,25);
});
test('雙資源招式維持雙重消耗，減耗疊加後仍為正值',()=>{
 assert.deepEqual(D.moves.SPELLSWORD_MOVE_003.cost,{mana:10,stamina:10});
 const p=P.freshProgress(),r=P.createRun(p);r.build.talents=['economy'];const b=P.battleFor(r,{type:'greywind_0',level:1});const m=b.preview('fire');assert.ok(m.cost.mana>0&&m.cost.mana<=D.moves.fire.cost.mana);
});
