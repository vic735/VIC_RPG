/* Data-driven Run map routes. Existing combat and dungeon records keep their IDs. */
(function(root){
 const D=typeof module!=='undefined'?require('./data.js'):root.GameData;
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
 const layoutVersion=3,safeRadius=720,sharedEntry={x:Math.round(D.world.width/2),y:Math.round(D.world.height/2)};D.world.camp={...sharedEntry};
 const regions=[],maps=[];
 for(const [sortOrder,row] of rows.entries()){
  const [id,name,description,legacyId,environmentId,color,themeTags,elementTendencies,levels,dungeonIds]=row;
  const legacy=D.world.regions.find(r=>r.id===legacyId);
  const region={id,name,description,mapIds:[],themeTags:[...themeTags],elementTendencies:[...elementTendencies],rewardTendencies:[...themeTags],sortOrder,uiPosition:{column:sortOrder%2,row:Math.floor(sortOrder/2)},color,environmentId,legacyRegionId:legacyId};
  for(const [index,[recommendedLevelMin,recommendedLevelMax]] of levels.entries()){
   const mapId=id+'_'+(index+1),assigned=dungeonIds.filter(d=>dungeonMap[d]===index+1),rewardPoolId=mapId+'_field';
   const source=D.rewardPools[legacyId+'_field'];
   D.rewardPools[rewardPoolId]={id:rewardPoolId,entries:JSON.parse(JSON.stringify(source?.entries||[]))};
   const map={id:mapId,regionId:id,name:index===0?name+'・起始地圖':name+'・地圖 '+(index+1),description:index===0?description:description+'，可依目前實力選擇挑戰。',recommendedLevelMin,recommendedLevelMax,dangerTier:index+1,enemyPoolIds:[...legacy.enemyPools],elitePoolIds:[...legacy.elitePools],dungeonIds:assigned,rewardPoolIds:[rewardPoolId],elementTendencies:[...elementTendencies],gameplayTags:[...themeTags],environmentId,isAvailable:true,sortOrder:index,entry:{...sharedEntry},color};
   region.mapIds.push(mapId);maps.push(map);
  }
  regions.push(region);
 }
 // Each map has a local encounter layout and a reachable dungeon entrance.
 const routes={north_plains:['abandoned_mine','荒原哨站'],northern_kingdom:['frozen_tower','霜雷哨塔'],mirewood:['root_cave','幽根密窟'],central_mines:['giant_ruins','深岩試煉所'],dark_empire:['blacklight_chapel','暮影祭壇'],southern_kingdom:['old_lab','餘燼法陣'],southern_forest:['root_cave','獵風古穴']};
 function spawnLayout(map){
  let seed=[...map.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,917),random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const points=[],cols=9,rows=7,margin=130,cellW=(D.world.width-margin*2)/cols,cellH=(D.world.height-margin*2)/rows,dungeons=map.dungeonIds.map(id=>D.dungeons.find(d=>d.id===id)).filter(Boolean),maxDistance=Math.max(...[[margin,margin],[D.world.width-margin,margin],[margin,D.world.height-margin],[D.world.width-margin,D.world.height-margin]].map(([x,y])=>Math.hypot(x-map.entry.x,y-map.entry.y)));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const x=Math.round(margin+(col+.18+random()*.64)*cellW),y=Math.round(margin+(row+.18+random()*.64)*cellH),distance=Math.hypot(x-map.entry.x,y-map.entry.y);
   if(distance<safeRadius||dungeons.some(d=>Math.hypot(x-d.x,y-d.y)<150))continue;
   points.push({x,y,elite:false,level:map.recommendedLevelMin});
  }
  points.sort((a,b)=>Math.hypot(a.x-map.entry.x,a.y-map.entry.y)-Math.hypot(b.x-map.entry.x,b.y-map.entry.y));
  const beginnerCount=Math.max(6,Math.ceil(points.length*.1)),span=map.recommendedLevelMax-map.recommendedLevelMin;
  for(const [i,point] of points.entries()){
   const distance=Math.hypot(point.x-map.entry.x,point.y-map.entry.y),progress=Math.max(0,Math.min(1,(distance-safeRadius)/(maxDistance-safeRadius)));
   point.level=i<beginnerCount?map.recommendedLevelMin:i<beginnerCount+6?Math.min(map.recommendedLevelMax,map.recommendedLevelMin+1+Math.floor((i-beginnerCount)/2)):Math.round(map.recommendedLevelMin+span*Math.max(0,Math.min(1,progress*.96+(random()-.5)*.05)));
   if(i>=11&&i%12===11)point.elite=true;
  }
  return points;
 }
 for(const map of maps){
  if(!map.dungeonIds.length){
   const [themeTemplate,name]=routes[map.regionId],level=map.sortOrder===0?12:Math.round(map.recommendedLevelMin+(map.recommendedLevelMax-map.recommendedLevelMin)*.65);
   const template=D.dungeons.find(d=>d.id===(level<25?(map.regionId==='southern_kingdom'?'old_lab':'abandoned_mine'):themeTemplate));
   const dungeon=JSON.parse(JSON.stringify(template));dungeon.id=map.id+'_dungeon';dungeon.name=name+'・'+(map.sortOrder+1);dungeon.level=dungeon.recommendedLevel=level;dungeon.generatedMapDungeon=true;dungeon.templateId=template.id;dungeon.features=[...map.gameplayTags];dungeon.description=map.name+'的區域試煉。';
   dungeon.enemyWaves=dungeon.enemyWaves.map((w,i)=>({...w,type:w.role==='normal'?map.enemyPoolIds[i%map.enemyPoolIds.length]:w.role==='elite'?map.elitePoolIds[0]:w.type,level:Math.max(1,level+(w.role==='boss'?1:w.role==='normal'?-2:0))}));dungeon.encounters=dungeon.enemyWaves.map(w=>w.type);
   D.dungeons.push(dungeon);map.dungeonIds.push(dungeon.id);
  }
  map.dungeonIds.forEach((id,index)=>{const d=D.dungeons.find(d=>d.id===id);d.mapId=map.id;d.regionId=regions.find(r=>r.id===map.regionId).legacyRegionId;d.x=map.entry.x+260+index*220;d.y=map.entry.y-200;});
  map.spawnPoints=spawnLayout(map);
 }
 D.regionData=regions;D.mapData=maps;D.maps=Object.fromEntries(maps.map(m=>[m.id,m]));D.regionById=Object.fromEntries(regions.map(r=>[r.id,r]));
 function inferLegacy(run){
  const dungeon=D.dungeons.find(d=>d.id===run.dungeon?.id);if(dungeon?.mapId)return dungeon.mapId;
  const legacy=D.world.regions.find(r=>run.position.x>=r.bounds[0]&&run.position.x<r.bounds[0]+r.bounds[2]&&run.position.y>=r.bounds[1]&&run.position.y<r.bounds[1]+r.bounds[3])||D.world.regions[0];
  return legacyToRegion[legacy.id]+'_1';
 }
 function ensureRun(run){
  run.currentMapId=D.maps[run.currentMapId]?run.currentMapId:inferLegacy(run);
  if(run.mapLayoutVersion!==layoutVersion){run.position={...D.maps[run.currentMapId].entry};run.mapPositions={};run.world.enemies=run.world.enemies.filter(e=>!e.id?.includes('-patrol-'));run.mapLayoutVersion=layoutVersion;}
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
  populate(run,D.maps[run.currentMapId]);
  return run;
 }
 function populate(run,map){
  for(const [i,point] of map.spawnPoints.entries()){
   const id=map.id+'-patrol-'+i;if(run.world.enemies.some(e=>e.id===id))continue;
   const pool=point.elite?map.elitePoolIds:map.enemyPoolIds,type=pool[i%pool.length];if(!type)continue;
   run.world.enemies.push({id,mapId:map.id,regionId:map.regionId,x:point.x,y:point.y,homeX:point.x,homeY:point.y,type,level:point.level,elite:point.elite,discovered:false,defeatedUntil:0});
  }
 }
 function enter(run,id){
  const map=D.maps[id];if(!map||!map.isAvailable||run.dungeon)return false;
  ensureRun(run);run.mapPositions[run.currentMapId]={...run.position};
  run.currentMapId=id;run.position={...(run.mapPositions[id]||map.entry)};run.mapPositions[id]={...run.position};
  populate(run,map);
  return map;
 }
 const api={regions,maps,byId:D.maps,layoutVersion,safeRadius,ensureRun,enter,inferLegacy};
 if(typeof module!=='undefined')module.exports=api;else root.WorldMaps=api;
})(globalThis);
