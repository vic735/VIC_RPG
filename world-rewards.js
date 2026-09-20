(function(root){
 const D=typeof module!=='undefined'?require('./data.js'):root.GameData;
 function pick(entries,rng){const total=entries.reduce((n,e)=>n+e.weight,0);if(!entries.length||total<=0)throw Error('獎勵池沒有有效候選');let value=Math.max(0,Math.min(.999999999,rng()))*total;return entries.find(e=>(value-=e.weight)<0)||entries.at(-1);}
 function pool(id,rng=Math.random,options={}){const source=D.rewardPools[id];if(!source)throw Error('未知獎勵池');const entries=source.entries.filter(e=>(!options.type||e.rewardType===options.type)&&(!e.requirements?.minLevel||(options.level||1)>=e.requirements.minLevel));const entry=pick(entries,rng),ids=entry.rewardIds;if(!ids.length)throw Error('空獎勵定義');return {kind:entry.rewardType,id:ids[Math.min(ids.length-1,Math.floor(rng()*ids.length))],rarity:entry.rarity,poolId:id};}
 function dungeon(id,rng=Math.random,options={}){const d=D.dungeons.find(d=>d.id===id);if(!d)throw Error('未知地下城');const rule=options.combination?d.rewardCombinationRules.find(r=>r.id===options.combination):pick(d.rewardCombinationRules,rng);if(!rule)throw Error('未知獎勵組合');return {dungeonId:id,combination:rule.id,rewards:rule.draws.map(draw=>pool(draw.pool,rng,{type:draw.type,level:options.level||d.level}))};}
 function enemy(type,rng=Math.random){const e=D.monsters[type];return e?.dropPool&&rng()<(e.dropChance||0)?[pool(e.dropPool,rng)]:[];}
 const api={pick,pool,dungeon,enemy};if(typeof module!=='undefined')module.exports=api;else root.WorldRewards=api;
})(globalThis);
