/* Canvas presentation only. World, progression and combat remain independent of rendering. */
(function (root) {
  const paths = {
    sword: 'M8 27l6-6m-5-4 8 8M13 19 26 4l2 2-13 15M6 29l-2-2 4-4 2 2',
    axe: 'M7 29 25 5M16 7c7-4 11-2 13 3l-7 9-7-6M11 15l5 4',
    flame: 'M17 3c3 8-2 8 3 13 2-2 3-4 3-6 9 12 4 20-7 20C3 30 3 19 9 13c0 5 2 5 3 6 4-5-1-8 5-16Z',
    bolt: 'M18 2 6 19h9l-2 12 14-19h-9Z',
    star: 'm16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z',
    heart: 'M16 28 4 16C-2 5 10 1 16 10 22 1 34 5 28 16Z',
    orb: 'M27 16a11 11 0 1 1-22 0 11 11 0 1 1 22 0M11 8l-3 6m16 7-3 4',
    wind: 'M3 10h17c9 0 7-10 2-6M3 16h23c7 0 6 10 1 8M3 22h12c5 0 4 8 0 6',
    hood: 'M6 27V15C6 0 26 0 26 15v12l-10 3Zm4-9c0-12 12-12 12 0l-6 8Z',
    armor: 'm9 3 7 5 7-5 8 8-6 6-3-3v15H10V14l-3 3-6-6Z',
    hand: 'M9 28 4 17l4-2 3 4V5h4v11-14h4v14-11h4v13-8h4v14l-5 6Z',
    boot: 'M11 3h13l-3 17 7 4v5H5v-7l6-4Z',
    book: 'M4 4h19l5 5v21H4Zm2 0v26M11 10h11m-11 6h11m-11 6h7',
    map: 'm2 7 9-4 10 4 9-4v23l-9 4-10-4-9 4Zm9-4v23M21 7v23',
    skull: 'M7 23C-3 8 8 2 16 2S35 8 25 23v6H7Zm3-11v5m12-5v5m-6 4v3'
  };
  function icon(id, size = 28) { return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><path d="${paths[id] || paths.star}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  class Renderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.time = 0; this.width = 0; this.height = 0; this.camera = { x: 0, y: 0 }; this.fx = []; this.hits = {}; this.attacks = {}; this.seed = World.seeded(218); this.grass = Array.from({ length: 16000 }, () => ({ x: this.seed() * GameData.world.width, y: this.seed() * GameData.world.height, n: this.seed() })); }
    resize() { const r = this.canvas.getBoundingClientRect(), width = this.canvas.clientWidth || r.width, height = this.canvas.clientHeight || r.height, dpr = Math.min(devicePixelRatio || 1, 1.5); if (width !== this.width || height !== this.height) { this.width = width; this.height = height; this.canvas.width = width * dpr; this.canvas.height = height * dpr; } this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    ellipse(x, y, rx, ry, color) { const c = this.ctx; c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
    poly(points, color, stroke) { const c = this.ctx; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = color; c.fill(); if (stroke) { c.strokeStyle = stroke; c.stroke(); } }
    glow(x, y, radius, color) { const c = this.ctx, g = c.createRadialGradient(x, y, 0, x, y, radius); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); }
    text(text, x, y, size = 13, color = '#e8e3cb', align = 'center') { const c = this.ctx; c.font = `500 ${size}px "Microsoft JhengHei", sans-serif`; c.textAlign = align; c.fillStyle = color; c.shadowColor = '#07110d'; c.shadowBlur = 5; c.fillText(text, x, y); c.shadowBlur = 0; }
    tree(t) {
      const c = this.ctx; c.save(); c.translate(t.x, t.y); c.scale(t.size, t.size);
      this.ellipse(10, 5, 28, 11, '#08170f55');
      this.poly([[-5, 5], [7, 5], [3, -61], [-2, -65]], '#66543b');
      if (t.kind === 'deadTree') { c.strokeStyle = '#80725c'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -28); c.lineTo(-19, -48); c.lineTo(-25, -70); c.moveTo(2, -42); c.lineTo(23, -61); c.lineTo(27, -85); c.stroke(); }
      else {
        const region=Progression.regionAt(t.x,t.y), forest=region.id==='verdant', frost=region.id==='froststorm';
        this.poly([[-35, -24], [-20, -51], [-28, -48], [-12, -73], [-17, -72], [0, -104], [18, -71], [12, -74], [29, -45], [22, -49], [38, -24], [0, -12]], frost?'#718b8b':forest ? '#163a32' : '#234a32', '#51734b44');
        this.poly([[-26, -30], [-13, -52], [-20, -50], [-7, -77], [0, -96], [2, -30]], frost?'#b1c7c1':forest ? '#2b5946' : '#3c6742');
        this.poly([[2, -94], [17, -66], [5, -70], [26, -41], [7, -48], [26, -27], [2, -34]], '#53775033');
      }
      c.restore();
    }
    rock(t) { const c = this.ctx; c.save(); c.translate(t.x, t.y); c.scale(t.size, t.size); this.ellipse(4, 4, 23, 9, '#0b130f55'); this.poly([[-22, 0], [-18, -18], [-3, -28], [19, -20], [25, -2], [9, 7]], '#686e62'); this.poly([[-18, -18], [-3, -28], [19, -20], [3, -9]], '#929486'); this.poly([[3, -9], [19, -20], [25, -2], [9, 7]], '#484f49'); c.restore(); }
    person(x, y, scale = 1, moving = false, facing = 1, down = false) {
      const c = this.ctx, walk = moving ? Math.sin(this.time * 13) : Math.sin(this.time * 2) * .15;
      c.save(); c.translate(x, y); c.scale(scale * facing, scale); this.ellipse(0, 4, 16, 6, '#070e0b77');
      if (down) { c.rotate(-1.25 * down); c.translate(10 * down, 0); }
      c.fillStyle = '#2c3029'; c.fillRect(-8, -8, 6, 13 + walk * 3); c.fillRect(3, -8, 6, 13 - walk * 3);
      this.poly([[-9, -31], [8, -30], [16 + walk, -3], [-15 + walk, -3]], '#305969', '#718b86');
      this.poly([[-8, -31], [-2, -17], [-8, -5], [-15, -3]], '#203d4a');
      c.fillStyle = '#967348'; c.fillRect(-9, -14, 19, 3); c.fillStyle = '#dfc99b'; c.fillRect(-4, -39, 10, 12);
      this.poly([[-10, -32], [-9, -41], [-1, -47], [10, -42], [11, -32], [5, -36], [-5, -36]], '#537c86', '#8ca59e');
      c.fillStyle = '#192b2a'; c.fillRect(4, -34, 2, 2);
      c.strokeStyle = '#c7d2bd'; c.lineWidth = 3; c.beginPath(); c.moveTo(13, -5); c.lineTo(24, -24); c.stroke(); c.strokeStyle = '#be9a61'; c.beginPath(); c.moveTo(12, -12); c.lineTo(21, -7); c.stroke();
      this.glow(-12, -16, 28, '#fac57b28'); c.fillStyle = '#ecd19b'; c.fillRect(-15, -20, 5, 7); c.restore();
    }
    monster(type, x, y, scale = 1, down = false) {
      const definition=GameData.monsters[type];type = definition?.sprite || type;
      const c = this.ctx, bob = Math.sin(this.time * 3 + x) * 1.5; c.save(); c.translate(x, y); c.scale(scale, scale); this.ellipse(0, 3, type === 'boss' ? 29 : 19, 6, '#050e0b66'); if (down) { c.globalAlpha = 1 - .5 * down; c.scale(1 + .3 * down, 1 - .75 * down); }
      if(type==='golem'){
        this.ellipse(0,5,38,10,'#0b110d88');
        this.poly([[-29,1],[-27,-24],[-8,-26],[-5,2]],'#596358','#9aa38d');this.poly([[7,2],[9,-26],[29,-24],[32,1]],'#596358','#9aa38d');
        this.poly([[-29,-26],[-33,-61],[-22,-76],[20,-77],[34,-57],[27,-25],[0,-18]],'#7d8775','#adb39a');
        this.poly([[-24,-72],[-46,-66],[-54,-39],[-44,-24],[-30,-33]],'#697563','#a6b092');this.poly([[25,-72],[46,-65],[55,-38],[45,-24],[31,-32]],'#697563','#a6b092');
        this.poly([[-19,-73],[-18,-94],[-5,-104],[17,-96],[21,-76],[4,-69]],'#929b85','#bbc2a6');
        this.poly([[-18,-92],[-5,-102],[15,-95],[0,-89]],'#b7bea4');
        c.strokeStyle='#3a493d';c.lineWidth=2;c.beginPath();c.moveTo(-8,-70);c.lineTo(-2,-52);c.lineTo(-14,-42);c.moveTo(18,-57);c.lineTo(7,-46);c.lineTo(12,-28);c.stroke();
        this.glow(0,-55,23,'#d4bc6540');this.poly([[0,-66],[7,-56],[0,-43],[-7,-56]],'#d3bd79');
        c.fillStyle='#e1d297';c.fillRect(-11,-85,7,3);c.fillRect(5,-85,7,3);
        this.poly([[-32,-68],[-23,-76],[-12,-73],[-17,-65]],'#586e48');
      } else if (type === 'slime' || type === 'timid') {
        this.ellipse(0, -10 + bob, 20 + bob, 17 - bob, definition?.color || (type === 'timid' ? '#a9bd7a' : '#63a888')); this.ellipse(-6, -18 + bob, 8, 5, '#c6e0af66'); this.ellipse(-7, -9, 2, 3, '#102e2e'); this.ellipse(7, -9, 2, 3, '#102e2e'); this.ellipse(-10, -4, 3, 1.5, '#cad297');
      } else if (type === 'goblin') {
        c.fillStyle = '#4e4830'; c.fillRect(-10, -5 + bob, 7, 10); c.fillRect(5, -5 - bob, 7, 10);
        this.poly([[-12, -25], [9, -25], [15, -3], [-13, -3]], '#826146'); this.ellipse(0, -32 + bob, 12, 13, '#91a76b'); this.poly([[-9, -37], [-24, -39], [-12, -27]], '#789357'); this.poly([[9, -37], [23, -39], [10, -27]], '#789357'); c.fillStyle = '#e8d788'; c.fillRect(-8, -33 + bob, 5, 3); c.fillRect(3, -33 + bob, 5, 3); c.strokeStyle = '#c0bca0'; c.lineWidth = 4; c.beginPath(); c.moveTo(17, -7); c.lineTo(25, -26); c.stroke();
      } else if (type === 'wolf') {
        this.ellipse(0, -13 + bob, 23, 12, '#8b9995'); this.poly([[-17, -17], [-30, -30], [-19, -33], [-14, -43], [-8, -32], [0, -20]], '#bcc4b9'); this.poly([[-22, -26], [-36, -22], [-24, -18]], '#b9c1b7'); this.poly([[17, -15], [34, -27], [26, -10]], '#a9b6ae'); c.fillStyle = '#636f6a'; c.fillRect(-13, -8, 5, 14 + bob); c.fillRect(11, -8, 5, 14 - bob); this.ellipse(-23, -29, 2, 2, '#f1ce76');
      } else {
        this.glow(0, -36, 60, '#ac80e82b'); this.poly([[-27, -4], [-22, -44], [-12, -51], [16, -51], [28, -7], [0, 3]], '#666376', '#aea1b3'); this.poly([[-15, -49], [-12, -71], [0, -82], [16, -71], [19, -49]], '#8b8495', '#b9aec0'); this.poly([[-6, -63], [5, -63], [11, -57], [-4, -56]], '#e0bafa'); this.poly([[-6, -38], [0, -47], [9, -36], [1, -22]], '#c5a1ed'); this.poly([[-21, -47], [-36, -50], [-41, -22], [-23, -17]], '#797281'); c.fillStyle = '#5b5261'; c.fillRect(28, -50, 6, 52); this.poly([[19, -55], [21, -76], [48, -79], [54, -56]], '#8a8198', '#c4b2d3');
      }
      if(definition?.color){this.ellipse(0,7,type==='boss'?28:20,2,definition.color);}
      c.restore();
    }
    dungeon(x, y, data) {
      const c = this.ctx; this.ellipse(x, y + 8, 65, 19, '#06101188'); this.glow(x, y - 32, 120, '#a891ee30');
      for (let i = 3; i >= 0; i--) { c.fillStyle = i % 2 ? '#626b65' : '#4e5b56'; c.fillRect(x - 50 - i * 5, y + i * 7, 100 + i * 10, 8); }
      c.fillStyle = '#55645e'; c.fillRect(x - 48, y - 78, 18, 80); c.fillRect(x + 30, y - 78, 18, 80); this.poly([[x - 53, y - 78], [x, y - 112], [x + 53, y - 78]], '#788278', '#a8ab8b');
      c.fillStyle = '#151b28'; c.fillRect(x - 30, y - 76, 60, 76); const g = c.createLinearGradient(x, y - 75, x, y); g.addColorStop(0, '#373957'); g.addColorStop(1, '#b59ce6'); c.fillStyle = g; c.fillRect(x - 23, y - 73, 46, 72);
      for (let i = 0; i < 5; i++) { this.ellipse(x + Math.sin(this.time + i * 2) * 19, y - ((this.time * 18 + i * 15) % 72), 1.5, 2, '#e6dcff'); }
      this.text('✦', x, y - 84, 20, '#e6d2ab'); this.text(data.name, x, y - 138, 17, '#e6d7bd'); this.text(`建議 Lv.${data.recommendedLevel} · ${data.enemyWaves.length} 場`, x, y - 119, 13, '#b6bca9');
    }
    camp(x, y) {
      this.ellipse(x, y, 100, 50, '#76735b33'); this.poly([[x - 70, y - 3], [x - 33, y - 68], [x + 5, y - 3]], '#a69b71', '#d2c59b'); this.poly([[x - 33, y - 68], [x - 6, y - 55], [x + 32, y - 3], [x + 5, y - 3]], '#706f57'); this.poly([[x - 48, y - 3], [x - 33, y - 42], [x - 18, y - 3]], '#293c33');
      this.glow(x + 48, y - 3, 90, '#ffb45930'); for (let i = 0; i < 7; i++) this.ellipse(x + 48 + Math.cos(i) * 15, y + Math.sin(i) * 8, 5, 3, '#8a8b74'); this.poly([[x + 39, y], [x + 47, y - 28 - Math.sin(this.time * 8) * 4], [x + 60, y]], '#dfa755'); this.poly([[x + 44, y], [x + 50, y - 20], [x + 56, y]], '#f8d58c');
      this.text('旅人營地', x - 20, y + 32, 12, '#d2d3b2');
    }
    drawWorld(game) {
      const c = this.ctx, w = this.width, h = this.height, run = game.run, pos = run?.position || GameData.world.camp;
      const zoom = w >= 1800 ? 1.4 : w < 650 ? .78 : 1;
      this.camera.x = Math.max(0, Math.min(GameData.world.width - w / zoom, pos.x - w / (2 * zoom)));
      this.camera.y = Math.max(0, Math.min(GameData.world.height - h / zoom, pos.y - h / (2 * zoom)));
      c.save(); c.scale(zoom, zoom); c.translate(-this.camera.x, -this.camera.y); c.fillStyle = '#263b30'; c.fillRect(0, 0, GameData.world.width, GameData.world.height);
      for (const r of GameData.world.regions) { c.fillStyle=r.color;c.fillRect(...r.bounds); }
      // Low-contrast terrain marks distinguish regions without taking HUD space.
      for(const r of GameData.world.regions)for(let i=0;i<48;i++){
        const x=r.bounds[0]+(i*347+153)%r.bounds[2],y=r.bounds[1]+(i*593+221)%r.bounds[3];
        if(x<this.camera.x-100||x>this.camera.x+w/zoom+100||y<this.camera.y-100||y>this.camera.y+h/zoom+100)continue;
        if(r.visualTheme==='wetland')this.ellipse(x,y,62,26,'#102f3855');
        else if(r.visualTheme==='frost')this.ellipse(x,y,52,19,'#ceded523');
        else if(r.visualTheme==='volcanic'||r.visualTheme==='obsidian'){c.strokeStyle=r.visualTheme==='volcanic'?'#eb9d632b':'#b99cda27';c.lineWidth=2;c.beginPath();c.moveTo(x-40,y+10);c.lineTo(x,y-15);c.lineTo(x+30,y+4);c.lineTo(x+52,y-12);c.stroke();}
      }
      for (const p of this.grass) { if (p.x < this.camera.x - 20 || p.x > this.camera.x + w / zoom + 20 || p.y < this.camera.y - 20 || p.y > this.camera.y + h / zoom + 20) continue; c.fillStyle = p.n > .7 ? '#b5b78b33' : '#111d2144'; c.fillRect(p.x, p.y, 2 + p.n * 3, 2); if (p.n > .85) { c.strokeStyle = '#9ba77855'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2, p.y - 6); c.moveTo(p.x, p.y); c.lineTo(p.x + 3, p.y - 4); c.stroke(); } }
      c.lineCap = 'round'; for (const [width, color] of [[89, '#1d30292f'], [75, '#6a695244'], [52, '#98907422']]) { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); for (const road of GameData.world.roads) { c.moveTo(road[0].x,road[0].y); for(const point of road.slice(1))c.lineTo(point.x,point.y); } c.stroke(); } c.lineWidth = 1;
      c.strokeStyle = '#a1bba04a'; c.strokeRect(25,25,GameData.world.width-50,GameData.world.height-50);
      this.camp(GameData.world.camp.x, GameData.world.camp.y);
      const things = World.scenery.filter(t => t.x > this.camera.x - 80 && t.x < this.camera.x + w / zoom + 80 && t.y > this.camera.y - 20 && t.y < this.camera.y + h / zoom + 140).map(t => ({ y: t.y, draw: () => { c.save(); if (t.kind !== 'rock' && Math.abs(t.x - pos.x) < 45 && t.y > pos.y && t.y < pos.y + 110) c.globalAlpha = .4; t.kind === 'rock' ? this.rock(t) : this.tree(t); c.restore(); } }));
      for (const d of GameData.dungeons) things.push({ y: d.y, draw: () => this.dungeon(d.x, d.y, d) });
      if (run) for (const o of GameData.explorationObjects || []) things.push({ y: o.y, draw: () => {
        const used = run.world.usedObjects?.includes(o.id), near = World.distance(o, pos) < 65;
        c.save(); c.translate(o.x, o.y); this.ellipse(0, 4, 22, 7, '#0a191977');
        if (o.kind === 'npc') { this.person(0, 0, 1, false, -1); this.glow(0, -20, 24, '#e6ca781b'); }
        else if (o.kind === 'chest') { c.fillStyle = used ? '#3d3b30' : '#715c3b'; c.fillRect(-20,-22,40,24); c.strokeStyle='#baa06b'; c.strokeRect(-20,-22,40,24); c.fillStyle='#baa06b'; c.fillRect(-3,-16,6,9); c.fillRect(-14,-22,3,24); c.fillRect(12,-22,3,24); if (used) { c.fillStyle='#17201b';c.fillRect(-17,-27,34,10); } }
        else if (o.kind === 'investigate') { this.poly([[-15,3],[-11,-38],[8,-42],[18,3]],'#7b8170','#b7b597'); this.text('✧',0,-19,18,'#d2c49b'); }
        else if (!used) { for (let i=0;i<5;i++) { const angle=i*1.25; this.poly([[0,2],[Math.cos(angle)*20,-18+Math.sin(angle)*12],[Math.cos(angle)*9,-8]],'#8ab29b'); } this.glow(0,-12,24,'#abcdaa30'); this.ellipse(0,-20,3,4,'#d0e7bb'); }
        if (near && !used) { this.text('◇',0,-65,19,'#e3d39e'); this.text(o.name,0,24,13,'#e0dec5'); }
        c.restore();
      } });
      if (run) for (const e of run.world.enemies) if (e.defeatedUntil <= run.world.time && Math.abs(e.x - pos.x) < w / zoom && Math.abs(e.y - pos.y) < h / zoom) things.push({ y: e.y, draw: () => {
        this.monster(e.type, e.x, e.y, GameData.monsters[e.type].worldScale||1.1);

        
        if (World.distance(e, pos) < 100) this.text(GameData.monsters[e.type].name, e.x, e.y + 21, 11, '#d2d8c5');
      } });
      things.push({ y: pos.y, draw: () => { this.glow(pos.x, pos.y - 8, 70, '#dbd9a910'); this.person(pos.x, pos.y, 1.15, game.moving, game.facing || 1); } });
      things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
      if(run)for(const e of run.world.enemies)if(e.defeatedUntil<=run.world.time&&Math.abs(e.x-pos.x)<w/zoom&&Math.abs(e.y-pos.y)<h/zoom){this.text(`${e.alert?'! ':''}${GameData.monsters[e.type].elite?'◆ ':''}Lv.${e.level}`,e.x,e.y-(GameData.monsters[e.type].labelHeight|| (GameData.monsters[e.type].elite?104:59)),14,'#e4e8d7');}
      if (!game.settings?.reducedMotion) for (let i = 0; i < 22; i++) { const x = pos.x - 470 + ((i * 157 + this.time * 8) % 940), y = pos.y - 320 + (i * 93 % 640) + Math.sin(this.time + i) * 15; this.ellipse(x, y, 1.3, 1.3, `rgba(212,220,153,${.15 + .3 * Math.sin(this.time + i) ** 2})`); }
      c.restore();
      const vignette = c.createRadialGradient(w / 2, h / 2, h * .15, w / 2, h / 2, Math.max(w, h) * .67); vignette.addColorStop(0, '#050b0d00'); vignette.addColorStop(1, '#050b0d9c'); c.fillStyle = vignette; c.fillRect(0, 0, w, h);
    }
    drawTitle(game) {
      const c = this.ctx, w = this.width, h = this.height, motion = game.settings?.reducedMotion ? 0 : this.time;
      c.save(); const cover = Math.max(w / 1920, h / 1080); c.translate(w / 2 - 1190 * cover, 0); c.scale(cover, cover);
      const sky = c.createLinearGradient(0, 0, 0, 1080); sky.addColorStop(0, '#11232e'); sky.addColorStop(.5, '#3e6269'); sky.addColorStop(1, '#101c25'); c.fillStyle = sky; c.fillRect(0, 0, 1920, 1080);
      this.glow(1300, 265, 560, '#b7d0b329'); this.ellipse(1390, 206, 48, 48, '#d1d7b775'); this.ellipse(1372, 190, 48, 48, '#263f48');
      for (let i = 0; i < 60; i++) this.ellipse((i * 331) % 1920, 70 + i * 97 % 350, 1, 1, '#d6ded366');
      this.poly([[0, 490], [175, 300], [320, 411], [470, 246], [695, 420], [820, 312], [1010, 400], [1140, 255], [1310, 402], [1480, 268], [1720, 447], [1920, 330], [1920, 800], [0, 800]], '#28444e');
      this.poly([[0, 603], [280, 415], [447, 522], [610, 363], [900, 564], [1210, 411], [1400, 542], [1690, 405], [1920, 583], [1920, 840], [0, 840]], '#233b43');
      // Distant tower and an aqueduct establish a world beyond the foreground ruin.
      c.fillStyle = '#223b43'; c.fillRect(1598, 300, 48, 267); this.poly([[1590, 307], [1622, 224], [1655, 307]], '#233a42'); c.fillStyle = '#c3c28a44'; c.fillRect(1618, 336, 7, 28);
      for (let i = 0; i < 6; i++) { const x = 1130 + i * 104; c.strokeStyle = '#263e43'; c.lineWidth = 25; c.beginPath(); c.arc(x, 542, 48, Math.PI, 0); c.stroke(); c.fillStyle = '#263e43'; c.fillRect(x - 58, 540, 23, 94); } c.lineWidth = 1;
      this.poly([[0, 740], [240, 610], [450, 680], [720, 550], [945, 640], [1100, 585], [1370, 550], [1640, 633], [1920, 598], [1920, 1080], [0, 1080]], '#162c30');
      const mist = c.createLinearGradient(0, 460, 0, 710); mist.addColorStop(0, '#89b5b100'); mist.addColorStop(.5, '#89b5b11c'); mist.addColorStop(1, '#89b5b100'); c.fillStyle = mist; c.fillRect(0, 460 + Math.sin(motion * .15) * 10, 1920, 250);
      // The stone threshold: irregular blocks, brass seal and cool arcane light.
      c.save(); c.translate(1315, 690); this.ellipse(0, 125, 310, 63, '#07141888'); this.glow(0, -150, 390, '#83b4c32b');
      for (let i = 5; i >= 0; i--) { c.fillStyle = i % 2 ? '#44575a' : '#3a4e51'; this.poly([[-184 - i * 21, 48 + i * 17], [181 + i * 21, 48 + i * 17], [196 + i * 21, 63 + i * 17], [-201 - i * 21, 63 + i * 17]], c.fillStyle); }
      c.fillStyle = '#566764'; c.fillRect(-150, -294, 46, 355); c.fillRect(106, -294, 46, 355);
      for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#667571' : '#4b625f'; c.fillRect(-156 - i % 2 * 5, -286 + i * 48, 52, 43); c.fillRect(106, -286 + i * 48, 52 + i % 2 * 5, 43); c.strokeStyle = '#9b9e8033'; c.strokeRect(-154, -286 + i * 48, 50, 43); }
      this.poly([[-170, -292], [-120, -362], [-65, -415], [0, -440], [75, -404], [130, -355], [175, -292], [116, -290], [74, -348], [0, -382], [-78, -348], [-115, -290]], '#677974', '#8e9b813b');
      const portal = c.createLinearGradient(0, -360, 0, 60); portal.addColorStop(0, '#132a38'); portal.addColorStop(.5, '#3c6776'); portal.addColorStop(1, '#8ca9a6'); c.fillStyle = portal;
      c.beginPath(); c.moveTo(-102, 49); c.lineTo(-102, -278); c.quadraticCurveTo(-88, -341, 0, -374); c.quadraticCurveTo(88, -341, 103, -278); c.lineTo(103, 49); c.closePath(); c.fill();
      c.strokeStyle = '#b9c6a744'; c.lineWidth = 2; c.stroke(); c.lineWidth = 1;
      c.save(); c.translate(0, -413); c.rotate(Math.PI / 4); c.fillStyle = '#c5b982'; c.fillRect(-11, -11, 22, 22); c.strokeStyle = '#d3ce9b'; c.strokeRect(-20, -20, 40, 40); c.restore();
      for (let i = 0; i < 28; i++) { const x = Math.sin(i * 4.9) * 85, y = 45 - ((i * 39 + motion * 13) % 380); this.ellipse(x, y, i % 3 ? 1 : 2, i % 3 ? 1.5 : 2.5, '#d4e3c78c'); }
      c.restore();
      this.poly([[0, 922], [330, 793], [625, 884], [800, 787], [1000, 859], [1115, 802], [1260, 874], [1530, 764], [1770, 823], [1920, 750], [1920, 1080], [0, 1080]], '#102326');
      // Foreground frames the composition; low saturation keeps menu typography dominant.
      for (const [x, y, size] of [[80, 660, 5.5], [285, 705, 4.1], [530, 761, 3], [1850, 835, 7.3], [1660, 810, 4.5], [1910, 1000, 5.4]]) this.tree({ x, y, size, kind: 'tree' });
      c.save(); c.translate(1100, 810); c.scale(1.25, 1.25); this.person(0, 0, 4.5, false, 1); c.restore();
      this.glow(1060, 730, 150, '#e9b96223');
      for (let i = 0; i < 65; i++) { const x = 780 + (i * 71 % 1050), y = 770 + (i * 127 % 290); c.strokeStyle = '#48645955'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4 + Math.sin(motion + i), y - 17); c.moveTo(x, y); c.lineTo(x + 8, y - 11); c.stroke(); } c.lineWidth = 1;
      if (!game.settings?.reducedMotion) for (let i = 0; i < 26; i++) { const x = 650 + ((i * 97 + motion * 7) % 1180), y = 400 + i * 47 % 600 + Math.sin(motion * .7 + i) * 18; this.ellipse(x, y, 1.4, 1.4, '#d1c58765'); }
      const vignette = c.createRadialGradient(1180, 590, 240, 950, 550, 1100); vignette.addColorStop(0, '#06121a00'); vignette.addColorStop(1, '#06121aaa'); c.fillStyle = vignette; c.fillRect(0, 0, 1920, 1080); c.restore();
    }
    battlePositions() { return { player: { x: this.width * .5, y: 382 }, enemy: { x: this.width * .5, y: 292 } }; }
    event(event) {
      const positions = this.battlePositions(), source = positions[event.actorId], target = positions[event.targetId];
      if (event.type === 'damage' || event.type === 'dodge' || event.type === 'miss') {
        this.attacks[event.actorId] = this.time; if (event.type === 'damage') this.hits[event.targetId] = this.time;
        const hitOffset=event.hits>1?(event.hit-(event.hits+1)/2)*34:0;
        this.fx.push({ type: 'text', x: target.x+hitOffset, y: target.y - 65, text: event.type === 'dodge' ? 'DODGE · 閃避' : event.type === 'miss' ? 'MISS' : `${Math.round(event.damage)}`, caption: event.critical ? 'CRITICAL' : '', size: event.critical ? 43 : event.type === 'damage' ? 29 : 23, color: event.type === 'dodge' ? '#a7d6d4' : event.type === 'miss' ? '#a2aaa8' : event.critical ? '#ffe2a0' : '#eee2cb', life: event.critical ? 1.6 : 1.2, total: event.critical ? 1.6 : 1.2 });
        if (event.type === 'damage') { this.fx.push({ type: 'strike', x: target.x, y: target.y - 55, fromX: source.x, fromY: source.y - 55, move: event.moveId, hit:event.hit||1, life: .55, total: .55 }); for (let i = 0; i < 12; i++) this.fx.push({ type: 'spark', x: target.x, y: target.y - 40, vx: (Math.random() - .5) * 180, vy: -Math.random() * 140, life: .6, total: .6 }); }
      }
      if(event.type==='afterimage'){const index=event.index||1,hits=event.hits||1;this.fx.push({type:'echo',x:target.x+(index-(hits+1)/2)*28,y:target.y,fromX:source.x,fromY:source.y,damage:event.damage,delay:event.delay??0,life:.7,total:.7});}
      if (event.type === 'interrupt') { this.fx.push({ type: 'text', x: target.x, y: target.y - 165, text: '中斷！', caption: 'INTERRUPT', size: 28, color: '#d9ad86', life: 1.2, total: 1.2 }); for (let i = 0; i < 8; i++) this.fx.push({ type: 'spark', x: target.x + (i - 4) * 14, y: target.y + 25, vx: (i - 4) * 14, vy: -40, life: .45, total: .45 }); }
    }
    drawBattle(game) {
      const c = this.ctx, w = this.width, h = Math.min(this.height, 395), dungeon = !!game.run.dungeon, b = game.battle;
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, dungeon ? '#141321' : '#172d2d'); g.addColorStop(.55, dungeon ? '#302b3c' : '#334a3f'); g.addColorStop(1, '#111d1a'); c.fillStyle = g; c.fillRect(0, 0, w, this.height);
      this.glow(w * .53, h * .26, h * .65, dungeon ? '#a090db16' : '#9bceb41b');
      if (dungeon) { for (let i = 0; i < 7; i++) { const x = i * w / 6; c.fillStyle = '#45404d'; c.fillRect(x - 18, h * .13, 36, h * .4); c.fillStyle = '#67606c'; c.fillRect(x - 23, h * .12, 46, 14); c.fillStyle = '#282735'; c.fillRect(x - 12, h * .16, 7, h * .35); this.glow(x, h * .38, 75, '#ba98e72a'); this.ellipse(x, h * .38, 4, 8, '#d7bbf2'); } }
      else { for (let i = 0; i < 18; i++) { c.globalAlpha = .5; this.tree({ x: i * w / 17, y: h * (.39 + (i % 3) * .05), size: 1.6 + i % 3, kind: 'tree' }); } c.globalAlpha = 1; }
      this.ellipse(w / 2, h * .67, w * .49, h * .2, dungeon ? '#635b6544' : '#88907822');
      c.strokeStyle = '#b7b18b22'; c.lineWidth = 2; c.beginPath(); c.ellipse(w / 2, h * .65, w * .4, h * .14, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(w / 2, h * .65, w * .33, h * .11, 0, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 9; i++) { const x = (i * 193 % w), y = h * .82 + Math.sin(i) * 18; this.rock({ x, y, size: .65, variant: 0 }); }
      const p = this.battlePositions(), scale = Math.min(w / 230, h / 220, 3.4);
      for (const id of ['enemy']) {
        const actor = b[id], at = p[id], attackAge = this.time - (this.attacks[id] ?? -10), hitAge = this.time - (this.hits[id] ?? -10);
        let x = at.x + (!game.settings?.reducedMotion && attackAge < .3 ? Math.sin(attackAge / .3 * Math.PI) * 26 * (id === 'player' ? 1 : -1) : 0); if (hitAge < .3 && !game.settings?.reducedMotion) x += Math.sin(hitAge * 75) * 5;
        c.save(); if (hitAge < .12) c.filter = 'brightness(2)';
        if (b.phase === 'fighting') this.fallAt = null;
        else if (this.fallAt == null) this.fallAt = this.time;
        const down = b.phase !== 'fighting' && (b.phase === 'victory' ? id === 'enemy' : id === 'player') ? Math.min(1, (this.time - this.fallAt) / .65) : 0;
        if (id === 'player') { this.person(x, at.y - (b.phase === 'victory' ? Math.sin(Math.min(1, (this.time - this.fallAt) / .65) * Math.PI) * 8 : 0), scale, b.phase === 'victory', 1, down); } else this.monster(game.encounter.type, x, at.y, scale * (GameData.monsters[game.encounter.type].sprite==='golem'?.8:game.encounter.type === 'boss' ? .65 : 1.1), down); c.restore();
        if (actor.cast) { const progress = Math.min(1, (b.time - actor.cast.startedAt) / actor.cast.duration); this.glow(at.x, at.y, 60 + progress * 35, id === 'player' ? '#b8d9ea2a' : '#e5ad8520'); c.strokeStyle = id === 'player' ? '#9fc8df' : '#dfa475'; c.lineWidth = 2; c.beginPath(); c.ellipse(at.x, at.y + 5, scale * 22, scale * 8, 0, this.time * 2, this.time * 2 + Math.PI * 1.5); c.stroke(); }
      }
      c.lineWidth = 1;
    }
    drawEffects(dt) {
      const c = this.ctx;
      for (const f of this.fx) { f.life -= dt; const age = f.total - f.life; c.save(); c.globalAlpha = Math.max(0, f.life / f.total);
        if (f.type === 'text') { this.text(f.text, f.x, f.y - age * 40, f.size || 23, f.color); if (f.caption) this.text(f.caption, f.x, f.y - age * 40 - (f.size || 23) - 5, 12, f.color); }
        if(f.type==='echo' && age>=f.delay){c.globalAlpha*=.45;c.globalAlpha*=1.6;this.text(String(Math.round(f.damage)),f.x+20,f.y-80-(age-f.delay)*35,21,'#b8d8df');c.strokeStyle='#b8d8df88';c.lineWidth=3;c.beginPath();c.arc(f.x,f.y-30,36,-.7,1.4);c.stroke();}
        if (f.type === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 220 * dt; this.ellipse(f.x, f.y, 2, 2, '#efcf8b'); }
        if (f.type === 'strike') { const magic = ['fire', 'inferno', 'nova', 'pulse', 'spark'].includes(f.move); if (magic) { const t = Math.min(1, age / .25), x = f.fromX + (f.x - f.fromX) * t, y = f.fromY + (f.y - f.fromY) * t; this.glow(x, y, 60, f.move === 'nova' ? '#e6cf8aaa' : f.move === 'spark' ? '#96c4e6aa' : '#f4a864aa'); this.ellipse(x, y, 9, 9, f.move === 'spark' ? '#dae8fc' : '#ffdfae'); } else { c.strokeStyle = f.move === 'interrupt' ? '#c3affb' : '#f6e9bf'; c.lineWidth = 5;c.save();c.translate(f.x-15,f.y);if(f.hit%2===0)c.scale(-1,1);c.beginPath();c.arc(0,0,55,-.7,1.4);c.stroke();c.restore(); } }
        c.restore();
      } this.fx = this.fx.filter(f => f.life > 0);
    }
    minimap(canvas, run) {
      const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height; c.clearRect(0, 0, w, h); c.fillStyle = '#23362e'; c.fillRect(0, 0, w, h); const sx = w / GameData.world.width, sy = h / GameData.world.height;
      for (const r of GameData.world.regions) { c.fillStyle = r.color; c.fillRect(r.bounds[0]*sx,r.bounds[1]*sy,r.bounds[2]*sx,r.bounds[3]*sy); }
      c.strokeStyle = '#cfbb7a55'; c.lineWidth = 2; c.beginPath(); for(const road of GameData.world.roads){c.moveTo(road[0].x*sx,road[0].y*sy);for(const {x,y}of road.slice(1))c.lineTo(x*sx,y*sy);} c.stroke();
      if (run) { for (const e of run.world.enemies) if (e.discovered && e.defeatedUntil <= run.world.time) { c.fillStyle = '#e4e8d7'; c.fillRect(e.x * sx - 1.5, e.y * sy - 1.5, 3, 3); } for (const d of GameData.dungeons) if (run.world.discoveredDungeons.includes(d.id)) { c.fillStyle = '#c6a6ef'; c.fillRect(d.x * sx - 3, d.y * sy - 3, 6, 6); } c.fillStyle = '#ecde9f'; c.fillRect(GameData.world.camp.x * sx - 2, GameData.world.camp.y * sy - 2, 4, 4); c.fillStyle = '#eef8e7'; c.shadowColor = '#fff'; c.shadowBlur = 8; c.beginPath(); c.arc(run.position.x * sx, run.position.y * sy, 3.5, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; }
    }
    draw(game, dt) { this.resize(); this.time += dt; this.ctx.clearRect(0, 0, this.width, this.height); if (game.scene === 'title') this.drawTitle(game); else if (game.scene === 'battle') this.drawBattle(game); else this.drawWorld(game); this.drawEffects(dt); }
  }
  root.GameArt = { Renderer, icon };
})(globalThis);
