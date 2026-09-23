const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),Maps=require('./world-maps'),P=require('./progression'),World=require('./world'),Save=require('./run-save');

test('35 張地圖都有可接觸的野怪與附近地下城，重訪不重置刷新或增加副本',()=>{
 const run=P.createRun(P.freshProgress(),undefined,()=>.5),R=require('./world-rewards');
 for(const map of Maps.maps){
  Maps.enter(run,map.id);assert.ok(map.spawnPoints.length>=8,map.id);assert.equal(World.blocked(map.entry.x,map.entry.y),false,map.id);
  for(const point of map.spawnPoints)assert.equal(World.blocked(point.x,point.y),false,map.id+' spawn');
  const enemies=run.world.enemies.filter(e=>e.id.startsWith(map.id+'-patrol-'));assert.equal(enemies.length,map.spawnPoints.length);assert.ok(enemies.every(e=>e.level>=map.recommendedLevelMin&&e.level<=map.recommendedLevelMax));
  const count=run.world.enemies.length;enemies[0].defeatedUntil=99;Maps.enter(run,map.id);assert.equal(run.world.enemies.length,count);assert.equal(enemies[0].defeatedUntil,99);
  assert.ok(map.dungeonIds.length);
  for(const id of map.dungeonIds){const d=D.dungeons.find(d=>d.id===id);assert.ok(World.distance(d,map.entry)<850);run.position={x:d.x,y:d.y+65};assert.equal(World.blocked(run.position.x,run.position.y),false);assert.equal(World.nearby(run).entity.id,id);run.dungeon={id,stage:0};const encounter=P.dungeonEncounter(run);assert.ok(P.battleFor(run,encounter,()=>.9).enemy.hp>0);assert.ok(R.dungeon(id,()=>.5).rewards.length);run.dungeon=null;}
 }
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
 const permanent=P.freshProgress(),run=P.createRun(permanent,undefined,()=>.5);const originalWorldVersion=D.worldContentVersion;delete run.currentMapId;delete run.mapPositions;delete run.availableMoves;delete run.availableSkills;for(const enemy of run.world.enemies)delete enemy.mapId;
 const game={scene:'explore',run,permanent,build:run.build};const storage=new Map([[Save.KEY,JSON.stringify(Save.pack(game))]]);const result=Save.load({getItem:key=>storage.get(key)});assert.equal(result.warning,undefined);assert.equal(result.snapshot.run.currentMapId,'north_plains_1');assert.ok(result.snapshot.run.world.enemies.every(e=>D.maps[e.mapId]));assert.equal(D.worldContentVersion,originalWorldVersion);
});
