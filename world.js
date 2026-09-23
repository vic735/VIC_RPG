(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.GameData;
  const P = typeof module !== 'undefined' ? require('./progression.js') : root.Progression;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function seeded(seed = 917) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  const roadY = x => 1090 - (x - 370) * .34 + Math.sin(x / 180) * 45;
  function roadDistance(x,y) {
    let nearest=Infinity;
    for(const road of D.world.roads)for(let i=1;i<road.length;i++){
      const {x:ax,y:ay}=road[i-1],{x:bx,y:by}=road[i],dx=bx-ax,dy=by-ay;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
      nearest=Math.min(nearest,Math.hypot(x-ax-t*dx,y-ay-t*dy));
    }return nearest;
  }
  function decorations() {
    const rng = seeded(), items = [];
    for (let i = 0; i < 2200; i++) {
      const x = 65 + rng() * (D.world.width - 130), y = 65 + rng() * (D.world.height - 130), region = P.regionAt(x, y);
      if ((D.mapData||[]).some(m=>distance({x,y},m.entry)<125||m.spawnPoints.some(p=>distance({x,y},p)<50)) || (D.explorationObjects || []).some(o => distance({x, y}, o) < 65) || roadDistance(x,y) < 65 || distance({ x, y }, D.world.camp) < 125 || D.dungeons.some(d => distance({ x, y }, d) < 115) || D.world.spawns.some(([mx, my]) => Math.hypot(x - mx, y - my) < 50)) continue;
      items.push({ x, y, kind: ['redrift','obsidian'].includes(region.id) ? (rng() < .7 ? 'rock' : 'deadTree') : rng() < .8 ? 'tree' : 'rock', size: .6 + rng() * .7, variant: rng() });
    }
    return items;
  }
  const scenery = decorations();
  function blocked(x, y) { return x < 30 || y < 30 || x > D.world.width - 30 || y > D.world.height - 30 || scenery.some(t => Math.hypot(x - t.x, y - t.y) < (t.kind === 'rock' ? 15 : 10) * t.size + 9); }
  function movePosition(position, dx, dy) { if (!blocked(position.x + dx, position.y)) position.x += dx; if (!blocked(position.x, position.y + dy)) position.y += dy; }
  function update(run, dt, input) {
    run.world.time += dt;
    const length = Math.hypot(input.x, input.y); if (length) movePosition(run.position, input.x / Math.max(1, length) * D.balance.playerSpeed * dt, input.y / Math.max(1, length) * D.balance.playerSpeed * dt);
    let contact = null;
    for (const e of run.world.enemies) {
      if (run.currentMapId && e.mapId !== run.currentMapId) continue;
      if (e.defeatedUntil > run.world.time) continue;
      const def = D.monsters[e.type], dist = distance(e, run.position);
      if (e.defeatedUntil > 0 && dist < 140) { e.defeatedUntil = run.world.time + .5; continue; }
      e.defeatedUntil = 0;
      if (dist < D.balance.discoveryRadius) e.discovered = true;
      let direction = 0; e.alert = false;
      if (def.behavior === 'timid' && run.level >= e.level + 2 && dist < def.radius) direction = -1;
      else if (def.behavior !== 'neutral' && dist < def.radius && distance(e, { x: e.homeX, y: e.homeY }) < 340) { direction = 1; e.alert = true; }
      if (direction && dist > 1) { e.x += direction * (run.position.x - e.x) / dist * def.speed * dt; e.y += direction * (run.position.y - e.y) / dist * def.speed * dt; }
      else { const home = Math.hypot(e.homeX - e.x, e.homeY - e.y); if (home > 4) { e.x += (e.homeX - e.x) / home * 28 * dt; e.y += (e.homeY - e.y) / home * 28 * dt; } }
      e.x = Math.max(35, Math.min(D.world.width - 35, e.x)); e.y = Math.max(35, Math.min(D.world.height - 35, e.y));
      if (distance(e, run.position) < 30 && def.behavior !== 'neutral' && direction !== -1) contact = e;
    }
    for (const d of D.dungeons) if ((!run.currentMapId||d.mapId===run.currentMapId) && distance(d, run.position) < D.balance.discoveryRadius && !run.world.discoveredDungeons.includes(d.id)) run.world.discoveredDungeons.push(d.id);
    return contact;
  }
  function edgeExit(run,threshold=150) {
    const map=D.maps?.[run.currentMapId],region=map&&D.regionById?.[map.regionId];if(!map||!region)return null;
    const edges=[['left',run.position.x],['right',D.world.width-run.position.x],['top',run.position.y],['bottom',D.world.height-run.position.y]].sort((a,b)=>a[1]-b[1]),index=region.mapIds.indexOf(map.id);
    for(const [edge,proximity] of edges){if(proximity>threshold)break;const forward=edge==='right'||edge==='bottom',targetId=region.mapIds[index+(forward?1:-1)],target=D.maps[targetId];if(target)return {kind:'map-exit',entity:{id:target.id,name:target.name,edge,forward,fromMapId:map.id},proximity};}
    return null;
  }
  function nearby(run) {
    const dungeon = D.dungeons.find(d => (!run.currentMapId||d.mapId===run.currentMapId) && distance(d, run.position) < 95); if (dungeon) return { kind: 'dungeon', entity: dungeon };
    const object = (D.explorationObjects || []).filter(o => !(o.once && run.world.usedObjects?.includes(o.id)) && distance(o, run.position) < 65).sort((a,b) => distance(a,run.position) - distance(b,run.position))[0];
    if (object) return { kind: object.kind, entity: object };
    const exit=edgeExit(run);if(exit)return exit;
    const enemy = run.world.enemies.filter(e => (!run.currentMapId||e.mapId===run.currentMapId) && e.defeatedUntil <= run.world.time && distance(e, run.position) < 85).sort((a, b) => distance(a, run.position) - distance(b, run.position))[0];
    return enemy ? { kind: 'enemy', entity: enemy } : null;
  }
  function interactObject(run, id) {
    const target = nearby(run); if (!target || target.entity.id !== id || !D.explorationObjects.includes(target.entity)) return null;
    const object = target.entity;
    if (object.once) { run.world.usedObjects ||= []; run.world.usedObjects.push(id); }
    if (object.reward) { run.world.inventory ||= []; run.world.inventory.push(object.reward); }
    return { text: object.text, reward: object.reward || null };
  }
  function threat(playerLevel, enemyLevel) { const gap = enemyLevel - playerLevel; return gap >= 6 ? { color: '#ff7374', label: '☠ 極度危險' } : gap >= 3 ? { color: '#ee8a77', label: '危險' } : gap >= -1 ? { color: '#edcf8d', label: '勢均力敵' } : { color: '#e4e8d7', label: '較弱' }; }
  const api = { seeded, roadY, roadDistance, scenery, blocked, update, nearby, edgeExit, interactObject, threat, distance };
  if (typeof module !== 'undefined') module.exports = api; else root.World = api;
})(globalThis);
