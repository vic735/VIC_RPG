const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),P=require('./progression'),L=require('./level-up');
test('玩家等級上限固定為 999，滿級後不再累積 EXP',()=>{const p=P.freshProgress(),r=P.createRun(p);r.level=998;r.exp=P.levelCost(998)-1;const result=P.grantExp(r,999,'slime');assert.equal(r.level,999);assert.equal(r.exp,0);assert.equal(result.capped,true);const again=P.grantExp(r,999,'slime');assert.equal(r.level,999);assert.equal(r.exp,0);assert.equal(P.levelCost(999),Infinity);assert.equal(again.levels,0);});
test('Lv.50 後招式成長採分段遞減且不爆炸',()=>{assert.ok(P.moveScale(200)>P.moveScale(50));assert.ok(P.moveScale(999)>P.moveScale(200));assert.ok(P.moveScale(999)<6);});
test('升級演出辨識百級里程碑與最高等級',()=>{assert.deepEqual(L.milestones({beforeLevel:95,afterLevel:101}),[100]);assert.ok(L.html({beforeLevel:998,afterLevel:999,levels:1,maxLevel:999,beforeStats:{hp:1,mana:1,stamina:1,agility:1,luck:1},afterStats:{hp:2,mana:2,stamina:2,agility:2,luck:2}}).includes('最高等級'));});
