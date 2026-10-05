/* Run-only discoveries, contracts, sealed books and stable dungeon encounters. */
(function(root){
 const D=typeof module!=='undefined'?require('./data'):root.GameData;
 const R=typeof module!=='undefined'?require('./map-routes'):root.MapRoutes;
 const copy=x=>JSON.parse(JSON.stringify(x)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const config={version:1,eventCountWeights:[.1,.3,.4,.2],emptyChance:.12,bookCountWeights:[.5,.45,.05],discoveryRadius:150,interactionRadius:80};
 const effects={
  shelter:{id:'shelter',name:'行旅庇護',description:'本局最大 HP +4%。',statRates:{hp:.04}},
  insight:{id:'insight',name:'靜心符文',description:'本局 MP 消耗 -4%。',combatModifiers:[{stage:'cost:mana',op:'multiply',value:.96}]},
  vigor:{id:'vigor',name:'復甦之息',description:'本局最大 SP +5%。',statRates:{stamina:.05}},
  mana_pact:{id:'mana_pact',name:'魔力契約',description:'本局最大 MP +10%，最大 SP -10%。',group:'capacity',statRates:{mana:.1,stamina:-.1}},
  stamina_pact:{id:'stamina_pact',name:'體能契約',description:'本局最大 SP +10%，最大 MP -10%。',group:'capacity',statRates:{stamina:.1,mana:-.1}},
  calm_pact:{id:'calm_pact',name:'沉穩契約',description:'本局 MP 消耗 -8%，所有招式讀條值 +5%。',group:'casting',combatModifiers:[{stage:'cost:mana',op:'multiply',value:.92},{stage:'attackTime',op:'multiply',value:1.05}]}
 };
 const definitions=[
  {id:'wayside',name:'旅人的遺贈',category:'positive',kind:'chest',effect:'shelter',text:'石匣裡留著一枚微暖的護符。帶上它，餘光將護佑這段旅程。'},
  {id:'rune',name:'靜心石碑',category:'positive',kind:'investigate',effect:'insight',text:'指尖掠過碑文，古老的詠唱方法逐漸清晰。'},
  {id:'spring',name:'復甦泉眼',category:'positive',kind:'spring',effect:'vigor',text:'泉水映著微光，一股溫暖的力量流入身體。'},
  {id:'mana_altar',name:'魔力祭壇',category:'exchange',kind:'altar',effect:'mana_pact',text:'祭壇願以體能換取魔力。契約持續至本輪冒險結束。'},
  {id:'stamina_altar',name:'體能祭壇',category:'exchange',kind:'altar',effect:'stamina_pact',text:'祭壇願以魔力換取體能。契約持續至本輪冒險結束。'},
  {id:'calm_altar',name:'沉穩祭壇',category:'exchange',kind:'altar',effect:'calm_pact',text:'放慢詠唱，節省魔力。是否接受這份有代價的祝福？'}
 ];
 let blocked=()=>false;
 const rngFor=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const hash=s=>[...s].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,917);
 const dungeonRules={version:1,first:{normal:[.5,.65],boss:.8},early:{normal:.6,elite:.55,boss:.65},earlyThrough:50,maxEarlyControl:1,maxLaterControl:2};
 function configureDungeons(){
  if(D.dungeonEncounterRules?.version===dungeonRules.version)return;
  D.dungeonEncounterRules=dungeonRules;
  for(const d of D.dungeons){
   if(d.training)continue;
   d.previousEnemyWaves=copy(d.enemyWaves);
   const map=D.maps[d.mapId],first=map?.sortOrder===0,early=d.recommendedLevel<=dungeonRules.earlyThrough,boss=d.enemyWaves.find(w=>w.role==='boss');
   if(!boss)continue;
   const normalTypes=map?.enemyPoolIds||[],normal=d.enemyWaves.find(w=>w.role==='normal')||{role:'normal',type:normalTypes[0],level:d.recommendedLevel};
   if(first){
    const count=d.dungeonType==='short'?1:2;
    d.enemyWaves=Array.from({length:count},(_,i)=>({...normal,type:normalTypes[i%normalTypes.length]||normal.type,level:Math.max(1,Math.round(d.recommendedLevel*dungeonRules.first.normal[i]))}));
    d.enemyWaves.push({...boss,level:Math.max(1,Math.round(d.recommendedLevel*dungeonRules.first.boss))});
   }else if(early){
    const elite=d.enemyWaves.find(w=>w.role==='elite');
    // Reserve the early control encounter for the boss; do not stack a control elite before it.
    const guard=elite&&pressure(boss.type).control&&pressure(elite.type).control?{...normal,type:normalTypes[1]||normal.type}:elite;
    d.enemyWaves=[{...normal,level:Math.max(1,Math.round(d.recommendedLevel*dungeonRules.early.normal))},...(guard?[{...guard,level:Math.max(1,Math.round(d.recommendedLevel*dungeonRules.early.elite))}]:[]),{...boss,level:Math.max(1,Math.round(d.recommendedLevel*dungeonRules.early.boss))}];
   }
   const last=d.enemyWaves.length-2;
   if(last>0&&pressure(boss.type).control&&d.enemyWaves[last].role==='elite'){
    const index=d.enemyWaves.findIndex((w,i)=>i<last&&w.role==='normal');
    if(index>=0)[d.enemyWaves[index],d.enemyWaves[last]]=[d.enemyWaves[last],d.enemyWaves[index]];
   }
   d.encounters=d.enemyWaves.map(w=>w.type);
   d.encounterTemplate=d.enemyWaves.map(w=>w.role);
  }
 }
 function pressure(type){
  const m=D.monsters[type],moves=m.moves.map(id=>D.moves[id]).filter(Boolean),skills=(m.skills||[]).map(id=>D.skills[id]).filter(Boolean);
  const control=moves.some(move=>move.effects.some(e=>e.type==='interrupt'||e.type==='freeze'||e.status?.id==='frozen'||e.status?.modifiers?.some(x=>x.stage==='attackTime'&&x.value>1)));
  const resistant=skills.some(s=>s.combatModifiers?.some(x=>x.stage==='incoming'&&x.value<.85)||s.targetElements&&s.incomingElementDamageReductionPct>=.2)||(m.physicalDefenseBonus||0)>=15||(m.magicResistanceBonus||0)>=15;
  return {control,resistant,heavy:(D.enemyBalance.species[m.sprite]||D.enemyBalance.species.default).hp>1.1};
 }
 const sample=(xs,r)=>xs[Math.min(xs.length-1,Math.floor(r()*xs.length))];
 function weighted(weights,r){let n=r()*weights.reduce((a,b)=>a+b,0);return weights.findIndex(w=>(n-=w)<0);}
 function point(map,quadrant,r,occupied){const w=map.width||D.world.width,h=map.height||D.world.height;for(let i=0;i<160;i++){const p={x:Math.round((quadrant%2)*w/2+180+r()*(w/2-360)),y:Math.round(Math.floor(quadrant/2)*h/2+180+r()*(h/2-360))};if(distance(p,map.entry)<700||R.safe(p,map)||blocked(p.x,p.y,map.id)||(map.deepPoints||[]).some(d=>distance(p,d)<180)||occupied.some(x=>distance(x,p)<180)||D.dungeons.some(d=>d.mapId===map.id&&distance(d,p)<180)||map.spawnPoints?.some(x=>distance(x,p)<90))continue;occupied.push(p);return p;}return null;}
 function dungeonPools(d){const map=D.maps[d.mapId];const pools={normal:[],elite:[]};for(const role of ['normal','elite']){const ids=[...new Set([...d.enemyWaves.filter(w=>w.role===role).map(w=>w.type),...(role==='normal'?map?.enemyPoolIds||[]:map?.elitePoolIds||[])])];pools[role]=ids.filter(id=>D.monsters[id]&&!D.monsters[id].boss&&(role==='elite'?D.monsters[id].elite:!D.monsters[id].elite));}return pools;}
 function stableWaves(d,r){
  const pools=dungeonPools(d),first=D.maps[d.mapId]?.sortOrder===0,early=d.recommendedLevel<=dungeonRules.earlyThrough,boss=d.enemyWaves.find(w=>w.role==='boss'),limit=early?dungeonRules.maxEarlyControl:dungeonRules.maxLaterControl;
  let previous=null,previousPressure={},controls=boss&&pressure(boss.type).control?1:0;
  let reservedElites=d.enemyWaves.filter(w=>w.role==='elite'&&(pools.elite||[]).every(id=>pressure(id).control)).length;
  return d.enemyWaves.map(w=>{
   if(w.role==='boss')return copy(w);
   if(w.role==='elite'&&(pools.elite||[]).every(id=>pressure(id).control))reservedElites--;
   const base=D.enemyBalance.species[D.monsters[w.type]?.sprite]||D.enemyBalance.species.default;
   let ids=(pools[w.role]||[]).filter(id=>{const s=D.enemyBalance.species[D.monsters[id].sprite]||D.enemyBalance.species.default;return s.hp/base.hp>=.7&&s.hp/base.hp<=1.4&&s.damage/s.cycle/(base.damage/base.cycle)>=.7&&s.damage/s.cycle/(base.damage/base.cycle)<=1.4;});
   const preferred=ids.filter(id=>{const p=pressure(id);return !(first&&p.control)&&!(p.control&&(controls+reservedElites>=limit||previousPressure.control))&&!(p.resistant&&previousPressure.resistant)&&!(p.heavy&&previousPressure.heavy);});
   // Regional pools are finite: choose the least stacking pressure if no strict candidate exists.
   if(preferred.length)ids=preferred;
   else ids.sort((a,b)=>{const score=id=>{const p=pressure(id);return +p.control*3+ +(p.resistant&&previousPressure.resistant)*2+ +(p.heavy&&previousPressure.heavy);};return score(a)-score(b);}),ids=ids.slice(0,1);
   if(ids.length>1&&ids.includes(previous))ids=ids.filter(id=>id!==previous);
   const type=ids.length?sample(ids,r):w.type;previous=type;previousPressure=pressure(type);controls+=+previousPressure.control;
   return {...copy(w),type};
  });
 }
 function ensure(run,options={}){if(!run||!D.mapData)return null;if(run.exploration?.version===config.version){
   const s=run.exploration;if(s.geometryRepair||s.routeVersion!==D.mapRouteVersion){const repair=(p,mapId)=>{if(!p||!blocked(p.x,p.y,mapId))return;for(let radius=24;radius<=240;radius+=24)for(let i=0;i<16;i++){const x=p.x+Math.cos(i*Math.PI/8)*radius,y=p.y+Math.sin(i*Math.PI/8)*radius;if(!blocked(x,y,mapId)){p.x=x;p.y=y;return;}}};for(const [mapId,m]of Object.entries(s.maps))for(const e of m.events)repair(e,mapId);for(const b of s.books){repair(b.start,b.mapId);repair(b.finish,b.mapId);for(const p of b.research)repair(p,b.mapId);}delete s.geometryRepair;s.routeVersion=D.mapRouteVersion;}return s;
  }
  const seed=Math.floor((options.rng||Math.random)()*4294967296)>>>0,s={version:config.version,routeVersion:D.mapRouteVersion,geometryVersion:D.mapGeometry?.version,seed,maps:{},dungeons:{},books:[],effects:[],history:[]};run.exploration=s;
  for(const map of D.mapData){if(map.starter)continue;const r=rngFor(seed^hash(map.id)),occupied=[],count=weighted(config.eventCountWeights,r),quadrants=[0,1,2,3].sort(()=>0);for(let i=3;i>0;i--){const j=Math.floor(r()*(i+1));[quadrants[i],quadrants[j]]=[quadrants[j],quadrants[i]];}let emptyPlaced=false;const events=[];for(const q of quadrants.slice(0,count)){const p=point(map,q,r,occupied);if(!p)continue;const empty=!emptyPlaced&&r()<config.emptyChance;if(empty)emptyPlaced=true;const category=r()<.5?'positive':'exchange',def=sample(definitions.filter(x=>x.category===category),r);events.push({id:map.id+'-event-'+q,mapId:map.id,quadrant:q,...p,definitionId:def.id,name:def.name,visual:def.kind,empty,state:'unseen',action:'調查'});}s.maps[map.id]={events};}
  s.dungeonPlanVersion=dungeonRules.version;
  for(const d of D.dungeons)s.dungeons[d.id]=run.dungeon?.id===d.id?copy(d.previousEnemyWaves||d.enemyWaves):stableWaves(d,rngFor(seed^hash(d.id)));
  const r=rngFor(seed^0x734ad9),bookCount=weighted(config.bookCountWeights,r),available=D.mapData.filter(m=>!m.starter);for(let i=0;i<bookCount&&available.length;i++){const map=sample(available,r);available.splice(available.indexOf(map),1);const ids=[...new Set(map.dungeonIds.flatMap(id=>{const d=D.dungeons.find(x=>x.id===id);return (d?.rewardPoolIds||[d?.primaryRewardPool,d?.secondaryRewardPool,d?.rareRewardPool]).flatMap(pid=>(D.rewardPools[pid]?.entries||[]).filter(e=>e.rewardType==='books').flatMap(e=>e.rewardIds));}))].filter(id=>D.books[id]);if(!ids.length)continue;const novel=ids.filter(id=>!options.permanent?.books?.includes(id)),bookId=sample(novel.length?novel:ids,r),occupied=s.maps[map.id].events.map(e=>({...e})),start=point(map,Math.floor(r()*4),r,occupied),finish=point(map,Math.floor(r()*4),r,occupied);if(!start||!finish)continue;const questType=sample(['hunt','elite','dungeon','research'],r),enemyType=questType==='elite'?map.elitePoolIds[0]:map.enemyPoolIds[0],target=questType==='hunt'?3:questType==='research'?2:1,research=[];if(questType==='research'){for(let n=0;n<2;n++){const p=point(map,Math.floor(r()*4),r,occupied);if(p)research.push({id:map.id+'-rubbing-'+n,...p});}if(research.length!==2)continue;}s.books.push({id:'sealed-book-'+i,mapId:map.id,bookId,questType,enemyType,dungeonId:map.dungeonIds[0],target,progress:0,state:'unseen',start,finish,research,visited:[],clue:`${['西北','東北','西南','東南'][(finish.x<(map.width||D.world.width)/2?0:1)+(finish.y<(map.height||D.world.height)/2?0:2)]}方有一座封印石匣；完成前置任務後才能開啟。`});}
  return s;
 }
 function waves(run,id){if(id===D.trainingDungeon?.id)return D.trainingDungeon.enemyWaves;return ensure(run)?.dungeons[id]||D.dungeons.find(d=>d.id===id)?.enemyWaves||[];}
 function sources(run){return (ensure(run)?.effects||[]).map(id=>effects[id]).filter(Boolean);}
 function statFactor(run,key){return sources(run).reduce((v,e)=>v*(1+(e.statRates?.[key]||0)),1);}
 function objects(run){if(run.training&&run.currentMapId==='tutorial_court')return D.training.objects(run);const s=ensure(run),map=D.maps[run?.currentMapId];if(!s||!map||map.starter)return [];const out=(s.maps[map.id]?.events||[]).filter(e=>e.state!=='done').map(e=>({...e,kind:'run-event'}));for(const b of s.books.filter(b=>b.mapId===map.id&&b.state!=='claimed')){if(['unseen','offered'].includes(b.state))out.push({id:b.id,...b.start,name:'殘卷石碑',visual:'clue',kind:'book-clue',action:'讀取'});if(b.state==='active'&&b.questType==='research')for(const p of b.research)if(!b.visited.includes(p.id))out.push({...p,name:'古代碑文',visual:'clue',kind:'book-research',bookQuestId:b.id,action:'拓印'});if(b.state==='ready')out.push({id:b.id+'-cache',...b.finish,name:'封印藏書',visual:'book',kind:'sealed-book',bookQuestId:b.id,action:'開啟'});}return out;}
 function nearby(run){return objects(run).filter(o=>distance(o,run.position)<config.interactionRadius).sort((a,b)=>distance(a,run.position)-distance(b,run.position))[0]||null;}
 function discover(run){let changed=false;for(const o of objects(run))if(distance(o,run.position)<config.discoveryRadius){if(o.kind==='run-event'){const e=run.exploration.maps[run.currentMapId].events.find(e=>e.id===o.id);if(e.state==='unseen'){e.state='seen';changed=true;}}else if(o.kind==='book-clue'){const b=run.exploration.books.find(b=>b.id===o.id);if(b.state==='unseen'){b.state='offered';changed=true;}}}return changed;}
 function event(run,id){return ensure(run)?.maps[run.currentMapId]?.events.find(e=>e.id===id);}
 function takeEvent(run,id){const e=event(run,id);if(!e||e.state==='done'||run.status!=='active'||distance(e,run.position)>=config.interactionRadius)return {ok:false,text:'請靠近事件地點。'};const def=definitions.find(d=>d.id===e.definitionId),fx=effects[def.effect],s=run.exploration;if(!e.empty&&s.effects.includes(fx.id))return {ok:false,text:'已獲得相同效果，本局不重複疊加。'};if(!e.empty){s.effects=s.effects.filter(id=>!fx.group||effects[id]?.group!==fx.group);s.effects.push(fx.id);}e.state='done';const text=e.empty?'這裡早已失去力量，調查後沒有發現任何收穫。':fx.description;s.history.push({kind:'event',id,name:def.name,text});return {ok:true,text,empty:e.empty,effect:fx};}
 function quest(run,id){return ensure(run)?.books.find(b=>b.id===id);}
 function accept(run,id){const b=quest(run,id);if(!b||b.mapId!==run.currentMapId||!['unseen','offered'].includes(b.state)||distance(b.start,run.position)>=config.interactionRadius)return false;b.state='active';return true;}
 function record(run,kind,value){const s=ensure(run);for(const b of s.books){if(b.state!=='active')continue;const match=kind==='kill'&&b.mapId===run.currentMapId&&['hunt','elite'].includes(b.questType)&&value.type===b.enemyType&&!run.dungeon&&!value.boss&&(b.questType==='elite'?!!value.elite&&!value.quick:!value.elite)||kind==='dungeon'&&b.questType==='dungeon'&&b.dungeonId===value;if(match){b.progress=Math.min(b.target,b.progress+1);if(b.progress>=b.target)b.state='ready';}}}
 function research(run,id){const o=nearby(run);if(!o||o.kind!=='book-research'||o.id!==id)return false;const b=quest(run,o.bookQuestId);if(b.visited.includes(id))return false;b.visited.push(id);b.progress=b.visited.length;if(b.progress>=b.target)b.state='ready';return true;}
 function collect(run,id){const b=quest(run,id);if(!b||b.state!=='ready'||b.mapId!==run.currentMapId||distance(b.finish,run.position)>=config.interactionRadius||!D.books[b.bookId])return null;b.state='claimed';run.exploration.history.push({kind:'book',id,name:D.books[b.bookId].name,text:'完成前置任務並取得藏書。'});return {kind:'books',id:b.bookId};}
 function taskText(b){if(b.questType==='research')return '依線索調查兩處古代碑文';if(b.questType==='dungeon')return '接下任務後通關 '+(D.dungeons.find(d=>d.id===b.dungeonId)?.name||b.dungeonId);return '接下任務後在此地圖'+(b.questType==='elite'?'正常擊敗菁英 ':'擊敗 ')+(D.monsters[b.enemyType]?.name||'指定魔物')+' '+b.target+' 次';}
 function bookHint(id){const ds=D.dungeons.filter(d=>(d.rewardPoolIds||[]).some(pid=>D.rewardPools[pid]?.entries.some(e=>e.rewardType==='books'&&e.rewardIds.includes(id))));const maps=[...new Set(ds.map(d=>D.maps[d.mapId]?.regionId).filter(Boolean))];return '地下城：'+(ds.map(d=>d.name).join('／')||'對應魔法書獎勵池')+'。稀有藏書可能出現在'+(maps.map(id=>D.regionById[id]?.name).join('／')||'正式地圖')+'；必須先找到線索並完成前置任務，每局不保證出現。';}
 const api={config,effects,definitions,dungeonRules,configureDungeons,pressure,ensure,waves,dungeonPools,sources,statFactor,objects,nearby,discover,event,takeEvent,quest,accept,record,research,collect,taskText,bookHint,setPositionValidator:fn=>blocked=fn};if(typeof module!=='undefined')module.exports=api;else root.RunExploration=api;
})(globalThis);
