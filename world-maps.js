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
 const regions=[],maps=[];
 for(const [sortOrder,row] of rows.entries()){
  const [id,name,description,legacyId,environmentId,color,themeTags,elementTendencies,levels,dungeonIds]=row;
  const legacy=D.world.regions.find(r=>r.id===legacyId);
  const region={id,name,description,mapIds:[],themeTags:[...themeTags],elementTendencies:[...elementTendencies],rewardTendencies:[...themeTags],sortOrder,uiPosition:{column:sortOrder%2,row:Math.floor(sortOrder/2)},color,environmentId,legacyRegionId:legacyId};
  for(const [index,[recommendedLevelMin,recommendedLevelMax]] of levels.entries()){
   const mapId=id+'_'+(index+1),assigned=dungeonIds.filter(d=>dungeonMap[d]===index+1),rewardPoolId=mapId+'_field';
   const source=D.rewardPools[legacyId+'_field'];
   D.rewardPools[rewardPoolId]={id:rewardPoolId,entries:JSON.parse(JSON.stringify(source?.entries||[]))};
   const map={id:mapId,regionId:id,name:index===0?name+'・起始地圖':name+'・地圖 '+(index+1),description:index===0?description:description+'，可依目前實力選擇挑戰。',recommendedLevelMin,recommendedLevelMax,dangerTier:index+1,enemyPoolIds:[...legacy.enemyPools],elitePoolIds:[...legacy.elitePools],dungeonIds:assigned,rewardPoolIds:[rewardPoolId],elementTendencies:[...elementTendencies],gameplayTags:[...themeTags],environmentId,isAvailable:true,sortOrder:index,entry:{x:legacy.x,y:legacy.y},color};
   region.mapIds.push(mapId);maps.push(map);
  }
  regions.push(region);
 }
 for(const dungeon of D.dungeons){const map=maps.find(m=>m.dungeonIds.includes(dungeon.id));if(map)dungeon.mapId=map.id;}
 D.regionData=regions;D.mapData=maps;D.maps=Object.fromEntries(maps.map(m=>[m.id,m]));D.regionById=Object.fromEntries(regions.map(r=>[r.id,r]));
 function inferLegacy(run){
  const dungeon=D.dungeons.find(d=>d.id===run.dungeon?.id);if(dungeon?.mapId)return dungeon.mapId;
  const legacy=D.world.regions.find(r=>run.position.x>=r.bounds[0]&&run.position.x<r.bounds[0]+r.bounds[2]&&run.position.y>=r.bounds[1]&&run.position.y<r.bounds[1]+r.bounds[3])||D.world.regions[0];
  return legacyToRegion[legacy.id]+'_1';
 }
 function ensureRun(run){
  run.currentMapId=D.maps[run.currentMapId]?run.currentMapId:inferLegacy(run);
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
  return run;
 }
 function enter(run,id){
  const map=D.maps[id];if(!map||!map.isAvailable||run.dungeon)return false;
  ensureRun(run);run.mapPositions[run.currentMapId]={...run.position};
  run.currentMapId=id;run.position={...(run.mapPositions[id]||map.entry)};run.mapPositions[id]={...run.position};
  const existing=run.world.enemies.filter(e=>e.mapId===id).length;
  if(existing<8){
   const pool=[...map.enemyPoolIds],elite=map.elitePoolIds[0];
   for(let i=existing;i<8;i++){
    const angle=i*2.399,radius=190+(i%4)*105,type=i===7&&elite?elite:pool[i%pool.length];
    if(!type)continue;
    const x=Math.max(50,Math.min(D.world.width-50,Math.round(map.entry.x+Math.cos(angle)*radius))),y=Math.max(50,Math.min(D.world.height-50,Math.round(map.entry.y+Math.sin(angle)*radius)));
    run.world.enemies.push({id:id+'-enemy-'+i,mapId:id,regionId:map.regionId,x,y,homeX:x,homeY:y,type,level:Math.round(map.recommendedLevelMin+(map.recommendedLevelMax-map.recommendedLevelMin)*i/9),elite:i===7,discovered:false,defeatedUntil:0});
   }
  }
  return map;
 }
 const api={regions,maps,byId:D.maps,ensureRun,enter,inferLegacy};
 if(typeof module!=='undefined')module.exports=api;else root.WorldMaps=api;
})(globalThis);
