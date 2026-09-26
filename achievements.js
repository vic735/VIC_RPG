/* Event-driven achievement tracker. Battle events are consumed once after combat. */
(function(root){
 const D=typeof module!=='undefined'?require('./data'):root.GameData;
 const C=typeof module!=='undefined'?require('./classes'):root.ClassSystem;
 const defs={
  ACH_UNLOCK_WARRIOR:{id:'ACH_UNLOCK_WARRIOR',name:'劍之道路',category:'職業解鎖',description:'裝備劍，且一場戰鬥只以劍類傷害招式擊倒敵人。累積 50 名。',progressTarget:50,rewardType:'UnlockClass',rewardId:'WARRIOR'},
  ACH_WARRIOR_MASTERY_01:{id:'ACH_WARRIOR_MASTERY_01',name:'劍士之路',category:'職業精通',description:'戰士裝備劍時擊倒 100 名敵人。',progressTarget:100,rewardType:'UnlockSkill',rewardId:'WARRIOR_SKILL_001'},
  ACH_WARRIOR_MASTERY_02:{id:'ACH_WARRIOR_MASTERY_02',name:'重擊修行',category:'職業精通',description:'以慢速劍類招式成功施放 80 次。',progressTarget:80,rewardType:'UnlockMove',rewardId:'WARRIOR_MOVE_001'},
  ACH_WARRIOR_MASTERY_03:{id:'ACH_WARRIOR_MASTERY_03',name:'不退之人',category:'職業精通',description:'戰士低血量時擊倒 30 名敵人。',progressTarget:30,rewardType:'UnlockSkill',rewardId:'WARRIOR_SKILL_002'},
  ACH_WARRIOR_MASTERY_04:{id:'ACH_WARRIOR_MASTERY_04',name:'鐵壁',category:'職業精通',description:'戰士在勝利戰鬥中累積承受 10,000 傷害。',progressTarget:10000,rewardType:'UnlockSkill',rewardId:'WARRIOR_SKILL_003'},
  ACH_WARRIOR_MASTERY_05:{id:'ACH_WARRIOR_MASTERY_05',name:'戰場支配者',category:'職業精通',description:'戰士成功中斷敵人 50 次。',progressTarget:50,rewardType:'UnlockMove',rewardId:'WARRIOR_MOVE_002'}
  ,ACH_UNLOCK_MAGE:{id:'ACH_UNLOCK_MAGE',name:'奧術道路',category:'職業解鎖',description:'以 MP 傷害招式擊倒 50 名敵人，並在同一局用過 4 種不同魔法。',progressTarget:50,rewardType:'UnlockClass',rewardId:'MAGE'}
  ,ACH_UNLOCK_RANGER:{id:'ACH_UNLOCK_RANGER',name:'獵人之眼',category:'職業解鎖',description:'以箭類招式擊倒 40 名敵人並命中讀條敵人 20 次。',progressTarget:40,rewardType:'UnlockClass',rewardId:'RANGER'}
  ,ACH_UNLOCK_CLERIC:{id:'ACH_UNLOCK_CLERIC',name:'聖光之誓',category:'職業解鎖',description:'累積有效治療 5000，並以治療或防護完成 30 場戰鬥。',progressTarget:5000,rewardType:'UnlockClass',rewardId:'CLERIC'}
  ,ACH_UNLOCK_SPELLSWORD:{id:'ACH_UNLOCK_SPELLSWORD',name:'術劍之門',category:'職業解鎖',description:'戰士與魔法師皆解鎖後，以混合配置通關 20 座不同地下城。',progressTarget:20,rewardType:'UnlockClass',rewardId:'SPELLSWORD',prerequisites:['WARRIOR','MAGE']}
 };
 const swordMove=m=>!!m&&(m.tags||[]).includes('sword');
 const classOf=id=>id.includes('_MAGE_')?'MAGE':id.includes('_RANGER_')?'RANGER':id.includes('_CLERIC_')?'CLERIC':id.includes('_SPELLSWORD_')?'SPELLSWORD':id.includes('_WARRIOR_')?'WARRIOR':null;
 const mastery=[['MAGE','MAGE_MOVE_001','魔力砲'],['MAGE','MAGE_SKILL_001','超載詠唱'],['RANGER','RANGER_MOVE_001','穿心箭'],['RANGER','RANGER_SKILL_001','弱點狙擊'],['CLERIC','CLERIC_MOVE_001','大祝福'],['CLERIC','CLERIC_SKILL_001','祝福延續'],['SPELLSWORD','SPELLSWORD_MOVE_001','魔力斬'],['SPELLSWORD','SPELLSWORD_SKILL_001','魔武共振'],['WARRIOR','WARRIOR_MOVE_003','劍閃'],['WARRIOR','WARRIOR_SKILL_004','守勢轉攻']];
 for(const [classId,rewardId,name] of mastery){const id=`ACH_${classId}_MASTERY_${String(Object.keys(defs).filter(k=>k.startsWith('ACH_'+classId+'_MASTERY')).length+1).padStart(2,'0')}`;defs[id]={id,name,category:'職業精通',description:`使用${classId}累積完成職業戰鬥。`,progressTarget:50,rewardType:rewardId.includes('_MOVE_')?'UnlockMove':'UnlockSkill',rewardId};}
 function available(p,d){const c=classOf(d.id);return (!c||p.unlockedClassIds.includes(c))&&!(d.prerequisites||[]).some(id=>!p.unlockedClassIds.includes(id));}
 function add(p,id,value,queue){C.normalize(p);const d=defs[id];if(!d||p.completedAchievementIds.includes(id)||!available(p,d))return false;p.achievementProgress[id]=Math.min(d.progressTarget,(p.achievementProgress[id]||0)+value);if(p.achievementProgress[id]<d.progressTarget)return false;p.completedAchievementIds.push(id);if(d.rewardType==='UnlockClass'&&!p.unlockedClassIds.includes(d.rewardId))p.unlockedClassIds.push(d.rewardId);if(d.rewardType==='UnlockMove'){if(!p.unlockedClassExclusiveMoveIds.includes(d.rewardId))p.unlockedClassExclusiveMoveIds.push(d.rewardId);p.moves[d.rewardId]||=1;}if(d.rewardType==='UnlockSkill'){if(!p.unlockedClassExclusiveSkillIds.includes(d.rewardId))p.unlockedClassExclusiveSkillIds.push(d.rewardId);if(!p.skills.includes(d.rewardId))p.skills.push(d.rewardId);}queue?.push(d);return true;}
 function start(run){run.runAchievementTemporaryState={weaponStayedSword:run.build.equipment.weapon==='sword',usedOnlySwordDamage:true,damageTaken:0,lowHpKill:false,interrupts:0};}
 function battleEnd(p,run,b){if(!run||!b||run.achievementBattleHandled)return [];run.achievementBattleHandled=false;const t=run.runAchievementTemporaryState||{};const events=b.events||[];for(const e of events){if(e.actorId==='player'&&e.type==='damage'){const m=D.moves[e.moveId];if(!swordMove(m))t.usedOnlySwordDamage=false;}if(e.targetId==='player'&&e.type==='damage')t.damageTaken+=e.damage||0;if(e.actorId==='player'&&e.type==='interrupt')t.interrupts++;}const q=[];const warrior=run.activeClassId==='WARRIOR',sword=run.build.equipment.weapon==='sword';if(b.phase==='victory'&&t.weaponStayedSword&&t.usedOnlySwordDamage)add(p,'ACH_UNLOCK_WARRIOR',1,q);if(warrior&&sword&&b.phase==='victory')add(p,'ACH_WARRIOR_MASTERY_01',1,q);if(warrior&&sword){for(const e of events)if(e.actorId==='player'&&e.type==='cast'&&swordMove(D.moves[e.moveId])&&(D.moves[e.moveId].attackTimeBase||D.moves[e.moveId].attackTime)>=150)add(p,'ACH_WARRIOR_MASTERY_02',1,q);if(b.phase==='victory')add(p,'ACH_WARRIOR_MASTERY_04',t.damageTaken,q);add(p,'ACH_WARRIOR_MASTERY_05',t.interrupts,q);}run.pendingAchievementNotifications=(run.pendingAchievementNotifications||[]).concat(q);return q;}
 function trackBattle(p,run,b){const q=battleEnd(p,run,b),t=run.runAchievementTemporaryState||{},events=b.events||[];t.uniqueMagicMoveIds||=[];let mpKill=false,arrowKill=false,healOrProtect=false;for(const e of events)if(e.actorId==='player'){const m=D.moves[e.moveId];if(e.type==='cast'&&m?.damageType==='magic')t.uniqueMagicMoveIds=[...new Set([...t.uniqueMagicMoveIds,m.id])];if(e.type==='damage'&&m){mpKill||=m.damageType==='magic'&&!!m.cost?.mana;arrowKill||=(m.tags||[]).includes('arrow');}if(e.type==='cast'&&m&&['heal','defense'].includes(m.kind))healOrProtect=true;}if(b.phase==='victory'&&mpKill&&t.uniqueMagicMoveIds.length>=4)add(p,'ACH_UNLOCK_MAGE',1,q);if(b.phase==='victory'&&arrowKill)add(p,'ACH_UNLOCK_RANGER',1,q);if(b.phase==='victory'&&healOrProtect)add(p,'ACH_UNLOCK_CLERIC',1,q);for(const d of Object.values(defs))if(d.category==='職業精通'&&classOf(d.id)===run.activeClassId&&b.phase==='victory')add(p,d.id,1,q);return q;}
 function dungeonClear(p,run,dungeonId){if(!p.unlockedClassIds.includes('WARRIOR')||!p.unlockedClassIds.includes('MAGE'))return [];const ids=run.build.moves.map(id=>D.moves[id]);const mp=ids.filter(m=>m?.damageType==='magic'&&m.cost?.mana).length,physical=ids.filter(m=>m?.damageType==='physical').length;if(mp<2||physical<2)return [];const seen=run.runAchievementTemporaryState?.uniqueDungeonIdsCountedForSpellsword||[];if(seen.includes(dungeonId))return [];run.runAchievementTemporaryState||={};run.runAchievementTemporaryState.uniqueDungeonIdsCountedForSpellsword=[...seen,dungeonId];const q=[];add(p,'ACH_UNLOCK_SPELLSWORD',1,q);run.pendingAchievementNotifications=(run.pendingAchievementNotifications||[]).concat(q);return q;}
 const journeyTasks=[
  {id:'RUN_HUNT',name:'戰鬥歷練',metric:'kills',target:20,marks:15},
  {id:'RUN_CLEAR',name:'遺跡突破',metric:'dungeons',target:1,marks:25},
  {id:'RUN_LEVEL',name:'逐漸成長',metric:'level',target:10,marks:20},
  ...[3,6,9,12,15].map((i,n)=>({id:'RUN_RANK_'+i,name:D.runRating.ranks[i]+' 評級挑戰',metric:'rank',target:i,marks:[20,30,40,60,90][n]}))
 ];
 const rankRewards={3:['moves','spark'],6:['skills','economy'],9:['moves','double_slash'],12:['skills','fast_cast'],15:['moves','lightning_whip'],17:['skills','mana_cycle']};
 const journeyAchievements=[
  ...D.runRating.ranks.map((rank,i)=>({id:'ACH_JOURNEY_RANK_'+i,name:'旅途評級 · '+rank,metric:'rank',target:i,marks:10+i*5,ability:rankRewards[i]})),
  {id:'ACH_JOURNEY_HUNT',name:'百戰旅人',metric:'kills',target:100,marks:60,ability:['moves','heavy']},
  {id:'ACH_JOURNEY_CLEAR',name:'遺跡征服者',metric:'dungeons',target:3,marks:80,ability:['skills','counter']},
  {id:'ACH_JOURNEY_LEVEL',name:'成長足跡',metric:'level',target:30,marks:60,ability:['skills','swift']}
 ];
 function journeyStats(run){const E=typeof module!=='undefined'?require('./encounters'):root.EncounterFlow,s=E.summary(run);return {kills:s.kills,dungeons:s.dungeons,level:s.level,score:s.rating.score,rank:s.rating.index};}
 function journeyDescription(d){return d.metric==='rank'?'本局實際晉升至 '+D.runRating.ranks[d.target]+'（含更高階）。':d.metric==='score'?(d.target?'單局結算評分達到 '+d.target+' 分。':'完成一次冒險結算。'):'單局'+({kills:'擊敗 ',dungeons:'通關不同地下城 ',level:'達到 Lv.'}[d.metric])+d.target+({kills:' 隻敵人（含壓制）。',dungeons:' 座。',level:'。'}[d.metric]);}
 function journeyReward(d){const a=d.ability,content=a&&(a[0]==='moves'?D.moves:D.skills)[a[1]];return d.marks+' 旅者徽記'+(content?' ＋ '+(a[0]==='moves'?'招式':'技能')+'「'+content.name+'」':'');}
 function settleJourney(p,run){
  if(!run||run.status!=='failed')return null;if(run.journeySettlement)return run.journeySettlement;
  C.normalize(p);const M=typeof module!=='undefined'?require('./meta'):root.GameMeta,m=M.normalize(p),stats=journeyStats(run),receipts=[];
  function reward(d,kind){let marks=d.marks,ability=null,duplicate=false;
   if(d.ability){const [type,id]=d.ability,content=(type==='moves'?D.moves:D.skills)[id];if(!content||content.contentScope==='classExclusive')throw Error('旅途獎勵必須是有效的通用能力');duplicate=type==='moves'?!!p.moves[id]:p.skills.includes(id);if(duplicate)marks+=25;else if(type==='moves')p.moves[id]=1;else p.skills.push(id);ability={type,id,name:content.name};}
   receipts.push({id:d.id,name:d.name,kind,marks,ability,duplicate});
  }
  for(const d of journeyTasks)if(stats[d.metric]>=d.target)reward(d,'task');
  for(const d of journeyAchievements){const key=d.metric==='rank'?d.id+'_rank':d.id;p.achievementProgress[key]=Math.max(p.achievementProgress[key]||0,Math.min(d.target,stats[d.metric]));if(!p.completedAchievementIds.includes(d.id)&&stats[d.metric]>=d.target){reward(d,'achievement');p.completedAchievementIds.push(d.id);}}
  const total=receipts.reduce((n,r)=>n+r.marks,0);m.marks+=total;m.earned+=total;m.revision++;run.journeySettlement={stats,receipts,total};return run.journeySettlement;
 }
 const api={defs,add,start,battleEnd:trackBattle,dungeonClear,swordMove,journeyTasks,journeyAchievements,journeyStats,journeyDescription,journeyReward,settleJourney};if(typeof module!=='undefined')module.exports=api;else root.Achievements=api;
})(globalThis);
