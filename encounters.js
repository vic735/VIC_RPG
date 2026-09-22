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
 function victory(p,run,e,quick=false){const s=records(run,p);s.kills++;s[quick?'quickKills':'normalKills']++;if(!quick&&!run.defeatedEnemyTypesThisRun.includes(e.type))run.defeatedEnemyTypesThisRun.push(e.type);if(s.lastDefeat?.type===e.type)s.lastDefeat=null;M.encounter(p,e.type,true,run);}
 function hit(p,run,event){if(event.type!=='damage'||event.actorId!=='player'||event.targetId!=='enemy'||event.secondary||event.moveId?.startsWith('status:')||!Number.isFinite(event.damage))return;const s=records(run,p);s.highestHit=Math.max(s.highestHit,event.damage);const m=M.normalize(p);if(s.highestHit>(m.bestHit||0)){m.bestHit=s.highestHit;m.revision++;}}
 function loss(p,run,e,battle){const s=records(run,p),end=battle.lastOutcome;const hp=end?.enemyHP??battle.enemy.hp,max=end?.enemyMaxHP??battle.enemy.stats.hp;if(max>0&&hp>0)s.lastDefeat={type:e.type,name:D.monsters[e.type].name,remainingPercent:Math.max(1,Math.min(100,Math.ceil(hp/max*100))),hp,max};}
 function clear(p,run,id){const s=records(run,p);if(!s.clearedDungeonIds.includes(id))s.clearedDungeonIds.push(id);}
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
 function summary(run,p){const s=records(run,p);return {...s,level:run.level,dungeons:s.clearedDungeonIds.length,newHitRecord:s.highestHit>0&&s.highestHit>s.previousBestHit};}
 const api={members,records,eligible,defeatSpawn,victory,hit,loss,clear,startQuick,finishQuick,summary};if(typeof module!=='undefined')module.exports=api;else root.EncounterFlow=api;
})(globalThis);
