const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),R=require('./skill-runtime'),C=require('./engine'),P=require('./progression'),Lab=require('./debug-lab');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function battle(talents=[],moves=['double_slash','fireball','freeze','earth_0'],extra={}){const b=Lab.build({talents,moves,rng:()=>.99,...extra});b.enemy.cast.endAt=1e6;return b;}
function cast(b,id){assert.equal(b.choose(id).ok,true);const move=b.player.cast.move;b.advance(b.player.cast.duration+Math.max(0,(move.hits||1)-1)*(move.hitInterval??.18)+.001);return b;}
function effect(b,id,actor=b.player){return actor.statuses[id];}

test('正式 50 技能、23 既有招式與 48 招式骨架均具備可執行資料',()=>{
 require('./content-v1');assert.equal(D.contentV1.skillCount,72);assert.equal(D.contentV1.moves.length,100);
 assert.equal(Object.keys(D.elements).length,7);assert.equal(D.moves.alchemy.damageType,'magic');assert.deepEqual(D.moves.alchemy.elements,['metal']);assert.ok(D.moves.alchemy.multiplier>=3);assert.ok(!D.moves.alchemy.effects.some(e=>e.type==='restore'));
 for(const s of Object.values(D.skills))for(const h of s.hooks||[])for(const e of h.effects)assert.ok(R.effects[e.type]);
 for(const m of Object.values(D.moves)){for(const e of m.effects)assert.ok(R.effects[e.type]);for(const e of m.elements)assert.ok(D.elements[e]);}
});
test('七屬性、雙屬性優劣抵銷、無屬性及光闇互剋',()=>{
 for(const [a,targets]of Object.entries(D.elementEdges))for(const d of targets)close(R.elementMultiplier([a],[d]),1.5);
 close(R.elementMultiplier(['wood'],['metal']),.75);close(R.elementMultiplier(['metal','wood'],['wood','water']),1.5);
 close(R.elementMultiplier(['fire','wood'],['water','earth']),1);close(R.elementMultiplier([],['fire']),1);close(R.elementMultiplier(['fire'],[]),1);
 close(R.elementMultiplier(['light','dark'],['light','dark']),1.5);
});
test('最終 MP 消耗共享管線：20→17、臨界資源、裝備與狀態修正只套一次',()=>{
 const b=battle(['economy']);close(b.getMove('fireball').cost.mana,17);close(b.preview('fireball').estimatedDamage,140*.95);
 b.player.mana=16.99;assert.equal(b.choose('fireball').ok,false);b.player.mana=17;assert.equal(b.choose('fireball').ok,true);close(b.player.mana,0);
 const c=battle(['economy','overcast']);close(c.getMove('fireball').cost.mana,20.4);
 R.applyStatus(c,c.player,{id:'discount',name:'測試節能',duration:4,modifiers:[{stage:'cost:mana',op:'multiply',value:.5}]},c.player);
 close(c.getMove('fireball').cost.mana,10.2);c.advance(4);close(c.getMove('fireball').cost.mana,20.4);
});
test('臨機應變在雙資源低於 20% 同時生效，等於20%不生效',()=>{
 const b=battle(['adapt']);b.player.mana=b.player.stamina=19;close(b.getMove('fireball').cost.mana,17);close(b.getMove('double_slash').cost.stamina,15.3);
 b.player.mana=b.player.stamina=20;close(b.getMove('fireball').cost.mana,20);close(b.getMove('double_slash').cost.stamina,18);
});
test('二連斬分兩個時間點命中，第二刀完成前不能開始下一招',()=>{
 const b=battle([],['double_slash']);assert.equal(b.choose('double_slash').ok,true);const duration=b.player.cast.duration;b.advance(duration);
 let hits=b.events.filter(e=>e.type==='damage'&&e.actorId==='player');assert.equal(hits.length,1);assert.ok(b.player.sequence);assert.equal(b.choose('double_slash').ok,false);
 b.advance(.17);assert.equal(b.events.filter(e=>e.type==='damage'&&e.actorId==='player').length,1);b.advance(.02);hits=b.events.filter(e=>e.type==='damage'&&e.actorId==='player');assert.equal(hits.length,2);assert.ok(hits[1].time>hits[0].time);assert.equal(b.player.sequence,null);
});
for(const [move,crit,elements]of [['heavy_slash',false,[]],['double_slash',false,[]],['double_slash',true,[]],['wind_slash',true,['water']]])test('殘影依每段實際傷害逐刀追擊、不爆擊不遞迴：'+move+crit,()=>{
 const b=battle(['afterimage'],[move],{critChance:crit?1:0,enemyElements:elements});cast(b,move);b.advance(.6);
 const hits=b.events.filter(e=>e.type==='damage'&&e.actorId==='player'),echo=b.events.filter(e=>e.type==='afterimage');assert.equal(hits.length,D.moves[move].hits);assert.equal(echo.length,hits.length);for(let i=0;i<hits.length;i++){close(echo[i].damage,hits[i].damage*.25);assert.equal(echo[i].critical,false);assert.deepEqual(echo[i].elements,D.moves[move].elements);if(i)assert.ok(echo[i].time>echo[i-1].time);}
});
test('多段實際伤害受剩餘 HP 限制，已倒下不再觸發殘影',()=>{const b=battle(['afterimage'],['double_slash']);b.enemy.hp=20;cast(b,'double_slash');close(b.events.filter(e=>e.type==='damage')[0].damage,20);assert.equal(b.events.filter(e=>e.type==='afterimage').length,0);});
test('寒氣持續四秒、重複只刷新 -10%、較強效果優先',()=>{
 const b=battle(['chill'],['water_0']);b.enemy.stats.agility=100;cast(b,'water_0');close(b.effectiveStat(b.enemy,'agility'),90);const first=effect(b,'chill',b.enemy).expiresAt;
 cast(b,'water_0');assert.ok(effect(b,'chill',b.enemy).expiresAt>first);close(b.effectiveStat(b.enemy,'agility'),90);
 R.applyStatus(b,b.enemy,{id:'chill',name:'強寒氣',duration:4,modifiers:[{stage:'agility',op:'multiply',value:.7}]},b.player);
 R.applyStatus(b,b.enemy,{id:'chill',name:'弱寒氣',duration:4,modifiers:[{stage:'agility',op:'multiply',value:.9}]},b.player);close(b.effectiveStat(b.enemy,'agility'),70);b.advance(4);close(b.effectiveStat(b.enemy,'agility'),100);
});
test('大地之軀重複刷新仍為 -12% 並準時到期',()=>{
 const b=battle(['earth_body'],['earth_0']);cast(b,'earth_0');close(b.player.runtime.modify('incoming',100),88);cast(b,'earth_0');close(b.player.runtime.modify('incoming',100),88);b.advance(4);close(b.player.runtime.modify('incoming',100),100);
});
test('霸體只擋第一次中斷，不阻擋傷害；新戰鬥重置',()=>{
 const b=battle(['unyielding']);const enemyMove=D.moves.crush;for(let i=0;i<2;i++){b.player.cast={moveId:'fireball',endAt:999};R.effects.interrupt(b,{actor:b.enemy,target:b.player,move:enemyMove},{type:'interrupt'});assert.equal(!!b.player.cast,i===0);}
 const hp=b.player.hp;b.receiveDamage(b.enemy,b.player,40,enemyMove);close(b.player.hp,hp-40);
 b.phase='victory';b.start();assert.equal(b.player.runtime.once.size,0);
});
test('奇蹟成功與失敗皆只判定一次',()=>{
 for(const rng of [()=>0,()=>.99]){const b=battle(['miracle'],['double_slash'],{rng,stats:{luck:50}});b.receiveDamage(b.enemy,b.player,2000,D.moves.crush);const once=b.events.filter(e=>e.skillId==='miracle').length;assert.equal(once,1);if(b.player.hp===1){b.receiveDamage(b.enemy,b.player,10,D.moves.crush);assert.equal(b.player.hp,0);}assert.equal(b.events.filter(e=>e.skillId==='miracle').length,1);}
});
test('老兵 0、1、2 傷勢倍率依序 1／1.07／1.14',()=>{for(let n=0;n<3;n++){const b=battle(['veteran']);b.run.debuffIds=['frail','fatigue'].slice(0,n);close(b.player.runtime.modify('damage',100,{move:D.moves.fireball}),100*(1+.07*n));}});
test('乘勝追擊消耗一次且施放中的快照不被資源變動重算',()=>{
 const b=battle(['pursuit'],['instant','heavy_slash'],{critChance:1});cast(b,'instant');close(b.getMove('heavy_slash').attackTime,128);b.rules.critChance=0;cast(b,'heavy_slash');close(b.getMove('heavy_slash').attackTime,160);
 const c=battle(['adapt'],['fireball']);c.player.stamina=19;assert.ok(c.choose('fireball').ok);close(c.player.cast.spent.mana,17);c.player.stamina=100;c.advance(c.player.cast.duration);close(c.player.mana,83);
});
test('反擊本能只強化下一物理；身心循環與中斷回收走實際消耗',()=>{
 const b=battle(['counter','body_cycle','mana_reclaim'],['instant','freeze']);b.player.mana=50;b.receiveDamage(b.enemy,b.player,10,D.moves.crush);close(b.preview('instant').estimatedDamage,72);cast(b,'instant');close(b.preview('instant').estimatedDamage,60);close(b.player.mana,53);b.enemy.cast={moveId:'crush',endAt:b.time+999};cast(b,'freeze');close(b.player.mana,43);
});
test('燃燒按時間刻度結算、反覆刷新不增加層數，分步與大步一致',()=>{
 const make=()=>{const b=battle([],['blast_bolt']);cast(b,'blast_bolt');return b;};const a=make(),b=make();a.advance(5);for(let i=0;i<100;i++)b.advance(.05);close(a.enemy.hp,b.enemy.hp);assert.equal(Object.keys(a.enemy.statuses).length,0);
});
test('低級治癒不對敵人造成傷害，聖光回響與光適性生效',()=>{const b=battle(['holy_echo','light_affinity'],['lesser_heal']);b.player.hp=500;b.player.mana=50;const enemy=b.enemy.hp;cast(b,'lesser_heal');close(b.player.hp,746.4);close(b.player.mana,37);close(b.enemy.hp,enemy);});
test('生命成長、基礎敏捷、最大資源及勤奮 EXP 生效',()=>{const p=P.freshProgress(),build=P.defaultBuild();p.skills=Object.keys(D.skills);build.talents=['vitality','life_growth','swift','diligence'];const r=P.createRun(p,build);r.level=3;const detail=P.statBreakdown(r);close(detail.hp.bonusRate,.35);close(detail.agility.base,22*1.12+3);close(P.statsFor(r).hp,(150+2*12*1.35)*1.15);const plain=P.createRun(p,{...build,talents:[]});const before=P.grantExp(plain,1).amount;r.level=1;assert.ok(P.grantExp(r,1).amount>before);});
test('新技能統一學習接口與局內一次性裝備選擇、永久存檔',()=>{const p=P.freshProgress();p.skills=p.skills.filter(id=>id!=='afterimage');const r=P.createRun(p);assert.equal(P.learnSkill(p,'afterimage',r).isNew,true);assert.ok(P.resolveAcquisition(r,'talents','afterimage',0));assert.equal(P.resolveAcquisition(r,'talents','afterimage',1),false);let raw;P.saveProgress({setItem:(k,v)=>raw=v},p);assert.ok(P.loadProgress({getItem:()=>raw}).progress.skills.includes('afterimage'));});

test('傷害技能條件：破綻、迅擊、重擊、劍術、弓術、適性、瀕死與賭徒',()=>{
 const cases=[['opening','instant',1.25],['quick_master','instant',1.15],['heavy_master','heavy_slash',1.25],['swordsmanship','instant',1.12],['metal_affinity','metal_0',1.15],['wood_affinity','wood_0',1.15],['water_affinity','water_0',1.15],['fire_affinity','fireball',1.15],['earth_affinity','earth_0',1.15],['light_affinity','light_arrow',1.15],['dark_affinity','dark_bolt',1.15],['gambler','instant',.92]];
 for(const [skill,id,multiple]of cases){const b=battle([skill],[id]);close(b.preview(id).estimatedDamage,100*D.moves[id].multiplier*multiple);}
 const b=battle(['archery'],['light_arrow'],{equipment:{weapon:'bow'}});close(b.rule('critChance',b.player,{move:D.moves.light_arrow}),.08);close(b.preview('light_arrow').estimatedDamage,121);
 const c=battle(['last_burst','night_erosion'],['dark_bolt']);c.player.hp=200;R.applyStatus(c,c.enemy,{id:'test',name:'弱化',duration:5,polarity:'debuff',modifiers:[]},c.player);close(c.preview('dark_bolt').estimatedDamage,125*1.25*1.2);
});
test('護盾一次、防護門檻、魔力／體力循環、金中斷退款與木治癒',()=>{
 const b=battle(['emergency']);b.receiveDamage(b.enemy,b.player,850,D.moves.crush);close(b.player.shield,200);b.receiveDamage(b.enemy,b.player,100,D.moves.crush);close(b.player.shield,100);assert.equal(b.events.filter(e=>e.skillId==='emergency').length,1);
 const c=battle(['mana_guard','tenacity']);c.player.hp=200;close(c.player.runtime.modify('incoming',100),72);c.player.mana=50;close(c.player.runtime.modify('incoming',100),80);
 const d=battle(['mana_cycle','stamina_cycle'],['fireball'],{critChance:1});d.player.mana=d.player.stamina=50;cast(d,'fireball');close(d.player.mana,35);d.player.runtime.emit('OnDodge',{move:D.moves.crush});close(d.player.stamina,56);
 const e=battle(['lightning_refund'],['ice_lightning']);e.player.mana=50;cast(e,'ice_lightning');close(e.player.mana,31.25);
 const f=battle(['flourish'],['root_trap']);f.player.hp=500;cast(f,'root_trap');close(f.player.hp,550);
});
test('快速詠唱、鈍器中斷成功率、燃燒刷新與火焰袍事件',()=>{
 const b=battle(['fast_cast'],['fireball']);close(b.getMove('fireball').attackTime,100);b.player.stats.agility=999;close(b.preview('fireball').castTime,.5);
 const c=battle(['blunt_master'],['lightning_whip'],{equipment:{weapon:'mace'}});close(c.player.runtime.modify('interruptChance',.8,{move:D.moves.lightning_whip}),1);
 const d=battle(['wildfire'],['fireball'],{equipment:{chest:'flame_robe'}});cast(d,'fireball');const deadline=d.enemy.statuses.burn.expiresAt;cast(d,'fireball');assert.ok(d.enemy.statuses.burn.expiresAt>deadline);assert.equal(Object.keys(d.enemy.statuses).length,1);
});

test('全部招式可經正式引擎完成施放；無缺失效果處理器',()=>{
 for(const move of Object.values(D.moves)){
  const b=battle([],move.kind==='normal'?[move.id]:['quick'],{ultimate:move.kind==='ultimate'?move.id:'nova',stats:{mana:1000,stamina:1000},charge:100});
  assert.equal(b.choose(move.id).ok,true,move.id);b.advance(b.player.cast.duration);assert.equal(b.player.cast,null,move.id);
 }
});
test('無效週期狀態被拒絕，避免測試工具造成時間迴圈',()=>{const b=battle();assert.throws(()=>R.applyStatus(b,b.enemy,{id:'bad',duration:0,modifiers:[]},b.player));assert.throws(()=>R.applyStatus(b,b.enemy,{id:'bad',duration:4,tick:{interval:0,ratio:.1,stat:'mana'},modifiers:[]},b.player));});
