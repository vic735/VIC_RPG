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
