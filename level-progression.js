/* Expands the original Lv.1–190 world into Lv.1–999 without damaging the opening route. */
(function(root){
 const VERSION=1,OLD_CAP=190,NEW_CAP=999,OPENING_CAP=20,POWER=1.55;
 const scaleLevel=level=>{level=Math.max(1,Number(level)||1);if(level<=OPENING_CAP)return Math.round(level);const t=Math.min(1,(level-OPENING_CAP)/(OLD_CAP-OPENING_CAP));return Math.round(OPENING_CAP+(NEW_CAP-OPENING_CAP)*Math.pow(t,POWER));};
 const referenceLevel=level=>level<=OPENING_CAP?level:OPENING_CAP+(OLD_CAP-OPENING_CAP)*Math.pow(Math.min(1,(level-OPENING_CAP)/(NEW_CAP-OPENING_CAP)),1/POWER);
 const scaleCurve=(levels,values)=>levels.map((old,i)=>Math.round(values[i]*Math.max(1,scaleLevel(old)/old)));
 function apply(D){
  if(D.levelProgression?.version===VERSION)return D;
  const oldLevels=[...D.enemyBalance.levels],oldHp=[...D.enemyBalance.hp],oldAttack=[...D.enemyBalance.attack];
  D.enemyBalance.levels=oldLevels.map(scaleLevel);D.enemyBalance.hp=scaleCurve(oldLevels,oldHp);D.enemyBalance.attack=scaleCurve(oldLevels,oldAttack);D.enemyBalance.version=2;
  for(const region of D.world.regions||[]){region.min=region.recommendedLevelMin=scaleLevel(region.min||region.recommendedLevelMin);region.max=region.recommendedLevelMax=scaleLevel(region.max||region.recommendedLevelMax);for(const band of region.subAreaLevelRanges||[]){band.min=scaleLevel(band.min);band.max=scaleLevel(band.max);}}
  for(const map of D.mapData||[]){if(map.finalLevelScale)continue;map.recommendedLevelMin=scaleLevel(map.recommendedLevelMin);map.recommendedLevelMax=scaleLevel(map.recommendedLevelMax);for(const point of map.spawnPoints||[])point.level=scaleLevel(point.level);}
  for(const dungeon of D.dungeons||[]){if(dungeon.finalLevelScale)continue;dungeon.originalRecommendedLevel??=dungeon.recommendedLevel||dungeon.level;dungeon.recommendedLevel=dungeon.level=scaleLevel(dungeon.originalRecommendedLevel);for(const wave of dungeon.enemyWaves||[]){wave.originalLevel??=wave.level;wave.level=scaleLevel(wave.originalLevel);}}
  for(const spawn of D.enemySpawnData||[])if(spawn.level!=null)spawn.level=scaleLevel(spawn.level);
  D.rankReferenceLevels=(D.rankReferenceLevels||[]).map(scaleLevel);for(const promotion of D.rankPromotions||[]){promotion.normal.enemyLevel=scaleLevel(promotion.normal.enemyLevel);promotion.challenge.enemyLevel=scaleLevel(promotion.challenge.enemyLevel);}
  D.levelProgression={version:VERSION,oldCap:OLD_CAP,maxLevel:NEW_CAP,openingCap:OPENING_CAP,power:POWER,scaleLevel};return D;
 }
 function migrateRun(D,run){if(!run||run.enemyLevelCurveVersion===VERSION)return run;for(const enemy of run.world?.enemies||[])enemy.level=scaleLevel(enemy.level);run.enemyLevelCurveVersion=VERSION;return run;}
 const api={VERSION,scaleLevel,referenceLevel,apply,migrateRun};if(typeof module!=='undefined')module.exports=api;else root.LevelProgression=api;
})(globalThis);
