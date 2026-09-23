const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),Maps=require('./world-maps'),P=require('./progression'),World=require('./world'),Save=require('./run-save');

test('加密野怪補足地圖空隙，載入較稀疏的同版本存檔不重置既有怪物與玩家位置',()=>{
 for(const map of Maps.maps){assert.ok(map.spawnPoints.length>=170,map.id);assert.ok(map.spawnPoints.filter(p=>p.elite).length<=5);}
 const run=P.createRun(P.freshProgress(),undefined,()=>.5),map=D.maps[run.currentMapId];
 run.world.enemies=run.world.enemies.filter(e=>!e.id.startsWith(map.id+'-patrol-')||Number(e.id.split('-patrol-')[1])<60);
 const existing=run.world.enemies.find(e=>e.id===map.id+'-patrol-0');existing.defeatedUntil=123;run.position={x:4200,y:2600};const saved=JSON.stringify(existing);
 Maps.ensureRun(run);assert.equal(JSON.stringify(existing),saved);assert.deepEqual(run.position,{x:4200,y:2600});assert.equal(run.world.enemies.filter(e=>e.id.startsWith(map.id+'-patrol-')).length,map.spawnPoints.length);
});

test('35 張地圖都有可接觸的野怪與附近地下城，重訪不重置刷新或增加副本',()=>{
 const run=P.createRun(P.freshProgress(),undefined,()=>.5),R=require('./world-rewards');
 for(const map of Maps.maps){
  Maps.enter(run,map.id);assert.deepEqual(map.entry,{x:D.world.width/2,y:D.world.height/2});assert.ok(map.spawnPoints.length>=50,map.id);assert.equal(World.blocked(map.entry.x,map.entry.y),false,map.id);
  assert.ok(map.spawnPoints.every(p=>World.distance(p,map.entry)>=Maps.safeRadius),map.id+' center safe zone');assert.ok(map.spawnPoints.filter(p=>p.level===map.recommendedLevelMin).length>=6,map.id+' minimum-level group');
  assert.ok(map.spawnPoints.filter(p=>p.elite).length>=4,map.id+' elites');assert.ok(map.spawnPoints.filter(p=>World.distance(p,map.entry)>1000).length>map.spawnPoints.length*.65,map.id+' distant spread');
  assert.ok(Math.min(...map.spawnPoints.map(p=>p.x))<D.world.width*.2&&Math.max(...map.spawnPoints.map(p=>p.x))>D.world.width*.8,map.id+' horizontal coverage');
  assert.ok(Math.min(...map.spawnPoints.map(p=>p.y))<D.world.height*.2&&Math.max(...map.spawnPoints.map(p=>p.y))>D.world.height*.8,map.id+' vertical coverage');
  for(const point of map.spawnPoints)assert.equal(World.blocked(point.x,point.y),false,map.id+' spawn');
  const enemies=run.world.enemies.filter(e=>e.id.startsWith(map.id+'-patrol-'));assert.equal(enemies.length,map.spawnPoints.length);assert.ok(enemies.every(e=>e.level>=map.recommendedLevelMin&&e.level<=map.recommendedLevelMax));
  const count=run.world.enemies.length;enemies[0].defeatedUntil=99;Maps.enter(run,map.id);assert.equal(run.world.enemies.length,count);assert.equal(enemies[0].defeatedUntil,99);
  assert.ok(map.dungeonIds.length);
  for(const id of map.dungeonIds){const d=D.dungeons.find(d=>d.id===id);assert.ok(World.distance(d,map.entry)<850);run.position={x:d.x,y:d.y+65};assert.equal(World.blocked(run.position.x,run.position.y),false);assert.equal(World.nearby(run).entity.id,id);run.dungeon={id,stage:0};const encounter=P.dungeonEncounter(run);assert.ok(P.battleFor(run,encounter,()=>.9).enemy.hp>0);assert.ok(R.dungeon(id,()=>.5).rewards.length);run.dungeon=null;}
 }
});

test('靠近地圖邊緣會指出相鄰地圖，首尾不會越出同一大區',()=>{
 const run=P.createRun(P.freshProgress(),undefined,()=>.5);Maps.enter(run,'north_plains_2');
 run.position={x:D.world.width-40,y:2000};let exit=World.edgeExit(run);assert.equal(exit.entity.id,'north_plains_3');assert.equal(exit.entity.forward,true);assert.equal(World.nearby(run).kind,'map-exit');
 run.position={x:40,y:2000};exit=World.edgeExit(run);assert.equal(exit.entity.id,'north_plains_1');assert.equal(exit.entity.forward,false);
 Maps.enter(run,'north_plains_1');run.position={x:40,y:2000};assert.equal(World.edgeExit(run),null);
 Maps.enter(run,'north_plains_5');run.position={x:D.world.width-40,y:2000};assert.equal(World.edgeExit(run),null);
});

test('七大區各有五張地圖，起始圖皆為 Lv.1～20，地下城均有唯一歸屬',()=>{
 assert.equal(Maps.regions.length,7);assert.equal(Maps.maps.length,35);
 for(const region of Maps.regions){assert.equal(region.mapIds.length,5);const first=D.maps[region.mapIds[0]];assert.equal(first.recommendedLevelMin,1);assert.equal(first.recommendedLevelMax,20);for(const id of region.mapIds){const map=D.maps[id];assert.ok(map.enemyPoolIds.length);assert.ok(D.rewardPools[map.rewardPoolIds[0]]);}}
 for(const dungeon of D.dungeons)assert.deepEqual(Maps.maps.filter(m=>m.dungeonIds.includes(dungeon.id)).map(m=>m.id),[dungeon.mapId]);
 assert.equal(D.dungeons.find(d=>d.id==='old_lab').mapId,'southern_kingdom_1');
});

test('跨區切換保留同局成長、招式配置、必殺能量與每張地圖位置',()=>{
 const permanent=P.freshProgress(),run=P.createRun(permanent,undefined,()=>.5);run.level=23;run.exp=123;run.debuffIds=['fatigue'];run.ultimateCharge=42;run.moveLevels.quick=4;run.position={x:700,y:400};const build=JSON.stringify(run.build);
 assert.ok(Maps.enter(run,'southern_kingdom_1'));assert.equal(run.level,23);assert.equal(run.exp,123);assert.equal(run.ultimateCharge,42);assert.equal(run.moveLevels.quick,4);assert.equal(JSON.stringify(run.build),build);
 const current=run.world.enemies.filter(e=>e.mapId===run.currentMapId);assert.ok(current.length>=8);assert.ok(current.every(e=>e.level>=1&&e.level<=20));
 run.position={x:4010,y:2810};Maps.enter(run,'dark_empire_5');assert.ok(run.world.enemies.some(e=>e.mapId==='dark_empire_5'&&e.level>=160));Maps.enter(run,'southern_kingdom_1');assert.deepEqual(run.position,{x:4010,y:2810});Maps.enter(run,'north_plains_1');assert.deepEqual(run.position,{x:700,y:400});
});

test('舊版探索存檔能遷移到地圖結構，既有收藏與遊戲世界版本不變',()=>{
 const permanent=P.freshProgress(),run=P.createRun(permanent,undefined,()=>.5);const originalWorldVersion=D.worldContentVersion;delete run.currentMapId;delete run.mapPositions;delete run.mapLayoutVersion;delete run.availableMoves;delete run.availableSkills;run.position={x:350,y:350};for(const enemy of run.world.enemies)delete enemy.mapId;
 const game={scene:'explore',run,permanent,build:run.build};const storage=new Map([[Save.KEY,JSON.stringify(Save.pack(game))]]);const result=Save.load({getItem:key=>storage.get(key)});assert.equal(result.warning,undefined);assert.equal(result.snapshot.run.currentMapId,'north_plains_1');assert.deepEqual(result.snapshot.run.position,{x:D.world.width/2,y:D.world.height/2});assert.equal(result.snapshot.run.mapLayoutVersion,Maps.layoutVersion);assert.ok(result.snapshot.run.world.enemies.every(e=>D.maps[e.mapId]));assert.equal(D.worldContentVersion,originalWorldVersion);
});

test('七張起始地圖的第一批基礎怪從 Lv.1 開始，舊版巡邏資料會重建',()=>{
 const run=P.createRun(P.freshProgress(),undefined,()=>.5);
 for(const region of Maps.regions){const map=D.maps[region.mapIds[0]];assert.equal(map.recommendedLevelMin,1);assert.ok(map.spawnPoints.filter(p=>p.level===1).length>=6,map.id);}
 run.world.enemies.push({id:'north_plains_1-patrol-obsolete',mapId:'north_plains_1',type:'greywind_0',level:9,x:1,y:1,homeX:1,homeY:1,defeatedUntil:99});run.mapLayoutVersion=Maps.layoutVersion-1;Maps.ensureRun(run);assert.ok(!run.world.enemies.some(e=>e.id.endsWith('obsolete')));assert.ok(run.world.enemies.filter(e=>e.id.startsWith('north_plains_1-patrol-')&&e.level===1).length>=6);
});
