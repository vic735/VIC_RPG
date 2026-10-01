(function(root){
 const D=typeof module!=='undefined'?require('./data.js'):root.GameData;
 function pick(entries,rng){const total=entries.reduce((n,e)=>n+e.weight,0);if(!entries.length||total<=0)throw Error('獎勵池沒有有效候選');let value=Math.max(0,Math.min(.999999999,rng()))*total;return entries.find(e=>(value-=e.weight)<0)||entries.at(-1);}
 function owned(p,kind,id){const source=kind==='moves'?D.moves:D.skills,item=source[id];return kind==='moves'?Object.keys(p.moves||{}).some(key=>source[key]===item):(p.skills||[]).some(key=>source[key]===item);}
 function pool(id,rng=Math.random,options={}){const source=D.rewardPools[id];if(!source)throw Error('未知獎勵池');const entries=source.entries.filter(e=>(e.rewardIds.length&&(!options.type||e.rewardType===options.type))&&(!e.requirements?.minLevel||(options.level||1)>=e.requirements.minLevel));let entry=pick(entries,rng),ids=entry.rewardIds;if(options.preferUnowned&&options.permanent&&['moves','talents'].includes(entry.rewardType)){const candidates=entries.filter(e=>e.rewardType===entry.rewardType&&e.rarity===entry.rarity).map(e=>({...e,rewardIds:e.rewardIds.filter(id=>!owned(options.permanent,e.rewardType,id))})).filter(e=>e.rewardIds.length);if(candidates.length){entry=pick(candidates,rng);ids=entry.rewardIds;}}if(!ids.length)throw Error('空獎勵定義');return {kind:entry.rewardType,id:ids[Math.min(ids.length-1,Math.floor(rng()*ids.length))],rarity:entry.rarity,poolId:id};}
 function dungeon(id,rng=Math.random,options={}){const d=D.dungeons.find(d=>d.id===id);if(!d)throw Error('未知地下城');const rule=options.combination?d.rewardCombinationRules.find(r=>r.id===options.combination):pick(d.rewardCombinationRules,rng);if(!rule)throw Error('未知獎勵組合');const permanent=options.permanent?JSON.parse(JSON.stringify(options.permanent)):null;return {dungeonId:id,combination:rule.id,rewards:rule.draws.map(draw=>{const reward=pool(draw.pool,rng,{type:draw.type,level:options.level||d.level,permanent,preferUnowned:options.preferUnowned});if(permanent){if(reward.kind==='moves')permanent.moves[reward.id]=1;else if(reward.kind==='talents')permanent.skills.push(reward.id);}return reward;})};}
 function enemy(type,rng=Math.random,mapId=null,run=null){
  const e=D.monsters[type],map=D.maps?.[mapId],dropPool=map?.rewardPoolIds?.[0]||e?.dropPool;if(!dropPool)return [];
  const pity=D.balance.wildRewards?.pityBattles||Infinity,count=Math.max(0,Number(run?.wildRewardPity)||0),hit=count+1>=pity||rng()<(e?.dropChance||0);
  if(run)run.wildRewardPity=hit?0:count+1;
  return hit?[pool(dropPool,rng)]:[];
 }
 const api={owned,pick,pool,dungeon,enemy};if(typeof module!=='undefined')module.exports=api;else root.WorldRewards=api;
})(globalThis);
