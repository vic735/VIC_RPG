const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./data.js');
require('./content-v1.js');
const {Battle}=require('./engine.js');

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const build=(talents,moves=['fireball'])=>({talents,moves,ultimate:null,equipment:{head:'hood',chest:'coat',arms:'wraps',feet:'boots',weapon:'sword'}});
const battle=(talents,moves=['fireball'],extra={})=>new Battle({rng:()=>.99,rules:{critChance:0,dodgeChance:0},stats:{hp:2000,mana:1000,stamina:1000,agility:40,luck:0},build:build(talents,moves),enemy:{name:'測試敵人',stats:{hp:10000,mana:1000,stamina:1000,agility:0,luck:0},moves:['fire'],elements:[]},...extra});

test('七屬性各七個技能，舊適性 ID 遷移為天賦且光治療保留',()=>{
 assert.equal(D.elementSkillSystem.skillCount,49);
 assert.equal(Object.values(D.elementSkillSystem.skills).flat().length,49);
 assert.equal(D.skills.fire_affinity.name,'火之天賦');
 assert.equal(D.skills.light_affinity.name,'光之天賦');
 assert.ok(D.skills.light_affinity.combatModifiers.some(m=>m.stage==='healing'));
});

test('火四階專精加算為傷害 +165%、消耗 -35%',()=>{
 const ids=['fire_affinity','element_fire_blessing','element_fire_grace','element_fire_authority'];
 const plain=battle([],['fireball']),stacked=battle(ids,['fireball']);
 close(stacked.preview('fireball').estimatedDamage/plain.preview('fireball').estimatedDamage,2.65);
 close(stacked.getMove('fireball').cost.mana,D.moves.fireball.cost.mana*.65);
});

test('雙屬性同時取得兩邊的傷害與消耗加成',()=>{
 const ids=['fire_affinity','element_fire_grace','dark_affinity','element_dark_grace'];
 const plain=battle([],['black_flame']),stacked=battle(ids,['black_flame']);
 close(stacked.preview('black_flame').estimatedDamage/plain.preview('black_flame').estimatedDamage,2.3);
 close(stacked.getMove('black_flame').cost.mana,D.moves.black_flame.cost.mana*.8);
});

test('三階火抗合計 95%，1000 火傷實扣 50 並由吸收回復 5 MP',()=>{
 const ids=['element_fire_resistance','element_fire_immunity','element_fire_absorb'],b=battle(ids);
 b.start();b.player.mana=0;
 const move={id:'test_fire',name:'測試火焰',damageType:'magic',elements:['fire'],multiplier:1,effects:[]};
 const amount=b.damageValue(b.enemy,b.player,move,false,new Set());
 close(amount,50);
 const actual=b.receiveDamage(b.enemy,b.player,amount,move);
 close(actual,50);close(b.player.mana,5);
});

test('雙屬性抗性與兩個吸收效果都會疊加，MP 不超過上限',()=>{
 const ids=['element_fire_absorb','element_dark_absorb'],b=battle(ids);
 b.start();b.player.mana=990;
 const move={id:'test_dual',name:'測試雙屬性',damageType:'magic',elements:['fire','dark'],multiplier:1,effects:[]};
 const amount=b.damageValue(b.enemy,b.player,move,false,new Set());
 close(amount,50);
 b.receiveDamage(b.enemy,b.player,amount,move);
 close(b.player.mana,1000);
});

test('49 個元素技能平均分配至 11 座地下城且沒有重複歸屬',()=>{
 const allocation=D.elementSkillSystem.dungeonAllocation,assigned=Object.values(allocation).flat();
 assert.equal(Object.keys(allocation).length,11);
 assert.equal(assigned.length,49);
 assert.equal(new Set(assigned).size,49);
 for(const ids of Object.values(allocation))assert.ok(ids.length>=3&&ids.length<=6);
 for(const [dungeonId,ids] of Object.entries(allocation)){
  const dungeon=D.dungeons.find(d=>d.id===dungeonId),poolIds=[dungeon.primaryRewardPool,dungeon.rareRewardPool];
  const rewards=poolIds.flatMap(id=>D.rewardPools[id].entries.filter(e=>e.rewardType==='talents').flatMap(e=>e.rewardIds));
  for(const id of ids)assert.ok(rewards.includes(id),`${id} 未放入 ${dungeonId}`);
 }
});

test('普通野怪能力掉落率降至 2.5%～3.5%，技能來源目標為地下城 82%',()=>{
 const ordinary=D.world.regions.flatMap(r=>r.enemyPools).map(id=>D.monsters[id]);
 assert.ok(ordinary.every(m=>m.dropChance>=.025&&m.dropChance<=.035));
 assert.equal(D.balance.rewardSourceTargets.dungeonSkillShare,.82);
 assert.equal(D.balance.rewardSourceTargets.wildSkillShare,.18);
});

test('全部非職業獎勵重新分配，地下城占比介於 75%～90% 且各城最多差一種',()=>{
 const c=D.contentDistribution,dm=Object.values(c.dungeonMoves).flat(),ds=Object.values(c.dungeonSkills).flat(),wm=Object.values(c.wildMoves).flat(),ws=Object.values(c.wildSkills).flat();
 assert.equal(new Set([...dm,...wm,...c.spellbookMoves]).size,dm.length+wm.length+c.spellbookMoves.length);
 assert.equal(new Set([...ds,...ws]).size,ds.length+ws.length);
 const moveShare=(dm.length+c.spellbookMoves.length)/(dm.length+c.spellbookMoves.length+wm.length),skillShare=ds.length/(ds.length+ws.length);
 assert.ok(moveShare>=.75&&moveShare<=.9);assert.ok(skillShare>=.75&&skillShare<=.9);
 for(const values of [Object.values(c.dungeonMoves).map(x=>x.length),Object.values(c.dungeonSkills).map(x=>x.length)])assert.ok(Math.max(...values)-Math.min(...values)<=1);
 for(const id of [...dm,...wm])assert.notEqual(D.moves[id].contentScope,'classExclusive');
 for(const id of [...ds,...ws])assert.notEqual(D.skills[id].contentScope,'classExclusive');
});
