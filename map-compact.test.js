const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),P=require('./progression'),M=require('./world-maps'),X=require('./run-exploration'),W=require('./world');
test('正式圖面積75%，新手大小不變；怪物減量且保留安全區、入口分散',()=>{
 assert.ok(Math.abs(D.world.width*D.world.height/(7200*4200)-.75)<1e-12);
 for(const m of M.starterMaps){assert.equal(m.width,3600);assert.equal(m.height,2100);assert.equal(m.spawnPoints.length,18);}
 for(const m of M.maps){assert.ok(m.spawnPoints.length>=160&&m.spawnPoints.length<=190);assert.ok(m.spawnPoints.every(p=>Math.hypot(p.x-m.entry.x,p.y-m.entry.y)>=M.safeRadius));const ds=m.dungeonIds.map(id=>D.dungeons.find(d=>d.id===id));for(let i=0;i<ds.length;i++){assert.equal(W.blocked(ds[i].x,ds[i].y,m.id),false);for(let j=i+1;j<ds.length;j++)assert.ok(Math.hypot(ds[i].x-ds[j].x,ds[i].y-ds[j].y)>500);}}
});
test('舊正式圖座標只換算一次，保留冷卻、成長、藏書任務與事件狀態',()=>{
 const r=P.createRun(P.freshProgress(),undefined,()=>.3);delete r.mapGeometryVersion;delete r.exploration.geometryVersion;r.mapLayoutVersion=4;r.position={x:6800,y:3900};r.mapPositions={north_plains_1:{x:6800,y:3900},starter_north_plains:{x:1700,y:900}};r.level=42;r.exp=123;r.ultimateCharge=65;const enemy=r.world.enemies.find(e=>e.id==='north_plains_1-patrol-0');enemy.defeatedUntil=987;enemy.discovered=true;
 const event=r.exploration.maps.north_plains_1.events[0];event.x=6500;event.y=3600;event.state='done';
 r.exploration.books=[{id:'test',mapId:'north_plains_1',bookId:Object.keys(D.books)[0],state:'active',progress:1,start:{x:1000,y:1200},finish:{x:6400,y:3500},research:[{id:'a',x:1500,y:1500}],visited:['a']}];const waves=JSON.stringify(r.exploration.dungeons),effects=JSON.stringify(r.exploration.effects);
 M.ensureRun(r);X.ensure(r);assert.equal(r.position.x,6800*Math.sqrt(.75));assert.equal(r.position.y,3900*Math.sqrt(.75));assert.equal(enemy.defeatedUntil,987);assert.equal(enemy.discovered,true);assert.equal(r.level,42);assert.equal(r.exp,123);assert.equal(r.ultimateCharge,65);assert.equal(event.state,'done');assert.equal(r.exploration.books[0].progress,1);assert.deepEqual(r.exploration.books[0].visited,['a']);assert.equal(JSON.stringify(r.exploration.dungeons),waves);assert.equal(JSON.stringify(r.exploration.effects),effects);assert.deepEqual(r.mapPositions.starter_north_plains,{x:1700,y:900});
 for(const p of [event,r.exploration.books[0].start,r.exploration.books[0].finish,...r.exploration.books[0].research])assert.equal(W.blocked(p.x,p.y,'north_plains_1'),false);
 const saved=JSON.stringify(r);M.ensureRun(r);X.ensure(r);assert.equal(JSON.stringify(r),saved);
});
test('在新手圖讀取舊檔，僅遷移正式圖位置與事件',()=>{
 const r=P.createRun(P.freshProgress());M.startStarter(r,()=>0);const pos={...r.position};delete r.mapGeometryVersion;delete r.exploration.geometryVersion;r.mapLayoutVersion=4;r.mapPositions.north_plains_1={x:6000,y:3000};M.ensureRun(r);assert.deepEqual(r.position,pos);assert.equal(r.mapPositions.north_plains_1.x,6000*Math.sqrt(.75));assert.equal(r.world.enemies.length,18);
});
