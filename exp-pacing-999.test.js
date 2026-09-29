const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),P=require('./progression');
test('普通怪預期升級數由前期一級平滑成長至後期三十級',()=>{const levels=[1,20,50,100,300,600,850,999].map(l=>P.targetLevelsFor(l,'normal'));assert.deepEqual(levels,[1,1.5,2,3,8,15,24,30]);for(let i=1;i<levels.length;i++)assert.ok(levels[i]>=levels[i-1]);});
test('後期 Boss 約提供四十至五十級，且未設定硬性升級上限',()=>{assert.equal(P.targetLevelsFor(999,'boss'),48);assert.ok(Math.abs(P.targetLevelsFor(999,'importantBoss')-50.1)<1e-9);assert.equal(D.balance.expPacing.maxLevelsPerBattle,undefined);});
test('EXP 依玩家接下來的實際升級需求換算',()=>{for(const level of [1,100,600,900]){const needed=P.expForLevels(level,10);const direct=Array.from({length:10},(_,i)=>P.levelCost(level+i)).reduce((a,b)=>a+b,0);assert.equal(needed,direct);}const p=P.freshProgress(),r=P.createRun(p);r.level=850;const result=P.grantExp(r,850,'greywind_1');assert.ok(result.levels>=24&&result.levels<=30);});
test('史萊姆保留七折，開局單場約提升一級而非三倍暴升',()=>{const p=P.freshProgress(),r=P.createRun(p),result=P.grantExp(r,1,'greywind_0');assert.ok(result.levels<=1);assert.equal(P.enemyProfile('greywind_0').species.exp,.7);});
