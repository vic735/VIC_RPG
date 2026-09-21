const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./data');
require('./content-v1');
const R=require('./skill-runtime');

function runtime(skillIds,resource={}){
 const actor={id:'player',stats:{hp:100,stamina:100,mana:100},hp:100,stamina:resource.stamina??100,mana:resource.mana??100,statuses:{},weaponType:'sword'};
 const target={id:'enemy',stats:{hp:100,stamina:100,mana:100},hp:100,stamina:100,mana:100,statuses:{}};
 const battle={player:actor,enemy:target,time:0,run:{debuffIds:[]}};
 actor.runtime=new R.Runtime(battle,actor,skillIds.map(id=>D.skills[id]));
 return {actor,target,battle,runtime:actor.runtime};
}
const ctx=move=>({move,target:{statuses:{}},critical:false});

test('neutral helpers use only damage type and an empty element list',()=>{
 assert.equal(R.isNonElementPhysical({damageType:'physical',elements:[]}),true);
 assert.equal(R.isNonElementPhysical({damageType:'physical',elements:['fire']}),false);
 assert.equal(R.isNonElementMagic({damageType:'magic',elements:[]}),true);
 assert.equal(R.isNonElementMagic({damageType:'magic',elements:['water']}),false);
 assert.equal(Object.keys(D.elements).length,7);
 assert.equal(Object.hasOwn(D.elements,'neutral'),false);
});

test('neutral physical specialization never buffs elemental physical attacks',()=>{
 const {runtime:r}=runtime(['pure_weapon','plain_strike','tempered_body','soul_strike']);
 const neutral={damageType:'physical',elements:[],attackTimeBase:150,tags:['slash']};
 const fire={...neutral,elements:['fire']};
 assert.equal(r.modify('damage',100,ctx(neutral)),156);
 assert.equal(r.modify('critMultiplier',1.4,{...ctx(neutral),critical:true}),1.65);
 assert.equal(r.modify('cost:stamina',20,ctx(neutral)),17);
 assert.equal(r.modify('damage',100,ctx(fire)),100);
 assert.equal(r.modify('critMultiplier',1.4,{...ctx(fire),critical:true}),1.4);
 assert.equal(r.modify('cost:stamina',20,ctx(fire)),20);
});

test('neutral magic thresholds include exactly 80%, 25%, and 150 attack time',()=>{
 const high=runtime(['pure_arcana','mana_concentration','overflowing_mana','archmage'],{mana:80}).runtime;
 const long={damageType:'magic',elements:[],attackTimeBase:150,tags:['magic']};
 assert.equal(high.modify('damage',100,ctx(long)),281.25);
 const low=runtime(['depleted_casting'],{mana:25}).runtime;
 assert.equal(low.modify('cost:mana',20,ctx(long)),15);
 const elemental={...long,elements:['water']};
 assert.equal(high.modify('damage',100,ctx(elemental)),100);
 assert.equal(low.modify('cost:mana',20,ctx(elemental)),20);
});

test('general weapon and casting skills still work with elemental moves',()=>{
 const {runtime:r}=runtime(['swordsmanship','fast_cast']);
 const fireSword={damageType:'physical',elements:['fire'],attackTimeBase:100,tags:['slash']};
 const fireMagic={damageType:'magic',elements:['fire'],attackTimeBase:100,tags:['magic']};
 assert.ok(Math.abs(r.modify('damage',100,ctx(fireSword))-112)<1e-9);
 assert.equal(r.modify('attackTime',100,ctx(fireMagic)),90);
});

test('neutral attacks stay at x1.0 and pure magic moves carry no free effects',()=>{
 assert.equal(R.elementMultiplier([],['fire']),1);
 for(const id of ['mana_bolt','pure_mana_cannon']){
  const move=D.moves[id];
  assert.deepEqual(move.elements,[]);
  assert.equal(move.damageType,'magic');
  assert.deepEqual(move.effects,[]);
  assert.equal(move.shopEligible,true);
 }
 assert.equal(D.moves.mana_bolt.multiplier,D.balance.nonElementIdentity.moves.manaBoltRatio);
 assert.equal(D.moves.pure_mana_cannon.multiplier,D.balance.nonElementIdentity.moves.manaCannonRatio);
});

test('all new neutral content participates in reward distribution',()=>{
 const moveIds=new Set([...Object.values(D.contentDistribution.dungeonMoves).flat(),...Object.values(D.contentDistribution.wildMoves).flat()]);
 const skillIds=new Set([...Object.values(D.contentDistribution.dungeonSkills).flat(),...Object.values(D.contentDistribution.wildSkills).flat()]);
 assert.equal(moveIds.has('mana_bolt'),true);
 assert.equal(moveIds.has('pure_mana_cannon'),true);
 for(const id of ['pure_weapon','plain_strike','tempered_body','soul_strike','pure_arcana','mana_concentration','mana_purification','overflowing_mana','depleted_casting','archmage'])assert.equal(skillIds.has(id),true,id);
});
