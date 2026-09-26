/* Field suppression and factual run records; never synthesizes combat events. */
(function(root){
 const D=typeof module!=='undefined'?require('./data'):root.GameData;
 const P=typeof module!=='undefined'?require('./progression'):root.Progression;
 const M=typeof module!=='undefined'?require('./meta'):root.GameMeta;
 const Rewards=typeof module!=='undefined'?require('./world-rewards'):root.WorldRewards;
 const members=e=>Array.isArray(e?.enemies)?e.enemies:e?[e]:[];
 function records(run,p){run.defeatedEnemyTypesThisRun=[...new Set((run.defeatedEnemyTypesThisRun||[]).filter(id=>D.monsters[id]))];return run.battleStats||=( {kills:0,normalKills:0,quickKills:0,clearedDungeonIds:[],highestHit:0,previousBestHit:p?.meta?.bestHit||0,lastDefeat:null} );}
 function special(e){return !e||e.elite||e.isElite||e.boss||e.isBoss||e.specialEvent||e.isSpecialEvent||e.isEvent||e.special||e.eventId||e.eventType||e.event||e.dungeonId||e.dungeon||e.isDungeon||e.quickBattleAllowed===false||e.forceNormalGroup||['elite','boss','event','special','dungeon'].includes(e.kind)||['elite','boss','event','special','dungeon'].includes(e.source)||['elite','boss','event','special','dungeon'].includes(e.role)||['elite','boss','event','special','dungeon'].includes(e.encounterKind);}
 function eligible(run,encounter,enabled=true){
  if(!enabled||!run||run.status!=='active'||run.dungeon||special(encounter))return false;
  const list=members(encounter),seen=new Set(run.defeatedEnemyTypesThisRun||[]),ids=new Set();
  return list.length>0&&list.every(e=>{const d=D.monsters[e.type],world=run.world.enemies.find(x=>x.id===e.id);if(ids.has(e.id))return false;ids.add(e.id);return !!d&&!!world&&!special(e)&&!special(d)&&!special(world)&&world.type===e.type&&world.level===e.level&&world.defeatedUntil<=run.world.time&&seen.has(e.type)&&Number.isFinite(e.level)&&run.level>=e.level+D.balance.quickBattleLevelGap;});
 }
 function defeatSpawn(run,e){const world=run.world.enemies.find(x=>x.id===e.id);if(world){world.defeatedUntil=run.world.time+D.balance.respawnSeconds;world.x=world.homeX;world.y=world.homeY;}}
 function victory(p,run,e,quick=false){rankState(run);const s=records(run,p);s.kills++;s[quick?'quickKills':'normalKills']++;if(!quick&&!run.defeatedEnemyTypesThisRun.includes(e.type))run.defeatedEnemyTypesThisRun.push(e.type);if(s.lastDefeat?.type===e.type)s.lastDefeat=null;M.encounter(p,e.type,true,run);advanceRank(run,{enemy:e,quick});}
 function hit(p,run,event){if(event.type!=='damage'||event.actorId!=='player'||event.targetId!=='enemy'||event.secondary||event.moveId?.startsWith('status:')||!Number.isFinite(event.damage))return;const s=records(run,p);s.highestHit=Math.max(s.highestHit,event.damage);const m=M.normalize(p);if(s.highestHit>(m.bestHit||0)){m.bestHit=s.highestHit;m.revision++;}}
 function loss(p,run,e,battle){const s=records(run,p),end=battle.lastOutcome;const hp=end?.enemyHP??battle.enemy.hp,max=end?.enemyMaxHP??battle.enemy.stats.hp;if(max>0&&hp>0)s.lastDefeat={type:e.type,name:D.monsters[e.type].name,remainingPercent:Math.max(1,Math.min(100,Math.ceil(hp/max*100))),hp,max};}
 function clear(p,run,id){rankState(run);const s=records(run,p);if(!s.clearedDungeonIds.includes(id))s.clearedDungeonIds.push(id);advanceRank(run);}
 function startQuick(run,e,enabled=true){if(run.quickBattle||!eligible(run,e,enabled))return false;run.quickBattle={enemies:members(e).map(x=>({...x})),remaining:D.balance.quickBattleSeconds};return true;}
 function finishQuick(p,run,rng=Math.random){
  const pending=run.quickBattle;if(!pending)return null;
  // Revalidate restored saves; an invalid pending encounter must return to normal combat.
  if(!eligible(run,{enemies:pending.enemies},true)){delete run.quickBattle;return {fallback:pending.enemies};}
  const beforeLevel=run.level,beforeStats=P.statsFor(run);let amount=0;const rewards=[];
  for(const e of pending.enemies){amount+=P.grantExp(run,e.level,e.type).amount;victory(p,run,e,true);defeatSpawn(run,e);rewards.push(...P.grantRewards(p,run,Rewards.enemy(e.type,rng,run.currentMapId)));}
  const result={exp:{amount,beforeLevel,beforeStats,afterLevel:run.level,afterStats:P.statsFor(run),levels:run.level-beforeLevel},enemies:pending.enemies,rewards,quick:true,countsForCombatChallenges:false};
  delete run.quickBattle;run.lastEncounterResult={mode:'quick',countsForCombatChallenges:false};return result;
 }
 function rating(stats){
  const cfg=D.runRating,safe=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
  const parts={kills:Math.min(cfg.kills.cap,safe(stats.kills)*cfg.kills.points),dungeons:Math.min(cfg.dungeons.cap,safe(stats.dungeons)*cfg.dungeons.points),levels:Math.min(cfg.levels.cap,Math.max(0,safe(stats.level)-1)*cfg.levels.points)};
  const score=parts.kills+parts.dungeons+parts.levels,index=cfg.thresholds.findLastIndex(n=>score>=n);
  return {score,parts,rank:cfg.ranks[index],tier:['D','C','B','A','S','SS'][Math.floor(index/3)],nextRank:cfg.ranks[index+1]||null,remaining:cfg.thresholds[index+1]===undefined?0:cfg.thresholds[index+1]-score};
 }
 function rankMetrics(run){const s=records(run);return {kills:s.kills,dungeons:s.clearedDungeonIds.length,level:run.level};}
 function rankState(run){
  if(!run.adventurerRank){
   // Migration: retain an old run's already earned grade, but carry no points.
   // Historical kills cannot be replayed as new promotion tasks.
   const metrics=rankMetrics(run),old=rating(metrics);
   run.adventurerRank={version:1,index:D.runRating.ranks.indexOf(old.rank),progress:0,last:metrics,normalKills:0,challengeKills:0,history:[],migrated:true};
  }
  return run.adventurerRank;
 }
 function rankView(run){
  const s=rankState(run),cfg=D.rankPromotions[s.index],metrics=rankMetrics(run);
  const active=!!cfg&&s.progress>=cfg.points;
  const normal=cfg&&active?[
   {label:'任務出現後討伐魔物（含壓制）',value:s.normalKills,target:cfg.normal.kills},
   ...(cfg.normal.level?[{label:'本局角色等級',value:metrics.level,target:cfg.normal.level}]:[]),
   ...(cfg.normal.dungeons?[{label:'本局通關不同地下城',value:metrics.dungeons,target:cfg.normal.dungeons}]:[])
  ]:[];
  return {index:s.index,rank:D.runRating.ranks[s.index],tier:['D','C','B','A','S','SS'][Math.floor(s.index/3)],nextRank:D.runRating.ranks[s.index+1]||null,progress:s.progress,required:cfg?.points||0,remaining:cfg?Math.max(0,cfg.points-s.progress):0,active,normal,
   challenge:cfg?{label:'本階正常擊敗 Lv.'+cfg.challenge.enemyLevel+' 以上魔物（不含壓制）',value:s.challengeKills,target:cfg.challenge.kills}:null};
 }
 function advanceRank(run,event={}){
  const s=rankState(run),cfg=D.rankPromotions[s.index],metrics=rankMetrics(run),previous=s.last;
  s.last=metrics;if(!cfg||run.status!=='active')return null;
  const wasActive=s.progress>=cfg.points;
  // A triggering kill belongs to exactly one rank. The kill filling the bar
  // does not count as a newly revealed ordinary mission's first kill.
  if(event.enemy){if(wasActive)s.normalKills++;if(!event.quick&&event.enemy.level>=cfg.challenge.enemyLevel)s.challengeKills++;}
  if(!wasActive)s.progress=Math.min(cfg.points,s.progress+Math.max(0,metrics.kills-previous.kills)*D.runRating.kills.points+Math.max(0,metrics.dungeons-previous.dungeons)*D.runRating.dungeons.points+Math.max(0,metrics.level-previous.level)*D.runRating.levels.points);
  const view=rankView(run),direct=s.challengeKills>=cfg.challenge.kills,normal=view.active&&view.normal.every(t=>t.value>=t.target);
  if(!direct&&!normal)return null;
  const promotion={from:view.rank,to:view.nextRank,route:direct?'challenge':'normal'};
  s.index++;s.progress=0;s.normalKills=0;s.challengeKills=0;s.history.push(promotion);return promotion;
 }
 function summary(run,p){const s=records(run,p),result={...s,level:run.level,dungeons:s.clearedDungeonIds.length,newHitRecord:s.highestHit>0&&s.highestHit>s.previousBestHit};return {...result,rating:{...rating(result),...rankView(run)}};}
 const api={members,records,eligible,defeatSpawn,victory,hit,loss,clear,startQuick,finishQuick,summary,rating,rankState,rankView,advanceRank};if(typeof module!=='undefined')module.exports=api;else root.EncounterFlow=api;
})(globalThis);
