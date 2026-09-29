/* Rebuild dungeon rewards by C–SS grade while preserving elemental identity and field scarcity. */
(function(root){
 const gradeRank={C:0,B:1,A:2,S:3,SS:4};
 const allowed={C:[12,20,38],B:[20,38,50,70],A:[50,70,85,110],S:[85,110,130,160],SS:[160,175,190]};
 const baseGrade=level=>level<=20?'C':level<=70?'B':level<=130?'A':'S';
 const profiles={abandoned_mine:['earth'],old_lab:['fire','metal'],root_cave:['wood'],sunken_temple:['water','light'],lava_vein:['fire','earth'],giant_ruins:['earth'],frozen_tower:['water'],thunder_workshop:['metal'],blacklight_chapel:['light','dark'],element_abyss:['metal','wood','water','fire','earth','light','dark'],terminal_structure:[]};
 const unique=o=>[...new Set(Object.values(o))],elements=x=>[...new Set(x?.targetElements||x?.elements||x?.specElements||[])];
 const entry=(D,poolId,type)=>D.rewardPools[poolId]?.entries.find(e=>e.rewardType===type);
 const flatten=o=>Object.values(o||{}).flat();
 function chooseField(ids,source,total){return [...ids].sort((a,b)=>gradeRank[source[a].powerGrade]-gradeRank[source[b].powerGrade]||a.localeCompare(b)).slice(0,total);}
 function allocate(D,ids,source){
  const result=Object.fromEntries(D.dungeons.map(d=>[d.id,[]])),loads=Object.fromEntries(D.dungeons.map(d=>[d.id,0])),gradeLoads=Object.fromEntries(D.dungeons.map(d=>[d.id,Object.fromEntries(Object.keys(gradeRank).map(g=>[g,0]))]));
  for(const id of [...ids].sort((a,b)=>gradeRank[source[b].powerGrade]-gradeRank[source[a].powerGrade]||a.localeCompare(b))){const item=source[id],levels=allowed[item.powerGrade],candidates=D.dungeons.filter(d=>levels.includes(d.recommendedLevel||d.level));candidates.sort((a,b)=>{const score=d=>(item.preferredDungeon===d.id?8:0)+elements(item).filter(e=>(profiles[d.id]||[]).includes(e)).length*4-gradeLoads[d.id][item.powerGrade]*12-loads[d.id]*.4-Math.abs((d.recommendedLevel||d.level)-levels[Math.floor(levels.length/2)])*.01;return score(b)-score(a)||a.id.localeCompare(b.id);});const chosen=candidates[0];result[chosen.id].push(id);loads[chosen.id]++;gradeLoads[chosen.id][item.powerGrade]++;}
  return result;
 }
 function apply(D){
  if(!D.contentDistribution||!D.contentGrades)return D;
  const moveSource=Object.fromEntries(unique(D.moves).map(x=>[x.id,x])),skillSource=Object.fromEntries(unique(D.skills).map(x=>[x.id,x]));
  const previousWildMoves=flatten(D.contentDistribution.wildMoves),previousWildSkills=flatten(D.contentDistribution.wildSkills);
  const allMoves=[...new Set([...flatten(D.contentDistribution.dungeonMoves),...previousWildMoves])].filter(id=>moveSource[id]&&moveSource[id].contentScope!=='classExclusive');
  const allSkills=[...new Set([...flatten(D.contentDistribution.dungeonSkills),...previousWildSkills])].filter(id=>skillSource[id]&&skillSource[id].contentScope!=='classExclusive');
  const wildMoves=chooseField(allMoves,moveSource,previousWildMoves.length),wildSkills=chooseField(allSkills,skillSource,previousWildSkills.length),wildMoveSet=new Set(wildMoves),wildSkillSet=new Set(wildSkills);
  const dungeonMoves=allocate(D,allMoves.filter(id=>!wildMoveSet.has(id)),moveSource),dungeonSkills=allocate(D,allSkills.filter(id=>!wildSkillSet.has(id)),skillSource);
  for(const d of D.dungeons)for(const type of ['moves','talents']){entry(D,d.primaryRewardPool,type).rewardIds=[];entry(D,d.rareRewardPool,type).rewardIds=[];}
  for(const d of D.dungeons)for(const [type,ids,source]of [['moves',dungeonMoves[d.id],moveSource],['talents',dungeonSkills[d.id],skillSource]]){const base=gradeRank[baseGrade(d.recommendedLevel||d.level)],primary=ids.filter(id=>gradeRank[source[id].powerGrade]<=base),rare=ids.filter(id=>gradeRank[source[id].powerGrade]>base);if(!primary.length&&rare.length)primary.push(rare[0]);if(!rare.length&&primary.length)rare.push(primary.at(-1));entry(D,d.primaryRewardPool,type).rewardIds.push(...primary);entry(D,d.rareRewardPool,type).rewardIds.push(...rare);}
  const fieldIds=Object.keys(D.contentDistribution.wildMoves),fieldProfiles={greywind:['earth'],verdant:['wood','water'],redrift:['fire','earth'],froststorm:['water','metal'],obsidian:['light','dark']};
  function fields(ids,source){const out=Object.fromEntries(fieldIds.map(id=>[id,[]]));for(const id of ids){const es=elements(source[id]);const choices=[...fieldIds].sort((a,b)=>es.filter(e=>(fieldProfiles[b.replace('_field','')]||[]).includes(e)).length-es.filter(e=>(fieldProfiles[a.replace('_field','')]||[]).includes(e)).length||out[a].length-out[b].length||a.localeCompare(b));out[choices[0]].push(id);}return out;}
  const fieldMoves=fields(wildMoves,moveSource),fieldSkills=fields(wildSkills,skillSource);for(const poolId of fieldIds){entry(D,poolId,'moves').rewardIds=fieldMoves[poolId];entry(D,poolId,'talents').rewardIds=fieldSkills[poolId];}
  const equipment=Object.values(D.equipment),equipmentAllocation=allocate(D,equipment.map(x=>x.id),D.equipment);for(const d of D.dungeons){entry(D,d.secondaryRewardPool,'equipment').rewardIds=[];entry(D,d.rareRewardPool,'equipment').rewardIds=entry(D,d.rareRewardPool,'equipment').rewardIds.filter(id=>!D.equipment[id]);for(const id of equipmentAllocation[d.id]){const item=D.equipment[id],rareOnly=item.acquisitionTier==='rare-only'||['epic','legendary'].includes(item.rarity);entry(D,rareOnly||gradeRank[item.powerGrade]>=3?d.rareRewardPool:d.secondaryRewardPool,'equipment').rewardIds.push(id);}}
  const equipmentUses={};for(const d of D.dungeons){const normal=entry(D,d.secondaryRewardPool,'equipment');if(normal.rewardIds.length)for(const id of normal.rewardIds)equipmentUses[id]=(equipmentUses[id]||0)+1;else{const level=d.recommendedLevel||d.level,cap=gradeRank[baseGrade(level)],candidate=[...equipment].filter(x=>x.acquisitionTier!=='rare-only'&&!['epic','legendary'].includes(x.rarity)&&gradeRank[x.powerGrade]<=cap&&level>=allowed[x.powerGrade][0]).sort((a,b)=>(equipmentUses[a.id]||0)-(equipmentUses[b.id]||0)||gradeRank[b.powerGrade]-gradeRank[a.powerGrade]||a.id.localeCompare(b.id))[0];normal.rewardIds.push(candidate.id);equipmentUses[candidate.id]=(equipmentUses[candidate.id]||0)+1;}}
  // Preserve the opening mine's guaranteed, readable first equipment reward.
  const firstMine=D.dungeons.find(d=>d.id==='abandoned_mine');if(firstMine){const normal=entry(D,firstMine.secondaryRewardPool,'equipment');normal.rewardIds=normal.rewardIds.filter(id=>id!=='mining_guard');normal.rewardIds.unshift('mining_guard');}
  for(const item of equipment){item.sourceDungeons=[];for(const d of D.dungeons)if([d.secondaryRewardPool,d.rareRewardPool].some(poolId=>entry(D,poolId,'equipment').rewardIds.includes(item.id)))item.sourceDungeons.push(d.id);}
  const assignedElement={};for(const [dungeonId,ids]of Object.entries(dungeonSkills))for(const id of ids)if(D.skills[id]?.standardElementMatrix)(assignedElement[dungeonId]??=[]).push(id);D.elementSkillSystem.dungeonAllocation=assignedElement;
  if(D.mapData)for(const map of D.mapData){const region=D.regionData?.find(r=>r.id===map.regionId),source=D.rewardPools[(region?.legacyRegionId||'greywind')+'_field'];for(const poolId of map.rewardPoolIds||[])if(source)D.rewardPools[poolId].entries=JSON.parse(JSON.stringify(source.entries));}
  for(const pool of Object.values(D.rewardPools))pool.entries=pool.entries.filter(e=>e.rewardIds.length);
  D.contentDistribution={...D.contentDistribution,version:2,dungeonMoves,dungeonSkills,wildMoves:fieldMoves,wildSkills:fieldSkills};
  D.resourceDistributionRules={allowed,baseGrade,profiles};return D;
 }
 if(typeof module!=='undefined')module.exports=apply;else root.ResourceDistribution=apply;
})(globalThis);
