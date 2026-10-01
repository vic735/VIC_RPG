/* Permanent collection, rotating inventory and run-earned currency. */
(function(root){
 const D=typeof module!=='undefined'?require('./data'):root.GameData;
 const PERIOD=12*60*60*1000;
 const tiers=[{clears:0,slots:3},{clears:1,slots:4},{clears:3,slots:5},{clears:6,slots:6}];
 const catalog=[];
 if(typeof module!=='undefined')require('./content-v1');
 function add(kind,ids,tier,price){for(const id of ids)if((kind==='moves'?D.moves:D.skills)[id])catalog.push({key:kind+':'+id,kind,id,tier,price});}
 add('moves',['spark','heavy','interrupt','flame_bolt','root_trap','lesser_heal','smoke'],0,16);
 add('skills',['economy','swift','fortunate','fast_cast','mana_guard'],0,12);
 add('moves',['freeze','haste','protect','light_arrow','double_slash','water_0'],1,24);
 add('skills',['quick_master','counter','mana_cycle','fire_affinity','water_affinity'],1,22);
 add('moves',['lightning_whip','wind_slash','flame_enchant','earth_0'],2,32);
 add('skills',['mana_reclaim','chill','earth_body','adapt'],2,30);
 add('moves',['metal_1','wood_1','light_1','dark_1'],3,40);
 add('skills',['lightning_refund','holy_echo','stamina_cycle'],3,36);
 catalog.splice(0,catalog.length);for(const [id,d] of Object.entries(D.moves))if(d.contentId&&d.shopEligible&&!catalog.some(c=>c.key==='moves:'+id))catalog.push({key:'moves:'+id,kind:'moves',id,tier:Math.max(0,(d.shopTier||1)-1),price:d.shopCost||90});for(const [id,d] of Object.entries(D.skills))if(d.contentId&&d.shopEligible&&!catalog.some(c=>c.key==='skills:'+id))catalog.push({key:'skills:'+id,kind:'skills',id,tier:Math.max(0,(d.shopTier||1)-1),price:d.shopCost||90});
 const safe=n=>Number.isSafeInteger(n)&&n>=0?n:0;
 function normalize(p){const old=p.meta||{};p.meta={...old,revision:safe(old.revision),marks:safe(old.marks),earned:safe(old.earned),runs:safe(old.runs),seenMonsters:[...new Set((old.seenMonsters||[]).filter(id=>D.monsters[id]))],defeatedMonsters:[...new Set((old.defeatedMonsters||[]).filter(id=>D.monsters[id]))],foundDungeons:[...new Set((old.foundDungeons||[]).filter(id=>D.dungeons.some(d=>d.id===id)))],enteredDungeons:[...new Set((old.enteredDungeons||[]).filter(id=>D.dungeons.some(d=>d.id===id)))]};return p.meta;}
 function tier(p){const n=Object.values(p.dungeonCompletions||{}).filter(v=>v>0).length;return {...tiers.findLast(t=>n>=t.clears),index:tiers.findLastIndex(t=>n>=t.clears),count:n};}
 function actualId(item){const source=item.kind==='moves'?D.moves:D.skills;return source[item.id]?item.id:Object.values(source).find(x=>x.contentId===item.id)?.id||item.id;}
 function owned(p,item){const id=actualId(item);return item.kind==='moves'?!!p.moves[id]:p.skills.includes(id);}
 function stock(p,now=Date.now()){
  const m=normalize(p),t=tier(p),epoch=Math.floor(now/PERIOD),old=m.shop;
  // Clock rollback cannot bring an older inventory back. Purchases stay in place.
  if(old&&Number.isSafeInteger(old.epoch)&&old.epoch>=epoch&&Array.isArray(old.items)&&old.items.every(k=>catalog.some(c=>c.key===k))){if(old.tier===t.index)return old;}
  const current=Math.max(epoch,old?.epoch||0),pool=catalog.filter(c=>c.tier<=t.index&&!owned(p,c));
  let seed=(current^0x73a419)^t.index;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const chosen=[];for(const kind of ['moves','skills']){const c=pool.find(x=>x.kind===kind);if(c)chosen.push(c);}for(const c of pool)if(chosen.length<t.slots&&!chosen.includes(c))chosen.push(c);
  m.shop={epoch:current,tier:t.index,items:chosen.map(c=>c.key),bought:[]};m.revision++;return m.shop;
 }
 function buy(p,key,epoch,now=Date.now()){
  const shop=stock(p,now),item=catalog.find(c=>c.key===key),m=p.meta;
  if(shop.epoch!==Number(epoch))return {ok:false,message:'商品已刷新，請查看新庫存。'};
  if(!item||!shop.items.includes(key)||item.tier>tier(p).index)return {ok:false,message:'此商品目前未上架。'};
  if(owned(p,item)||shop.bought.includes(key))return {ok:false,message:'已永久解鎖。'};
  if(m.marks<item.price)return {ok:false,message:'旅者徽記不足。'};
  m.marks-=item.price;m.revision++;shop.bought.push(key);
  const actual=actualId(item);if(item.kind==='moves')p.moves[actual]=1;else if(!p.skills.includes(actual))p.skills.push(actual);
  return {ok:true,item};
 }
 function ledger(run){return run.metaRewards||=( {combat:0,exploration:0,dungeons:0,clears:[],settled:false,total:0} );}
 const monsterId=id=>({'opening_mine_normal_0':'greywind_0','opening_mine_normal_1':'greywind_1','opening_mine_elite_2':'greywind_elite','opening_mine_boss_3':'abandoned_mine_boss'}[id]||id);
 function encounter(p,id,won=false,run=null){const m=normalize(p),key=monsterId(id);if(!D.monsters[key])return;if(!m.seenMonsters.includes(key))m.seenMonsters.push(key);if(won){if(!m.defeatedMonsters.includes(key))m.defeatedMonsters.push(key);if(run&&!ledger(run).settled){const d=D.monsters[id];ledger(run).combat+=d.boss?12:d.elite?6:2;}}m.revision++;}
 function discover(p,run){const m=normalize(p);let changed=false;for(const id of run.world.discoveredDungeons||[])if(!m.foundDungeons.includes(id)){m.foundDungeons.push(id);if(!ledger(run).settled)ledger(run).exploration+=5;changed=true;}if(changed)m.revision++;return changed;}
 function enter(p,id){const m=normalize(p);if(!m.enteredDungeons.includes(id)){m.enteredDungeons.push(id);m.revision++;}}
 function clear(p,run,id){const r=ledger(run);if(!r.settled&&!r.clears.includes(id)){r.clears.push(id);r.dungeons+=20;}enter(p,id);}
 function settle(p,run){const r=ledger(run);if(r.settled)return r.total;discover(p,run);const m=normalize(p);r.total=r.combat+r.exploration+r.dungeons;r.settled=true;m.marks+=r.total;m.earned+=r.total;m.runs++;m.revision++;return r.total;}
 function starterEligible(p){return normalize(p).starterRewardLocked!==true;}
 function completeStarterCycle(p,run){if(run.status!=='failed'||run.deaths<3||run.endedVoluntarily||run.starterRewardCycleCompleted)return false;run.starterRewardCycleCompleted=true;const m=normalize(p);m.starterRewardLocked=false;m.revision++;return true;}
 function claimStarter(p,rng=Math.random){if(!starterEligible(p))return null;const pools=['moves','talents'].map(kind=>({kind,items:[...new Set(Object.values(kind==='moves'?D.moves:D.skills))].filter(x=>x.powerGrade==='C'&&x.contentScope!=='classExclusive'&&x.kind!=='ultimate'&&(kind==='moves'?!Object.keys(p.moves).some(id=>D.moves[id]===x):!p.skills.some(id=>D.skills[id]===x)))})).filter(x=>x.items.length);const m=normalize(p);m.starterRewardLocked=true;m.revision++;if(!pools.length){m.marks+=5;m.earned+=5;return {kind:'marks',id:'starter-compensation',amount:5,isNew:false};}const pool=pools[Math.min(pools.length-1,Math.floor(rng()*pools.length))],item=pool.items[Math.min(pool.items.length-1,Math.floor(rng()*pool.items.length))];return {kind:pool.kind,id:item.id};}
 function collection(p){const m=normalize(p),moves=new Set(D.startingMoves),skills=new Set(D.startingSkills);
  for(const pool of Object.values(D.rewardPools))for(const e of pool.entries){if(e.rewardType==='moves')e.rewardIds.forEach(id=>moves.add(id));if(e.rewardType==='talents')e.rewardIds.forEach(id=>skills.add(id));}
  for(const b of Object.values(D.books))moves.add(b.moveId);for(const c of catalog)(c.kind==='moves'?moves:skills).add(c.id);Object.keys(p.moves).forEach(id=>moves.add(id));for(const id of p.skills)skills.add(id);for(const id of p.ultimates||[])moves.add(id);
  for(const x of Object.values(D.moves))if(x.contentScope==='classExclusive')moves.add(x.id);for(const x of Object.values(D.skills))if(x.contentScope==='classExclusive')skills.add(x.id);
  const enemyIds=new Set([...D.enemySpawnData.map(e=>monsterId(e.type)),...D.dungeons.flatMap(d=>d.enemyWaves.map(w=>monsterId(w.type)))]);
  function hint(kind,id){const source=kind==='moves'?D.moves:D.skills,item=source[id],ds=D.dungeons.filter(d=>d.rewardPoolIds?.some(pid=>D.rewardPools[pid]?.entries.some(e=>e.rewardType===(kind==='moves'?'moves':'talents')&&e.rewardIds.some(key=>source[key]===item))));const c=catalog.find(c=>c.kind===kind&&source[c.id]===item),parts=[];if(ds.length)parts.push('地下城：'+ds.map(d=>d.name).join('／'));if(c)parts.push(`旅者商店：通關 ${tiers[c.tier].clears} 座不同地下城後可能上架`);if(kind==='moves'){const books=Object.values(D.books).filter(b=>D.moves[b.moveId]===item);if(books.length)parts.push('研讀魔法書：'+books.map(b=>b.name).join('／')+'；野外藏書稀有且必須完成前置任務');}return parts.join('。')||'探索世界與地下城，或完成對應職業成就';}
  const moveRows=[...moves].filter(id=>D.moves[id]).map(id=>({id,data:D.moves[id],known:!!p.moves[id]||!!p.ultimateUnlocked&&(p.ultimates||[]).includes(id),hint:hint('moves',id)}));
  const skillRows=[...skills].filter(id=>D.skills[id]).map(id=>({id,data:D.skills[id],known:p.skills.includes(id),hint:hint('skills',id)}));
  const books=Object.values(D.books).map(data=>({id:data.id,data,known:p.books.includes(data.id),hint:(typeof module!=='undefined'?require('./run-exploration'):root.RunExploration).bookHint(data.id)}));
  const equipment=Object.values(D.equipment).map(data=>({id:data.id,data,known:p.equipment.includes(data.id),hint:data.acquisitionTier==='easy'?'前期地下城或初始裝備':data.sourceDungeons?.length?'探索 '+data.sourceDungeons.map(id=>D.dungeons.find(d=>d.id===id)?.name).filter(Boolean).join('／'):'探索地下城裝備池'}));
  const statusMap=new Map();for(const row of moveRows)for(const e of row.data.effects||[])if(e.status){const x=statusMap.get(e.status.id)||{data:e.status,sources:[],known:false};x.sources.push(row.data.name);x.known||=row.known;statusMap.set(e.status.id,x);}for(const row of skillRows)for(const h of row.data.hooks||[])for(const e of h.effects||[])if(e.status){const x=statusMap.get(e.status.id)||{data:e.status,sources:[],known:false};x.sources.push(row.data.name);x.known||=row.known;statusMap.set(e.status.id,x);}
  for(const row of moveRows)for(const e of row.data.effects||[])if(e.type==='freeze'){const x=statusMap.get('frozen')||{data:{id:'frozen',name:'凍結',polarity:'debuff',duration:e.duration,blocksAction:true},sources:[],known:false};x.sources.push(row.data.name);x.known||=row.known;statusMap.set('frozen',x);}
  const statuses=[...statusMap.entries()].map(([id,x])=>({id,data:{...x.data,description:(x.data.polarity==='buff'?'Buff':'Debuff')+' · 來源：'+[...new Set(x.sources)].join('、')},known:x.known,hint:'先取得能施加這個狀態的招式或技能'}));
  return {moves:moveRows,skills:skillRows,books,equipment,statuses,monsters:[...enemyIds].map(id=>({id,data:D.monsters[id],known:m.seenMonsters.includes(id),complete:m.defeatedMonsters.includes(id),hint:'探索各地野外與地下城'})),dungeons:D.dungeons.map(d=>({id:d.id,data:d,known:m.foundDungeons.includes(d.id)||m.enteredDungeons.includes(d.id)||(p.dungeonCompletions?.[d.id]||0)>0,complete:(p.dungeonCompletions?.[d.id]||0)>0,entered:m.enteredDungeons.includes(d.id),hint:'探索世界地圖，尋找未知入口'}))};
 }
 const api={starterEligible,claimStarter,completeStarterCycle,PERIOD,tiers,catalog,normalize,tier,stock,buy,ledger,encounter,discover,enter,clear,settle,collection};if(typeof module!=='undefined')module.exports=api;else root.GameMeta=api;
})(globalThis);
