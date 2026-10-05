/* Deterministic combat audit. Does not read or write player storage. */
const fs=require('node:fs'),path=require('node:path'),P=require('./progression'),D=require('./data'),L=require('./level-progression');
const builds=[
 {id:'basic',name:'基礎配置',moves:['quick','fire'],talents:[]},
 {id:'physical',name:'物理配置',moves:['quick','double_slash','heavy','lesser_heal'],talents:['vigor','vitality','swift']},
 {id:'magic',name:'魔法配置',moves:['mana_bolt','fire','spark','lesser_heal'],talents:['control','mana_boost','economy']},
 {id:'hybrid',name:'混合配置',moves:['quick','fire','spark','lesser_heal'],talents:['vigor','control','fast_cast']}
];
function fixture(level,config){const p=P.freshProgress(),build={...P.defaultBuild(),moves:config.moves,talents:config.talents};for(const id of build.moves)p.moves[id]=1;for(const id of build.talents)if(!p.skills.includes(id))p.skills.push(id);const run=P.createRun(p,build);run.level=level;return run;}
function fight(level,type,enemyLevel,config,seed=1,options={}){
 let state=seed;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const run=fixture(level,config),battle=P.battleFor(run,{type,level:enemyLevel,...options},rng),start={...battle.player.stats};
 const healing=config.moves.find(id=>D.moves[id].effects?.some(e=>e.type==='heal'));
 while(battle.phase==='fighting'&&battle.time<180){
  if(!battle.player.cast&&!battle.player.sequence){
   let chosen=healing&&battle.player.hp<battle.player.stats.hp*.55&&battle.player.mana>=(battle.preview(healing).cost.mana||0)?healing:null;
   if(!chosen){const attacks=config.moves.map(id=>battle.preview(id)).filter(m=>m.multiplier>0&&Object.entries(m.cost).every(([k,n])=>battle.player[k]>=n)),sustainable=attacks.filter(m=>Object.entries(m.cost).every(([k,n])=>Math.ceil(battle.enemy.hp/Math.max(1,m.estimatedDamage))*n<=battle.player[k]));chosen=(sustainable.length?sustainable:attacks).sort((a,b)=>sustainable.length?b.estimatedDamage/b.castTime-a.estimatedDamage/a.castTime:b.estimatedDamage/Math.max(.001,Object.entries(b.cost).reduce((n,[k,c])=>n+c/start[k],0))-a.estimatedDamage/Math.max(.001,Object.entries(a.cost).reduce((n,[k,c])=>n+c/start[k],0)))[0]?.id;}
   if(chosen)battle.choose(chosen,false);
  }
  battle.advance(.05);
 }
 const damage=battle.events.filter(e=>e.actorId==='player'&&e.targetId==='enemy'&&e.damage),received=battle.events.filter(e=>e.actorId==='enemy'&&e.targetId==='player'&&e.damage).reduce((n,e)=>n+e.damage,0),out=battle.lastOutcome;
 const spent=k=>battle.buildReport[k+'Spent']||0;
 let burst=0;for(const e of damage)burst=Math.max(burst,damage.filter(x=>x.time>=e.time&&x.time<e.time+3).reduce((n,x)=>n+x.damage,0)/3);
 return {playerLevel:level,enemyLevel,type,enemyGrade:P.enemyGrade(type,enemyLevel,{...options,overworld:true}).rank,build:config.id,seed,won:battle.phase==='victory',phase:battle.phase,seconds:Number(battle.time.toFixed(2)),dps:Number((damage.reduce((n,e)=>n+e.damage,0)/battle.time).toFixed(2)),burstDps:Number(burst.toFixed(2)),effectiveHp:Number((battle.enemy.stats.hp*(1+(battle.enemyDefinition.physicalDefense+battle.enemyDefinition.magicResistance)/200)).toFixed(1)),received:Number(received.toFixed(1)),remainingHp:Number((out?.playerHP??battle.player.hp).toFixed(1)),mpSpentRatio:Number((spent('mana')/start.mana).toFixed(3)),spSpentRatio:Number((spent('stamina')/start.stamina).toFixed(3)),byMove:battle.buildReport.byMove,criticalShare:Number((damage.filter(e=>e.critical).reduce((n,e)=>n+e.damage,0)/Math.max(1,damage.reduce((n,e)=>n+e.damage,0))).toFixed(3))};
}
function audit(){
 const growth=L.table.map(row=>{const run=fixture(row.level,builds[0]),before=row.level-1,exp=P.grantExp(run,row.level,'goblin',{overworld:true});return {...row,stats:P.statsFor({...run,level:row.level}),ordinaryReward:exp.amount,ordinaryAbilitySteps:exp.levels,bossTarget:P.targetLevelsFor(row.level,'boss')};});
 const samples=[];
 for(const [index,level]of L.anchors.entries())for(const build of builds)for(const offset of [0,1,2])for(const seed of [1,17,73])samples.push(fight(level,'goblin',L.anchors[Math.min(15,index+offset)],build,seed));
 for(const level of [1,10,50,150,300,450])for(const type of ['slime','wolf','greywind_elite','boss'])for(const build of builds)samples.push(fight(level,type,level,build));
 const maps=D.mapData.map(m=>{const ordinary=m.spawnPoints.filter(p=>!p.elite),counts={};for(const p of ordinary)counts[p.level]=(counts[p.level]||0)+1;return {id:m.id,count:m.spawnPoints.length,uniqueLevels:Object.keys(counts).length,topLevelShare:counts[Math.max(...ordinary.map(p=>p.level))]/ordinary.length,gradeCounts:m.spawnPoints.reduce((a,p,i)=>{const type=(p.elite?m.elitePoolIds:m.enemyPoolIds)[i%(p.elite?m.elitePoolIds:m.enemyPoolIds).length],g=P.enemyGrade(type,p.level,{...p,overworld:true}).rank;a[g]=(a[g]||0)+1;return a;},{})};});
 return {version:D.release.version,assumptions:'新手基本裝備、招式熟練 1、無必殺；優先選能以剩餘資源擊倒敵人的最高 DPS 招式，否則選資源效率較佳的招式，低於55%生命時治療。每個同階／越階點使用四種配置及三組固定亂數。不是玩家勝率預測。',growth,samples,maps};
}
if(require.main===module){const report=audit(),target=path.join(__dirname,'BALANCE-0.26.0.json');fs.writeFileSync(target,JSON.stringify(report,null,2));for(const level of [1,10,50,100,200,300,400,490]){const rows=report.samples.filter(s=>s.playerLevel===level&&s.type==='goblin'&&s.enemyLevel===level);if(rows.length)console.log(level,rows.map(s=>s.build+':'+s.seconds+'s/'+s.won).join(' '));}console.log('Audit saved:',target);}
module.exports={builds,fixture,fight,audit};
