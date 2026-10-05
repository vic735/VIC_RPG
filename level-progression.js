/* Hidden ability growth is independent of adventurer promotion. */
(function(root){
 const VERSION=2,OLD_CAP=190,NEW_CAP=500,OPENING_CAP=20,POWER=1.55;
 const ranks=['D','C−','C','C＋','B−','B','B＋','A−','A','A＋','S−','S','S＋','SS−','SS','SS＋'];
 const anchors=[1,10,20,30,45,65,90,120,155,195,240,290,345,400,450,490];
 const bands=[
  {through:10,hp:12,stamina:3,mana:3,agility:.6,luck:.3},
  {through:50,hp:14,stamina:3.5,mana:3.5,agility:.45,luck:.16},
  {through:150,hp:14,stamina:4,mana:4,agility:.35,luck:.10},
  {through:300,hp:16,stamina:4.5,mana:4.5,agility:.25,luck:.08},
  {through:500,hp:18,stamina:5,mana:5,agility:.20,luck:.06}
 ];
 const clamp=n=>Math.max(1,Math.min(NEW_CAP,Number(n)||1));
 const from999=n=>Math.round(n<=OPENING_CAP?Math.max(1,n):OPENING_CAP+(NEW_CAP-OPENING_CAP)*Math.min(1,(n-OPENING_CAP)/(999-OPENING_CAP)));
 function growth(level,key){let value=0,start=1;for(const band of bands){value+=Math.max(0,Math.min(clamp(level),band.through)-start)*band[key];start=band.through;}return value;}
 const cost=n=>n>=NEW_CAP?Infinity:90+(Math.max(1,n)-1)*30;
 const table=Array.from({length:NEW_CAP},(_,i)=>{const level=i+1;return {level,expToNext:level===NEW_CAP?null:cost(level),...Object.fromEntries(['hp','stamina','mana','agility','luck'].map(k=>[k,growth(level,k)]))};});
 const gradeIndex=level=>Math.max(0,anchors.findLastIndex(n=>level>=n));
 const grade=level=>ranks[gradeIndex(level)];
 const tier=rank=>String(rank).replace(/[−＋+-]/g,'');
 const scaleLevel=level=>{level=Math.max(1,Number(level)||1);if(level<=OPENING_CAP)return Math.round(level);const t=Math.min(1,(level-OPENING_CAP)/(OLD_CAP-OPENING_CAP));return Math.round(OPENING_CAP+(NEW_CAP-OPENING_CAP)*Math.pow(t,POWER));};
 const referenceLevel=level=>level<=OPENING_CAP?level:OPENING_CAP+(OLD_CAP-OPENING_CAP)*Math.pow(Math.min(1,(level-OPENING_CAP)/(NEW_CAP-OPENING_CAP)),1/POWER);
 function depthScore(point,roads){let nearest={distance:Infinity,progress:0};for(const road of roads){const lengths=road.slice(1).map((b,i)=>Math.hypot(b.x-road[i].x,b.y-road[i].y)),total=lengths.reduce((a,b)=>a+b,0);let walked=0;for(let i=1;i<road.length;i++){const a=road[i-1],b=road[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);if(distance<nearest.distance)nearest={distance,progress:(walked+t*lengths[i-1]+distance*.15)/total};walked+=lengths[i-1];}}return nearest.progress;}
 function apply(D){
  if(D.levelProgression?.version===VERSION)return D;
  D.adventure.maxLevel=NEW_CAP;D.adventure.growthTable=table;D.adventure.growthBands=bands;
  const oldRanks=[...D.runRating.ranks],oldPromotions=D.rankPromotions;
  D.rankPromotions=ranks.slice(0,-1).map((rank,i)=>{const old=oldPromotions[oldRanks.indexOf(rank)]||oldPromotions[0];return {...old,normal:{...old.normal,enemyLevel:anchors[i],enemyGradeIndex:i},challenge:{...old.challenge,enemyLevel:anchors[i+1],enemyGradeIndex:i+1}};});
  D.runRating.ranks=ranks;D.runRating.thresholds=[0];for(const p of D.rankPromotions)D.runRating.thresholds.push(D.runRating.thresholds.at(-1)+p.points);
  D.rankReferenceLevels=anchors;
  D.balance.expPacing={...D.balance.expPacing,version:3,legacyThrough:20,surgeFrom:50,levelKnots:[[1,1],[20,1.3],[50,2],[100,4],[200,8],[300,12],[400,16],[500,20]]};
  D.balance.resourceGrowth={field:1,dungeon:.25};D.balance.critDamageCap=2.2;D.balance.post50Mastery=[[100,.006],[250,.003],[500,.0015]];
  const levels=[1,5,10,20,30,50,75,100,150,200,250,300,350,400,450,500];
  const stat=(n,k)=>D.adventure.baseStats[k]+growth(n,k),defense=n=>6+34*(n-1)/(NEW_CAP-1);
  D.enemyBalance.levels=levels;
  D.enemyBalance.hp=levels.map(n=>Math.round((stat(n,'stamina')+10)*.56*(1+stat(n,'agility')/100)/4*(1+Math.min(.55,.05+stat(n,'luck')*.006)*(.4+stat(n,'luck')*.008))/(1+defense(n)/100)*(9+3*Math.min(1,(n-1)/49))));
  D.enemyBalance.attack=levels.map(n=>Math.round((stat(n,'hp')+30)*.12));
  D.enemyBalance.defenseBase=6;D.enemyBalance.defensePerLevel=34/(NEW_CAP-1);
  D.enemyBalance.roles={normal:{hp:1,damage:1,exp:1},strong:{hp:1.2,damage:.95,exp:1.5},dungeon:{hp:1.12,damage:.92,exp:1.8},elite:{hp:1.3,damage:.88,exp:4},boss:{hp:1.65,damage:.75,exp:8},importantBoss:{hp:1.85,damage:.7,exp:12}};
  D.enemyBalance.firstBoss={hp:1.65,damage:.75,exp:8};D.enemyBalance.gradeShift={normal:0,strong:0,dungeon:0,elite:0,boss:0,importantBoss:0};D.enemyBalance.version=3;
  for(const region of D.world.regions||[]){region.min=region.recommendedLevelMin=scaleLevel(region.min||region.recommendedLevelMin);region.max=region.recommendedLevelMax=scaleLevel(region.max||region.recommendedLevelMax);for(const band of region.subAreaLevelRanges||[]){band.min=scaleLevel(band.min);band.max=scaleLevel(band.max);}}
  for(const map of D.mapData||[]){
   map.recommendedLevelMin=from999(map.recommendedLevelMin);map.recommendedLevelMax=from999(map.recommendedLevelMax);map.eliteLevelRange=map.eliteLevelRange.map(from999);
   for(const range of Object.values(map.route.bands))for(let i=0;i<range.length;i++)range[i]=from999(range[i]);
   // Retain every spawn ID, position, habitat and count; spread each complete
   // local level band instead of clamping off-path distances at the top.
   for(const section of ['arrival','main','deep']){const points=map.spawnPoints.filter(p=>!p.elite&&p.section===section).sort((a,b)=>depthScore(a,section==='deep'?map.route.branches:[map.route.mainRoad])-depthScore(b,section==='deep'?map.route.branches:[map.route.mainRoad])||a.x-b.x||a.y-b.y),range=map.route.bands[section];points.forEach((p,i)=>p.level=Math.round(range[0]+(range[1]-range[0])*(i+.5)/points.length));}
   for(const p of map.spawnPoints.filter(p=>p.elite))p.level=from999(p.level);
  }
  for(const d of D.dungeons||[]){if(d.training)continue;d.level=d.recommendedLevel=d.finalLevelScale?from999(d.level):scaleLevel(d.originalRecommendedLevel||d.level);for(const w of d.enemyWaves||[])w.level=d.finalLevelScale?from999(w.level):scaleLevel(w.originalLevel||w.level);}
  for(const spawn of D.enemySpawnData||[])if(spawn.level!=null)spawn.level=scaleLevel(spawn.level);
  D.levelProgression={version:VERSION,oldCap:OLD_CAP,maxLevel:NEW_CAP,openingCap:OPENING_CAP,power:POWER,scaleLevel,grade,gradeIndex,tier,anchors,ranks,legacyRanks:oldRanks,legacyThresholds:[0,50,100,180,260,350,450,560,680,820,970,1130,1320,1530,1760,2020,2320,2700]};return D;
 }
 function migrateRun(D,run){
  if(!run||run.enemyLevelCurveVersion===VERSION)return run;
  const convert=run.enemyLevelCurveVersion===1?from999:scaleLevel,oldLevel=run.level;
  run.level=clamp(convert(oldLevel));const fraction=Math.max(0,Math.min(.999,(run.exp||0)/(90+(oldLevel-1)*30)));run.exp=run.level===NEW_CAP?0:Math.floor(cost(run.level)*fraction);
  for(const enemy of run.world?.enemies||[])enemy.level=convert(enemy.level);
  for(const waveList of Object.values(run.exploration?.dungeons||{}))for(const wave of waveList)wave.level=convert(wave.level);
  for(const enemy of run.fieldEncounterQueue||[])enemy.level=convert(enemy.level);
  for(const enemy of run.quickBattle?.enemies||[])enemy.level=convert(enemy.level);
  if(run.adventurerRank){const s=run.adventurerRank,old=['D−','D','D＋','C−','C','C＋','B−','B','B＋','A−','A','A＋','S−','S','S＋','SS−','SS','SS＋'];if(s.index>=0){s.index=Math.max(0,ranks.indexOf(old[s.index]));s.progress=Math.min(D.rankPromotions[s.index]?.points||0,s.progress||0);}if(run.starter?.phase==='cleared')s.index=Math.max(1,s.index);for(const h of s.history||[])if(h.route==='starter'){h.from='D';h.to='C−';}else{if(['D−','D＋','E'].includes(h.from))h.from='D';if(['D−','D＋'].includes(h.to))h.to='D';}s.version=2;if(s.last)s.last.level=run.level;}
  run.enemyLevelCurveVersion=VERSION;return run;
 }
 const api={VERSION,NEW_CAP,ranks,anchors,bands,table,growth,cost,scaleLevel,referenceLevel,from999,gradeIndex,grade,tier,apply,migrateRun};if(typeof module!=='undefined')module.exports=api;else {root.LevelProgression=api;if(root.GameData)apply(root.GameData);}
})(globalThis);
