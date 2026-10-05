/* Data-driven Run map routes. Existing combat and dungeon records keep their IDs. */
(function(root){
 const D=typeof module!=='undefined'?require('./data.js'):root.GameData;
 const R=typeof module!=='undefined'?require('./map-routes'):root.MapRoutes;
 const rows=[
  ['north_plains','北之平原','泛用、無屬性與基礎戰鬥','greywind','meadow','#46513e',['泛用','無屬性','物理','純魔法'],['無屬性','物理'],[[1,20],[20,40],[40,65],[70,95],[105,130]],[]],
  ['northern_kingdom','北方國度','冰與雷交錯的長詠唱國度','froststorm','frost','#52656b',['水','金','冰','雷','中斷'],['水','金'],[[1,20],[30,60],[70,100],[110,140],[145,175]],['frozen_tower','thunder_workshop']],
  ['mirewood','秘林沼澤','木與水交纏，重視控制和續戰','verdant','wetland','#244c43',['木','水','控制','持續傷害'],['木','水'],[[1,20],[30,55],[60,85],[95,125],[135,165]],['root_cave','sunken_temple']],
  ['central_mines','中央山礦','礦脈、重擊與堅實防禦','redrift','volcanic','#684339',['土','金','物理','重擊','防禦'],['土','金'],[[1,20],[25,50],[55,80],[85,115],[125,155]],['abandoned_mine','lava_vein','giant_ruins']],
  ['dark_empire','暗黑帝國','闇與光的高風險混合路線','obsidian','obsidian','#363247',['闇','光','雙屬性','Debuff'],['闇','光'],[[1,20],[35,65],[80,110],[120,150],[160,190]],['blacklight_chapel','element_abyss','terminal_structure']],
  ['southern_kingdom','南方國度','火與光的魔法、防護與治療','redrift','volcanic','#795044',['火','光','魔法','治療','防護'],['火','光'],[[1,20],[25,50],[60,90],[100,130],[140,165]],['old_lab']],
  ['southern_forest','南之森林','敏捷、木系與弓術的路線','verdant','wetland','#35543b',['木','弓','敏捷','暴擊'],['木'],[[1,20],[20,45],[50,75],[80,105],[115,140]],[]]
 ];
 const dungeonMap={abandoned_mine:1,old_lab:1,root_cave:2,sunken_temple:2,lava_vein:3,giant_ruins:4,frozen_tower:4,thunder_workshop:4,blacklight_chapel:5,element_abyss:5,terminal_structure:5};
 const legacyToRegion={greywind:'north_plains',verdant:'mirewood',redrift:'central_mines',froststorm:'northern_kingdom',obsidian:'dark_empire'};
 const geometry={version:1,areaRatio:.75,scale:Math.sqrt(.75),originalWidth:D.world.width,originalHeight:D.world.height};
 D.mapGeometry=geometry;D.world.width*=geometry.scale;D.world.height*=geometry.scale;
 for(const road of D.world.roads)for(const p of road){p.x*=geometry.scale;p.y*=geometry.scale;}
 const layoutVersion=8,safeRadius=R.rules.centerSafeRadius,sharedEntry={x:D.world.width/2,y:D.world.height/2};D.world.camp={...sharedEntry};
 const progressionBands=[[10,25],[25,80],[80,250],[250,600],[600,999]],eliteBands=[[20,30],[60,100],[200,300],[500,700],[850,999]];
 D.mapAccessRules={2:{rank:'B'},3:{rank:'A',previousDungeonMap:2},4:{rank:'S',previousDungeonMap:3}};
 const regions=[],maps=[];
 for(const [sortOrder,row] of rows.entries()){
  const [id,name,description,legacyId,environmentId,color,themeTags,elementTendencies,levels,dungeonIds]=row;
  const legacy=D.world.regions.find(r=>r.id===legacyId);
  const region={id,name,description,mapIds:[],themeTags:[...themeTags],elementTendencies:[...elementTendencies],rewardTendencies:[...themeTags],sortOrder,uiPosition:{column:sortOrder%2,row:Math.floor(sortOrder/2)},color,environmentId,legacyRegionId:legacyId};
  for(const [index,[recommendedLevelMin,recommendedLevelMax]] of progressionBands.entries()){
   const mapId=id+'_'+(index+1),assigned=dungeonIds.filter(d=>dungeonMap[d]===index+1),rewardPoolId=mapId+'_field';
   const source=D.rewardPools[legacyId+'_field'];
   D.rewardPools[rewardPoolId]={id:rewardPoolId,entries:JSON.parse(JSON.stringify(source?.entries||[]))};
   const map={id:mapId,regionId:id,name:index===0?name+'・起始地圖':name+'・地圖 '+(index+1),description:index===0?description:description+'，可依目前實力選擇挑戰。',recommendedLevelMin,recommendedLevelMax,dangerTier:index+1,enemyPoolIds:[...legacy.enemyPools],elitePoolIds:[...legacy.elitePools],dungeonIds:assigned,rewardPoolIds:[rewardPoolId],elementTendencies:[...elementTendencies],gameplayTags:[...themeTags],environmentId,isAvailable:true,sortOrder:index,entry:{...sharedEntry},color};
   map.finalLevelScale=true;map.eliteLevelRange=eliteBands[index];region.mapIds.push(mapId);maps.push(map);
  }
  regions.push(region);
 }
 // Each map has a local encounter layout and a reachable dungeon entrance.
 const routes={north_plains:['abandoned_mine','荒原哨站'],northern_kingdom:['frozen_tower','霜雷哨塔'],mirewood:['root_cave','幽根密窟'],central_mines:['giant_ruins','深岩試煉所'],dark_empire:['blacklight_chapel','暮影祭壇'],southern_kingdom:['old_lab','餘燼法陣'],southern_forest:['root_cave','獵風古穴']};
 for(const map of maps){
  if(!map.dungeonIds.length){
   const [themeTemplate,name]=routes[map.regionId],level=map.sortOrder===0?12:Math.round(map.recommendedLevelMin+(map.recommendedLevelMax-map.recommendedLevelMin)*.65);
   const template=D.dungeons.find(d=>d.id===(level<25?(map.regionId==='southern_kingdom'?'old_lab':'abandoned_mine'):themeTemplate));
   const dungeon=JSON.parse(JSON.stringify(template));dungeon.id=map.id+'_dungeon';dungeon.name=name+'・'+(map.sortOrder+1);dungeon.level=dungeon.recommendedLevel=level;dungeon.generatedMapDungeon=true;dungeon.templateId=template.id;dungeon.features=[...map.gameplayTags];dungeon.description=map.name+'的區域試煉。';
   dungeon.enemyWaves=dungeon.enemyWaves.map((w,i)=>({...w,type:w.role==='normal'?map.enemyPoolIds[i%map.enemyPoolIds.length]:w.role==='elite'?map.elitePoolIds[0]:w.type,level:Math.max(1,level+(w.role==='boss'?1:w.role==='normal'?-2:0))}));dungeon.encounters=dungeon.enemyWaves.map(w=>w.type);
   const poolAliases={};for(const key of ['primaryRewardPool','secondaryRewardPool','rareRewardPool']){const old=dungeon[key],id=dungeon.id+'_'+key;D.rewardPools[id]=JSON.parse(JSON.stringify(D.rewardPools[old]));D.rewardPools[id].id=id;poolAliases[old]=id;dungeon[key]=id;const types=key==='primaryRewardPool'?['moves','talents']:key==='secondaryRewardPool'?['equipment','books']:['moves','talents','equipment','books'];for(const type of types)if(!D.rewardPools[id].entries.some(e=>e.rewardType===type))D.rewardPools[id].entries.push({rewardType:type,rewardIds:[],weight:1,rarity:key==='rareRewardPool'?'rare':'normal'});}for(const rule of dungeon.rewardCombinationRules)for(const draw of rule.draws)draw.pool=poolAliases[draw.pool]||draw.pool;
   D.dungeons.push(dungeon);map.dungeonIds.push(dungeon.id);
  }
  map.dungeonIds.forEach((id,index)=>{const d=D.dungeons.find(d=>d.id===id);d.mapId=map.id;d.regionId=regions.find(r=>r.id===map.regionId).legacyRegionId;const angle=-Math.PI/4+index*Math.PI*2/map.dungeonIds.length;d.x=map.entry.x+Math.cos(angle)*560;d.y=map.entry.y+Math.sin(angle)*560;});
  for(const id of map.dungeonIds){const d=D.dungeons.find(d=>d.id===id);d.rewardReferenceLevel=d.generatedMapDungeon?[12,38,85,130,175][map.sortOrder]:d.level;d.finalLevelScale=true;d.recommendedLevel=d.level=map.sortOrder===0?Math.max(map.recommendedLevelMin,Math.min(map.recommendedLevelMax,d.level)):id==='terminal_structure'?999:Math.round(map.recommendedLevelMin+(map.recommendedLevelMax-map.recommendedLevelMin)*.65);for(const wave of d.enemyWaves)wave.level=Math.min(999,Math.max(map.recommendedLevelMin,d.level+(wave.role==='boss'?1:wave.role==='normal'?-2:0)));}
  R.configure(map,map.dungeonIds.map(id=>D.dungeons.find(d=>d.id===id)),D.world.width,D.world.height);map.spawnPoints=R.layout(map);
 }
 D.mapRouteVersion=2;D.regionData=regions;D.mapData=maps;D.maps=Object.fromEntries(maps.map(m=>[m.id,m]));D.regionById=Object.fromEntries(regions.map(r=>[r.id,r]));
 if(D.contentGrades&&D.contentDistribution){if(typeof module!=='undefined')require('./content-grades')(D);else root.ContentGrades(D);const redistribute=typeof module!=='undefined'?require('./resource-distribution'):root.ResourceDistribution;redistribute(D);}
 const starterConfig={layoutVersion:3,enemyCount:18,safeRadius:360,ringSpacing:240,areaRatio:.25,levelCap:9,expMultiplier:4,bossHpMultiplier:2.6,bossDamageMultiplier:.65};
 const starterMaps=regions.map(region=>{const source=D.maps[region.mapIds[0]],width=geometry.originalWidth*Math.sqrt(starterConfig.areaRatio),height=geometry.originalHeight*Math.sqrt(starterConfig.areaRatio),map={...source,id:'starter_'+region.id,name:region.name+'・試煉之境',starter:true,route:null,deepPoints:[],width,height,entry:{x:width/2,y:height/2},recommendedLevelMin:1,recommendedLevelMax:8,dungeonIds:[],elitePoolIds:[],spawnPoints:[]};
  for(let i=0;i<starterConfig.enemyCount;i++){const ring=Math.floor(i/6),angle=(i%6)*Math.PI/3+ring*Math.PI/6,radius=starterConfig.safeRadius+ring*starterConfig.ringSpacing;map.spawnPoints.push({x:map.entry.x+Math.cos(angle)*radius,y:map.entry.y+Math.sin(angle)*radius,level:Math.min(8,1+Math.floor(i*8/starterConfig.enemyCount)),elite:false});}
  const bossId=map.id+'_guardian',template=D.monsters[source.enemyPoolIds[1]||source.enemyPoolIds[0]];D.monsters[bossId]={...template,id:bossId,name:region.name+'守關者',boss:true,moves:['goblin','crush'],skills:[],behavior:'neutral',radius:0,worldScale:1.65,labelHeight:88,dropChance:0};map.bossType=bossId;
  D.maps[map.id]=map;return map;
 });
 function startStarter(run,rng=Math.random){const map=starterMaps[Math.min(starterMaps.length-1,Math.floor(rng()*starterMaps.length))];run.starter={version:1,mapId:map.id,phase:'training',bossId:map.id+'-boss'};run.currentMapId=map.id;run.position={...map.entry};run.mapPositions={};run.mapLayoutVersion=layoutVersion;run.mapGeometryVersion=geometry.version;run.world.enemies=[];run.adventurerRank.index=-1;ensureRun(run);return map;}
 function syncStarter(run){const s=run.starter;if(!s||run.currentMapId!==s.mapId)return;if(s.phase==='cleared'){run.world.enemies=run.world.enemies.filter(e=>e.mapId!==s.mapId);return;}if(run.training&&run.training.stage<7)return;if(run.level>=starterConfig.levelCap){run.level=starterConfig.levelCap;run.exp=0;s.phase='boss';if(!run.world.enemies.some(e=>e.id===s.bossId)){const map=D.maps[s.mapId],x=map.entry.x,y=map.entry.y-210;run.world.enemies.push({id:s.bossId,mapId:map.id,regionId:map.regionId,type:map.bossType,level:9,boss:true,role:'boss',quickBattleAllowed:false,x,y,homeX:x,homeY:y,discovered:true,defeatedUntil:0});}}}
 function clearStarter(run,enemy){const s=run.starter;if(!s||s.phase!=='boss'||enemy.id!==s.bossId||enemy.type!==D.maps[s.mapId].bossType)return false;s.phase='cleared';run.world.enemies=run.world.enemies.filter(e=>e.mapId!==s.mapId);const rank=run.adventurerRank;rank.index=1;rank.progress=0;rank.normalKills=rank.challengeKills=0;rank.last={kills:run.battleStats.kills,dungeons:run.battleStats.clearedDungeonIds.length,level:run.level};rank.history.push({from:'D',to:'C−',route:'starter'});return true;}
 function inferLegacy(run){
  const dungeon=D.dungeons.find(d=>d.id===run.dungeon?.id);if(dungeon?.mapId)return dungeon.mapId;
  const legacy=D.world.regions.find(r=>run.position.x>=r.bounds[0]&&run.position.x<r.bounds[0]+r.bounds[2]&&run.position.y>=r.bounds[1]&&run.position.y<r.bounds[1]+r.bounds[3])||D.world.regions[0];
  return legacyToRegion[legacy.id]+'_1';
 }
 function migrateGeometry(run){
  if(run.mapGeometryVersion===geometry.version)return;
  const scalePoint=p=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){p.x=Math.max(35,Math.min(D.world.width-35,p.x*geometry.scale));p.y=Math.max(35,Math.min(D.world.height-35,p.y*geometry.scale));}};
  if(!D.maps[run.currentMapId]?.starter)scalePoint(run.position);
  for(const [id,p]of Object.entries(run.mapPositions||{}))if(!D.maps[id]?.starter)scalePoint(p);
  run.world.enemies=run.world.enemies.filter(e=>{const map=D.maps[e.mapId];if(!map||map.starter)return true;if(e.id?.includes('-patrol-')){const point=map.spawnPoints[Number(e.id.split('-patrol-')[1])];if(!point)return false;Object.assign(e,{x:point.x,y:point.y,homeX:point.x,homeY:point.y,level:point.level,elite:point.elite});}else{scalePoint(e);const home={x:e.homeX,y:e.homeY};scalePoint(home);e.homeX=home.x;e.homeY=home.y;}return true;});
  if(run.exploration?.geometryVersion!==geometry.version){
  for(const state of Object.values(run.exploration?.maps||{}))for(const e of state.events||[])scalePoint(e);
  for(const b of run.exploration?.books||[]){scalePoint(b.start);scalePoint(b.finish);for(const p of b.research||[])scalePoint(p);}
  if(run.exploration){run.exploration.geometryRepair=true;run.exploration.geometryVersion=geometry.version;}
  }
  run.mapGeometryVersion=geometry.version;

 }
 function migrateRouteLayout(run){
  if(run.mapLayoutVersion!==layoutVersion){
   const hadLayout=Number.isFinite(run.mapLayoutVersion);
   run.world.enemies=run.world.enemies.filter(e=>{const map=D.maps[e.mapId];if(!map?.route)return true;if(!e.id?.includes('-patrol-'))return !/^enemy-\d+$/.test(e.id)||e.specialEvent||e.boss;const point=map.spawnPoints[Number(e.id.split('-patrol-')[1])];if(!point)return false;Object.assign(e,{x:point.x,y:point.y,homeX:point.x,homeY:point.y,level:point.level,elite:point.elite,section:point.section,type:(point.elite?map.elitePoolIds:map.enemyPoolIds)[Number(e.id.split('-patrol-')[1])%(point.elite?map.elitePoolIds:map.enemyPoolIds).length]});return true;});
   if(!hadLayout&&!D.maps[run.currentMapId]?.starter){run.position={...D.maps[run.currentMapId].entry};run.mapPositions||={};}
   run.mapLayoutVersion=layoutVersion;
  }
  run.world.discoveredDeepPoints||=[];
 }
 function ensureRun(run){
  if(run.training&&run.currentMapId==='tutorial_court'){D.training.ensure(run);return run;}
  migrateGeometry(run);
  if(run.starter&&run.currentMapId===run.starter.mapId){migrateRouteLayout(run);run.mapPositions||={};const map=D.maps[run.currentMapId];if(run.starter.layoutVersion!==starterConfig.layoutVersion){if(run.starter.layoutVersion===2){const scale=Math.SQRT1_2;run.position={x:Math.max(35,Math.min(map.width-35,run.position.x*scale)),y:Math.max(35,Math.min(map.height-35,run.position.y*scale))};run.mapPositions[map.id]={...run.position};const boss=run.world.enemies.find(e=>e.id===run.starter.bossId);if(boss)Object.assign(boss,{x:map.entry.x,y:map.entry.y-210,homeX:map.entry.x,homeY:map.entry.y-210});}run.world.enemies=run.world.enemies.filter(e=>{if(e.mapId!==map.id||e.id===run.starter.bossId)return true;const index=Number(e.id.split('-patrol-')[1]),point=map.spawnPoints[index];if(!point)return false;Object.assign(e,{x:point.x,y:point.y,homeX:point.x,homeY:point.y,level:point.level});return true;});run.starter.layoutVersion=starterConfig.layoutVersion;}if(run.starter.phase!=='cleared')populate(run,map);syncStarter(run);return run;}
  run.currentMapId=D.maps[run.currentMapId]?run.currentMapId:inferLegacy(run);
  migrateRouteLayout(run);
  run.mapPositions||={};run.mapPositions[run.currentMapId]||={...run.position};
  run.availableMoves=[...new Set([...(run.availableMoves||[]),...run.build.moves,run.build.ultimate,...Object.values(run.loot||{}).filter(r=>r.kind==='moves').map(r=>r.id)].filter(id=>D.moves[id]))];
  run.availableSkills=[...new Set([...(run.availableSkills||[]),...run.build.talents,...Object.values(run.loot||{}).filter(r=>r.kind==='talents').map(r=>r.id)].filter(id=>D.skills[id]))];
  for(const enemy of run.world.enemies){
   if(D.maps[enemy.mapId])continue;
   const legacy=enemy.regionId||D.world.regions.find(r=>enemy.x>=r.bounds[0]&&enemy.x<r.bounds[0]+r.bounds[2]&&enemy.y>=r.bounds[1]&&enemy.y<r.bounds[1]+r.bounds[3])?.id;
   const region=D.regionById[legacyToRegion[legacy]||'north_plains'];
   const nearest=region.mapIds.map(id=>D.maps[id]).sort((a,b)=>Math.max(a.recommendedLevelMin-enemy.level,enemy.level-a.recommendedLevelMax,0)-Math.max(b.recommendedLevelMin-enemy.level,enemy.level-b.recommendedLevelMax,0))[0];
   enemy.mapId=nearest.id;
  }
  run.world.enemies=run.world.enemies.filter(e=>!D.maps[e.mapId]?.route||!/^enemy-\d+$/.test(e.id)||e.specialEvent||e.boss);
  populate(run,D.maps[run.currentMapId]);
  return run;
 }
 function populate(run,map){
  for(const [i,point] of map.spawnPoints.entries()){
   const id=map.id+'-patrol-'+i;if(run.world.enemies.some(e=>e.id===id))continue;
   const pool=point.elite?map.elitePoolIds:map.enemyPoolIds,type=pool[i%pool.length];if(!type)continue;
   run.world.enemies.push({id,mapId:map.id,regionId:map.regionId,x:point.x,y:point.y,homeX:point.x,homeY:point.y,type,level:point.level,elite:point.elite,section:point.section,discovered:false,defeatedUntil:0});
  }
 }
 function enter(run,id,options={}){
  const map=D.maps[id];if(!map||!map.isAvailable||run.dungeon)return false;
  if(!options.debug&&!access(run,id).ok)return false;
  if(map.starter||run.starter&&run.currentMapId===run.starter.mapId&&run.starter.phase!=='cleared')return false;
  ensureRun(run);run.mapPositions[run.currentMapId]={...run.position};
  run.currentMapId=id;run.position={...(options.edge&&map.route?R.arrival(map,options.edge==='right'):(run.mapPositions[id]||map.entry))};run.mapPositions[id]={...run.position};
  populate(run,map);
  return map;
 }
 function access(run,id){const map=D.maps[id];if(!map)return {ok:false,message:'此地圖目前無法進入。'};if(map.id===run.currentMapId)return {ok:true};if(run.starter&&run.currentMapId===run.starter.mapId&&run.starter.phase!=='cleared')return {ok:false,message:'請先打倒新手區守關 Boss。'};const rule=D.mapAccessRules[map.sortOrder];if(!rule||map.starter)return {ok:true};if((run.adventurerRank?.index??0)<D.runRating.ranks.indexOf(rule.rank))return {ok:false,message:'此區域僅開放 '+rule.rank+' 級以上冒險者進入。'};if(rule.previousDungeonMap!==undefined&&!run.battleStats?.clearedDungeonIds?.some(id=>{const d=D.dungeons.find(d=>d.id===id);return D.maps[d?.mapId]?.sortOrder===rule.previousDungeonMap;}))return {ok:false,message:'請先在本局通關任一大區第 '+(rule.previousDungeonMap+1)+' 張地圖的地下城，取得深入許可。'};return {ok:true};}
 const api={geometry,access,regions,maps,byId:D.maps,layoutVersion,safeRadius,starterConfig,starterMaps,startStarter,syncStarter,clearStarter,ensureRun,enter,inferLegacy};
 if(typeof module!=='undefined')module.exports=api;else root.WorldMaps=api;
})(globalThis);
