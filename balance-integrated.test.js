const test=require('node:test'),assert=require('node:assert/strict'),D=require('./data'),P=require('./progression');
test('固定分段曲線、物種倍率與攻擊力不依玩家階級調整',()=>{
 for(let i=0;i<D.enemyBalance.levels.length;i++){const level=D.enemyBalance.levels[i],e=P.enemyDefinition('greywind_1',level);assert.equal(e.stats.hp,D.enemyBalance.hp[i]);assert.equal(e.attackPower,D.enemyBalance.attack[i]);}
 assert.equal(P.enemyDefinition('greywind_1',23).stats.hp,299);assert.equal(P.enemyDefinition('greywind_0',20).stats.hp,225);
 let hp=0;for(let l=1;l<=200;l++){const e=P.enemyDefinition('greywind_1',l);assert.ok(e.stats.hp>=hp);hp=e.stats.hp;}
});
test('十等內額外減傷為零，十一等起平滑增加；基礎防禦仍生效',()=>{
 const r=P.createRun(P.freshProgress());r.level=20;const b=P.battleFor(r,{type:'greywind_0',level:20});const base=b.preview('quick').estimatedDamage;
 for(let gap=0;gap<=10;gap++){b.options.levelGap=gap;assert.equal(b.preview('quick').estimatedDamage,base);}
 b.options.levelGap=11;assert.ok(Math.abs(b.preview('quick').estimatedDamage/base-1/1.064)<1e-9);
 b.options.levelGap=20;assert.ok(Math.abs(b.preview('quick').estimatedDamage/base-.5)<1e-9);
});
test('史萊姆EXP七折、定位單選，地下城不觸發開局三倍',()=>{
 assert.equal(P.enemyProfile('greywind_0').species.exp,.7);
 assert.equal(P.enemyProfile('greywind_elite',{overworld:false}).tuning.exp,4);
 const r=P.createRun(P.freshProgress());r.level=20;const luck=Math.min(D.balance.expLuckCap,P.statsFor(r).luck*.008),normalTarget=P.targetLevelsFor(20,'normal')*.7;assert.equal(P.grantExp(r,20,'greywind_0').amount,Math.round(P.expForLevels(20,normalTarget)*(1+luck)));
 const d=P.createRun(P.freshProgress());d.dungeon={id:'abandoned_mine',stage:0};const dungeonTarget=P.targetLevelsFor(2,'dungeon')*.7,expected=Math.round(P.expForLevels(1,dungeonTarget)*P.expMultiplier(1)*(1+Math.min(D.balance.expLuckCap,P.statsFor(d).luck*.008)));assert.equal(P.grantExp(d,2,'greywind_0',{role:'normal'}).amount,expected);
 assert.equal(P.expMultiplier(-20),.1);assert.equal(P.expMultiplier(5),1.3);assert.equal(P.expMultiplier(10),1.6);assert.equal(P.expMultiplier(20),2);
});
test('冒險階級Lv對照只決定任務目標，不要求角色等級',()=>{
 assert.equal(D.rankReferenceLevels[3],20);assert.equal(D.rankPromotions[2].challenge.enemyLevel,20);
 assert.ok(D.rankPromotions.every(r=>r.normal.level===0));
});
