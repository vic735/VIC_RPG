const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data');require('./content-v1');require('./classes');const P=require('./progression'),Meta=require('./meta');
const unique=o=>[...new Set(Object.values(o))];
const hasMechanic=s=>Object.keys(s.modifiers||{}).length||Object.keys(s.statRates||{}).length||Object.keys(s.growthRates||{}).length||(s.combatModifiers||[]).length||(s.hooks||[]).length||s.elementDamageBonusPct||s.elementCostReductionPct||s.incomingElementDamageReductionPct;

test('所有現有技能都有可執行效果，所有無傷害招式都有實際效果',()=>{
 const emptySkills=unique(D.skills).filter(s=>!hasMechanic(s));assert.deepEqual(emptySkills.map(s=>s.id),[]);
 const emptyMoves=unique(D.moves).filter(m=>!m.multiplier&&!(m.effects||[]).length);assert.deepEqual(emptyMoves.map(m=>m.id),[]);
});

test('修復後的治療、淨化、護盾與必殺蓄能會改變實戰狀態',()=>{
 const p=P.freshProgress();for(const id of ['M093','M091'])p.moves[D.moves[id].id]=1;p.skills.push('S051');p.ultimateUnlocked=true;
 const build=P.defaultBuild();build.moves=[D.moves.M093.id,D.moves.M091.id];build.talents=['S051'];build.ultimate='nova';const run=P.createRun(p,build);
 const b=P.battleFor(run,{type:'greywind_0',level:1},()=>.99);b.player.hp=b.player.stats.hp/2;b.player.statuses.test={id:'test',name:'測試弱化',polarity:'debuff',expiresAt:99,duration:9,modifiers:[]};
 assert.equal(b.choose(D.moves.M093.id).ok,true);b.enemy.cast.endAt=999;b.advance(b.player.cast.endAt+.01);assert.ok(b.player.hp>b.player.stats.hp/2);assert.equal(b.player.statuses.test,undefined);
 assert.equal(b.choose(D.moves.M091.id).ok,true);b.advance(b.player.cast.endAt+.01);assert.ok(b.player.shield>0);assert.ok(b.player.runtime.modify('chargeRate',1)>1);
});

test('圖鑑整合招式、技能、魔法書、裝備、狀態、怪物與地下城',()=>{
 const p=P.freshProgress(),all=Meta.collection(p);for(const key of ['moves','skills','books','equipment','statuses','monsters','dungeons'])assert.ok(Array.isArray(all[key]),key);
 assert.equal(all.books.length,Object.keys(D.books).length);assert.equal(all.equipment.length,Object.keys(D.equipment).length);assert.ok(all.statuses.length>=22);assert.equal(all.equipment.find(x=>x.id==='sword').known,true);assert.equal(all.books.find(x=>x.id==='inferno').known,false);
});
