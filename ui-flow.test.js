// Production UI-event integration through a small DOM adapter. Not a browser/layout test.
// Achievement navigation is checked through the same production event handler.
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
test('结算按實際晉階結果，不按累計分數越過任務',()=>{
 const h=harness();h.click('begin-run');const run=h.game.run;run.level=27;run.battleStats.kills=73;run.battleStats.clearedDungeonIds=['abandoned_mine','old_lab'];h.ctx.EncounterFlow.advanceRank(run);h.click('journal');h.click('end-run');h.click('end-run-confirm');
 const html=h.elements.get('modal').innerHTML;assert.match(html,/rating-rank">D−/);assert.match(html,/50 \/ 50 晉階進度/);assert.match(html,/晉階任務尚未完成/);
});
test('任務成就可於探索查看，結算發獎與重整不重複',()=>{
 const h=harness();h.click('begin-run');h.game.run.adventurerRank.index=8;h.game.run.level=27;h.game.run.battleStats.kills=73;h.game.run.battleStats.clearedDungeonIds=['abandoned_mine','old_lab'];
 h.click('journal');h.click('achievements');h.click('achievement-tab','tasks');assert.match(h.elements.get('screen').innerHTML,/已達標 · 結算領取/);h.click('achievement-tab','journey');assert.match(h.elements.get('screen').innerHTML,/雷電術/);h.click('screen-back');
 h.click('journal');h.click('end-run');h.click('end-run-confirm');assert.match(h.elements.get('modal').innerHTML,/任務與成就獎勵/);assert.ok(h.game.permanent.moves.spark);assert.ok(h.game.permanent.skills.includes('economy'));
 const balance=h.game.permanent.meta.marks,next=harness(h.saved);assert.equal(next.game.permanent.meta.marks,balance);assert.match(next.elements.get('modal').innerHTML,/任務與成就獎勵/);
});
test('探索HUD僅滿分顯示任務，直接挑戰升階後歸零且存檔保留',()=>{
 const h=harness();h.click('begin-run');const E=h.ctx.EncounterFlow,g=h.game;
 assert.equal(h.elements.get('adventure-rank').hidden,false);assert.doesNotMatch(h.elements.get('adventure-rank').innerHTML,/rank-hud-task/);
 h.click('adventure-rank');assert.match(h.elements.get('modal').innerHTML,/直接晉階挑戰/);assert.doesNotMatch(h.elements.get('modal').innerHTML,/任務出現後討伐/);h.click('close');
 for(let i=0;i<17;i++)E.victory(g.permanent,g.run,{type:'greywind_0',level:1});vm.runInContext('renderUI()',h.ctx);assert.match(h.elements.get('adventure-rank').innerHTML,/rank-hud-task/);
 h.click('adventure-rank');assert.match(h.elements.get('modal').innerHTML,/任務出現後討伐/);h.click('close');
 for(let i=0;i<2;i++)E.victory(g.permanent,g.run,{type:'greywind_0',level:3});vm.runInContext('renderUI();saveSession()',h.ctx);assert.equal(g.run.adventurerRank.index,1);assert.equal(g.run.adventurerRank.progress,0);assert.doesNotMatch(h.elements.get('adventure-rank').innerHTML,/rank-hud-task/);
 const next=harness(h.saved);assert.equal(next.game.run.adventurerRank.index,1);assert.equal(next.game.run.adventurerRank.progress,0);
});
function harness(initialSave=[]) {
  const elements = new Map(), events = {}, windowEvents = {}, saved = new Map(initialSave); let now = 0, raf; const timers=new Map();let timerClock=0,timerId=0;
  function advanceTimers(ms){timerClock+=ms;for(const [id,t]of [...timers])if(t.at<=timerClock){timers.delete(id);t.fn();}}
  const canvasContext = new Proxy({}, { get(target, name) { if (name in target) return target[name]; if (['createLinearGradient', 'createRadialGradient'].includes(name)) return () => ({ addColorStop() {} }); return () => {}; }, set(target, name, value) { target[name] = value; return true; } });
  class Element {
    constructor(attrs = '', content = '') {
      this.attrs = attrs; this.dataset = {}; this.attributes = {}; this._html = content;
      for (const m of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) this.dataset[m[1]] = m[2];
      this.disabled = /(?:^|\s)disabled(?:\s|=|$)/.test(attrs); this.hidden = /(?:^|\s)hidden(?:\s|=|$)/.test(attrs);
      this.id = attrs.match(/\bid="([^"]+)"/)?.[1]; this.tagName = 'BUTTON'; this.width = 200; this.height = 132;
      this.style = { setProperty(k, v) { this[k] = v; } }; this.classes = new Set(); this.classList = { toggle: (c, yes) => yes ? this.classes.add(c) : this.classes.delete(c), add: c => this.classes.add(c), remove: c => this.classes.delete(c) };
      this.listeners = {}; this.offsetWidth = 360; this.offsetHeight = 380; this.childrenCache = new Map();
    }
    set innerHTML(value) { this._html = value; this.childrenCache.clear(); register(value); }
    get innerHTML() { return this._html; }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    focus() { doc.activeElement = this; } closest() { return this; } contains(e) { return e === this; }
    addEventListener(name, fn) { this.listeners[name] = fn; } setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 1920, height: 1080 }; }
    getContext() { return canvasContext; }
    querySelectorAll(selector) { if (!this.childrenCache.has(selector)) this.childrenCache.set(selector, buttons(this._html).filter(e => selector.includes('data-action') ? e.dataset.action === 'move' : !e.disabled)); return this.childrenCache.get(selector); }
    querySelector(selector) { if (!this.childrenCache.has(selector)) this.childrenCache.set(selector, new Element()); return this.childrenCache.get(selector); }
  }
  function register(html) { for (const m of html.matchAll(/<\w+\b([^>]*)>/g)) { const id = m[1].match(/\bid="([^"]+)"/); if (id) elements.set(id[1], new Element(m[1])); } }
  function buttons(html) { return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => new Element(m[1], m[2])); }
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); register(html); const dirs = buttons(html).filter(e => e.dataset.dir);
  const doc = { getElementById(id) { assert.ok(elements.has(id), 'Missing DOM id: ' + id); return elements.get(id); }, addEventListener: (name, fn) => events[name] = fn, querySelectorAll: () => dirs, hidden: false, activeElement: null, documentElement: {} };
  const math = Object.create(Math); math.random = () => .5;
  const ctx = { document: doc, devicePixelRatio: 1, innerWidth: 1920, innerHeight: 1080, Math: math, Date, performance: { now: () => now }, requestAnimationFrame: fn => raf = fn, localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v), removeItem:k=>saved.delete(k) }, console, setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:timerClock+ms});return id;}, clearTimeout:id=>timers.delete(id) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = (name, fn) => windowEvents[name] = fn; vm.createContext(ctx);
  for (const file of ['combat-content', 'world-content', 'data', 'content-v1', 'world-maps', 'classes', 'achievements', 'skill-runtime', 'engine', 'world-rewards', 'meta', 'progression', 'world', 'renderer', 'ui', 'audio', 'screens', 'debug-lab', 'world-debug', 'run-save', 'level-up', 'meta-screens', 'encounters', 'app']) vm.runInContext(fs.readFileSync(path.join(__dirname, file + '.js'), 'utf8'), ctx, { filename: file + '.js' });
  const game = ctx.GameApp.game;
  function step(count = 1) { for (let i = 0; i < count; i++) { now += 50; raf(now); } }
  function click(action, id, extra = {}) {
    const sources = game.modal ? [elements.get('modal').innerHTML] : game.screen ? [elements.get('screen').innerHTML] : [html, elements.get('skillbar').innerHTML];
    if (action.startsWith('debug')) sources.push(html);
    const element = sources.flatMap(buttons).find(e => e.dataset.action === action && (id == null || e.dataset.id === id) && Object.entries(extra).every(([k, v]) => e.dataset[k] === String(v)));
    assert.ok(element, 'Missing visible UI action: ' + action + ' ' + (id || '') + JSON.stringify(extra)); assert.ok(!element.disabled, 'Disabled action: ' + action);
    events.click({ target: element, preventDefault() {} });
    if(action==='begin-run'){
      assert.equal(game.modal,'world-map');
      click('world-region','north_plains');click('world-map-detail','north_plains_1');click('world-enter-map','north_plains_1');
    }
  }
  function key(key, up = false) { events[up ? 'keyup' : 'keydown']({ key, repeat: false, preventDefault() {}, target: {} }); }
  function forged(action, id) { events.click({ target: new Element(`data-action="${action}" data-id="${id || ''}"`), preventDefault() {} }); }
  return { ctx, game, elements, saved, step, click, key, events, forged, dirs, Element, advanceTimers };
}
test('獨立成就入口分開職業技能招式，未解鎖職業的專屬成就上鎖',()=>{
 const h=harness();h.click('achievements');assert.equal(h.game.screen,'achievements');assert.match(h.elements.get('screen').innerHTML,/職業解鎖/);
 h.click('achievement-tab','skills');assert.match(h.elements.get('screen').innerHTML,/先解鎖職業：戰士/);assert.match(h.elements.get('screen').innerHTML,/劍勢/);
 h.game.permanent.unlockedClassIds.push('WARRIOR');h.click('achievement-tab','skills');assert.doesNotMatch(h.elements.get('screen').innerHTML,/先解鎖職業：戰士/);assert.match(h.elements.get('screen').innerHTML,/先解鎖職業：魔法師/);
 h.click('achievement-tab','moves');assert.match(h.elements.get('screen').innerHTML,/破軍斬/);h.click('screen-back');h.click('setup');h.click('class-achievements');assert.match(h.elements.get('modal').innerHTML,/選擇職業/);assert.doesNotMatch(h.elements.get('modal').innerHTML,/劍士之路/);
});
test('新遊戲鎖定必殺，只有正式第三次倒下永久解鎖；地下城資源跨波及升級保存',()=>{
 const h=harness();h.click('setup');h.click('setup-tab','build');h.click('slot-pick','',{kind:'ultimate'});assert.ok(h.elements.get('modal').innerHTML.includes('尚未解鎖'));h.click('close');h.click('screen-back');h.click('begin-run');
 for(let n=1;n<=3;n++){h.game.scene='explore';vm.runInContext("startEncounter({type:'greywind_0',level:2})",h.ctx);h.game.transition=0;h.game.battle.finish(false);h.step(23);assert.equal(h.game.modal,'result');assert.equal(h.game.permanent.ultimateUnlocked,n===3);if(n===1){h.step(61);assert.equal(h.game.scene,'explore');assert.equal(h.game.modal,null);}else h.click('result-next');}
 assert.equal(h.game.scene,'title');assert.equal(JSON.parse(h.saved.get('afterlight.progress.v2')).ultimateUnlocked,true);const reloaded=harness(h.saved);assert.equal(reloaded.game.permanent.ultimateUnlocked,true);
 const d=harness();d.click('begin-run');d.game.run.level=12;d.game.run.dungeon={id:'abandoned_mine',stage:0};d.game.run.exp=d.ctx.Progression.levelCost(12)-1;vm.runInContext('startEncounter(P.dungeonEncounter(game.run))',d.ctx);d.game.transition=0;const b=d.game.battle;b.player.hp=72;b.player.mana=30;b.player.stamina=40;b.finish(true);d.step(23);const after={...d.game.run.dungeonResources};assert.ok(after.hp>72&&after.hp<d.ctx.Progression.statsFor(d.game.run).hp);d.click('result-next');assert.equal(d.game.battle.player.hp,after.hp);assert.equal(d.game.battle.player.mana,after.mana);assert.equal(d.game.battle.player.stamina,after.stamina);
});
// Existing collectors still exercise all four slots; new-game tests use harness().
function legacyHarness(){const P=require('./progression'),p=P.freshProgress();p.ultimateUnlocked=true;p.skills=['vigor','control','agility','lucky'];p.moves.heavy=1;p.moves.interrupt=1;p.equipment.push('greatsword');const b=P.defaultBuild();b.ultimate='nova';b.talents=[...p.skills];b.moves=['quick','heavy','fire','interrupt'];return harness([['afterlight.progress.v2',JSON.stringify(p)],['afterlight.loadout.v1',JSON.stringify(b)]]);}
test('四個主選單入口、分頁、技能槽、必殺、紙娃娃、能力庫與設定', () => {
  const h = legacyHarness(), { game, click, elements } = h;
  click('setup'); assert.equal(game.screen, 'setup'); assert.ok(elements.get('screen').innerHTML.includes('基礎數值'));
  click('stat-explain', 'mana'); assert.ok(elements.get('modal').innerHTML.includes('20%')); click('close');
  click('setup-tab', 'build'); click('slot-pick', 'vigor', { kind: 'talents', index: 0 }); click('picker-remove'); assert.equal(game.build.talents.length, 3);
  click('slot-pick', '', { kind: 'talents', index: 3 }); click('picker-select', 'vigor'); assert.equal(game.build.talents.length, 4);
  click('slot-pick', 'nova', { kind: 'ultimate' }); click('picker-remove'); assert.equal(game.build.ultimate, null);
  click('slot-pick', '', { kind: 'ultimate' }); click('picker-select', 'nova'); assert.equal(game.build.ultimate, 'nova');
  click('setup-tab', 'equipment'); assert.ok(elements.get('screen').innerHTML.includes('paperdoll')); click('gear-pick', 'sword'); click('picker-select', 'greatsword'); assert.equal(game.build.equipment.weapon, 'greatsword');
  click('library'); assert.equal(game.screen, 'library'); click('catalog-select', 'fire'); assert.ok(elements.get('screen').innerHTML.includes('永久 Lv.1 / 3'));
  click('library-equip', 'fire'); assert.ok(!game.build.moves.includes('fire')); click('library-equip', 'fire'); assert.equal(game.build.moves.length, 4);
  click('library-category', 'books'); assert.ok(elements.get('screen').innerHTML.includes('第一本魔法書'));
  click('screen-back'); click('settings'); click('setting-toggle', 'sound'); assert.equal(game.settings.sound, false);
  click('setting-toggle', 'reducedMotion'); assert.equal(game.settings.reducedMotion, true);
  h.events.input({ target: { id: 'volume', value: '31' } }); assert.equal(game.settings.volume, .31); assert.equal(JSON.parse(h.saved.get('afterlight.settings.v1')).volume, .31);
  click('screen-back'); assert.equal(game.screen, null); assert.ok(h.saved.has('afterlight.loadout.v1'));
});
test('新 UI 完整流程：四方向戰鬥、充能警告、四場地下城、替換確認、重複升级、死亡與永久學習', () => {
  const h = legacyHarness(), { game, click, key, step, elements } = h;
  const hooks = []; h.ctx.GameAudio.subscribe(name => hooks.push(name));
  click('begin-run');game.run.level=5;game.run.exp=h.ctx.Progression.levelCost(5)-1; const start = game.run.position.x; key('d'); step(20); key('d', true); assert.ok(game.run.position.x > start + 100);
  game.run.position={x:game.run.world.enemies[0].x,y:game.run.world.enemies[0].y};key('e'); assert.equal(game.scene, 'battle'); key('w'); assert.equal(game.battle.player.cast, null, 'transition blocks skill selection'); step(12);
  key('a'); assert.equal(game.battle.player.cast.moveId, 'interrupt'); step(65); assert.ok(game.battle.events.some(e => e.type === 'interrupt'));
  const position = { ...game.run.position }; key('w'); step(2); assert.deepEqual({ ...game.run.position }, position, 'battle WASD must not move on map');
  game.battle.charge = h.ctx.GameData.moves.nova.ultimateChargeCost; const mp = game.battle.player.mana; game.battle.player.mana = 0; step(2);
  assert.equal(elements.get('charge-label').textContent, 'READY'); assert.equal(elements.get('ultimate-warning').textContent, '資源不足');
  key(' '); assert.equal(game.battle.charge, h.ctx.GameData.moves.nova.ultimateChargeCost); game.battle.player.mana = mp;
  // Real tooltip controller, not native title text.
  h.events.pointerover({ target: new h.Element('data-tooltip="move:fire"'), pointerType: 'mouse' }); h.advanceTimers(600); assert.equal(elements.get('tooltip').hidden, false); assert.ok(elements.get('tooltip').innerHTML.includes('讀條'));
  function winBattle() { for (let i = 0; i < 1200 && game.modal !== 'result'; i++) { if (game.battle.charge >= h.ctx.GameData.moves.nova.ultimateChargeCost) key(' '); key('w'); step(); } assert.equal(game.modal, 'result'); assert.equal(game.result.won, true); }
  winBattle(); assert.equal(game.run.points,0);assert.ok(elements.get('modal').innerHTML.includes('等級提升')); click('result-next');
  const beforeBuild = JSON.stringify(game.run.build); h.forged('library'); assert.equal(game.screen, null); assert.equal(JSON.stringify(game.run.build), beforeBuild);
  click('journal'); assert.ok(!elements.get('modal').innerHTML.includes('data-action="library-equip"')); click('close');
  game.run.level=50;key('F1'); click('debug-dungeon'); step(3); key('e'); click('enter-dungeon', 'abandoned_mine');
  for (let i = 0; i < 4; i++) { winBattle(); assert.equal(game.run.points,0); click('result-next'); }
  assert.equal(game.modal, 'reward'); const rewardedSkill=game.run.pendingAcquisitions.find(x=>x.kind==='talents')?.id;assert.ok(rewardedSkill);assert.ok(game.permanent.skills.includes(rewardedSkill)); assert.ok(elements.get('modal').innerHTML.includes('SKILL') === false || elements.get('modal').innerHTML.includes('再次取得')); click('reward-next');
  assert.equal(game.modal, 'acquire'); assert.equal(game.offered.id, rewardedSkill); click('acquire-equip'); assert.equal(game.modal, 'replace');
  const oldMoves = [...game.run.build.talents]; click('replace-choose', null, { index: 1 }); assert.equal(game.modal, 'replace-confirm'); assert.deepEqual([...game.run.build.talents], oldMoves, 'no mutation before confirm');
  click('replace-back'); click('replace-choose', null, { index: 3 }); click('replace-confirm'); assert.equal(game.run.build.talents[3], rewardedSkill); assert.equal(game.run.pendingAcquisitions.length, 0); assert.equal(game.scene, 'explore');
  key('e'); click('enter-dungeon', 'abandoned_mine');
  for (let i = 0; i < 4; i++) { winBattle(); assert.equal(game.run.points,0); click('result-next'); }
  assert.ok(game.permanent.skills.includes(rewardedSkill)); click('reward-next'); assert.equal(game.scene, 'explore', 'duplicate must not offer another slot');
  assert.ok(h.saved.has('afterlight.progress.v2'));
  game.run.level=1;for (let death = 1; death <= 3; death++) { if (death > 1) { key('F1'); click('debug-dungeon'); step(3); } key('e'); click('enter-dungeon', 'abandoned_mine'); for (let i = 0; i < 4000 && game.modal !== 'result'; i++) step(); assert.equal(game.run.deaths, death); click('result-next'); }
  assert.equal(game.scene, 'title'); game.permanent.books.push('inferno');game.permanent.moves.fire=3;click('library'); click('library-category', 'books'); assert.ok(elements.get('screen').innerHTML.includes('3 / 3')); click('learn-book', 'inferno'); assert.equal(game.permanent.moves.inferno, 1);
  click('library-category', 'moves'); click('catalog-select', 'inferno'); click('library-equip', 'inferno'); assert.equal(game.modal, 'library-replace'); click('loadout-replace', null, { index: 2 });
  click('begin-run'); assert.equal(game.run.level, 1); assert.equal(game.run.moveLevels.fire, 3); assert.ok(game.run.build.moves.includes('inferno'));
  for (const name of ['buttonConfirm', 'skillSelect', 'skillCast', 'damage', 'levelUp', 'itemGain', 'dungeonEnter', 'ultimateReady', 'interrupt']) assert.ok(hooks.includes(name), 'Missing audio hook: ' + name);
});

test('中央搖桿的類比移動、第二指隔離、放手與選單停止移動', () => {
  const h = harness(); h.click('begin-run');
  const joystick = h.elements.get('joystick');
  joystick.getBoundingClientRect = () => ({ left:100, top:500, width:164, height:164 });
  const pointer = (id, x, y) => ({ pointerId:id, clientX:x, clientY:y, preventDefault(){} });
  joystick.listeners.pointerdown(pointer(1,210,582));
  let direction = vm.runInContext('input()', h.ctx); assert.ok(direction.x > 0 && direction.x < 1); assert.equal(direction.y,0);
  joystick.listeners.pointerdown(pointer(2,130,582)); assert.ok(vm.runInContext('input().x',h.ctx)>0);
  joystick.listeners.pointermove(pointer(1,230,550)); direction=vm.runInContext('input()',h.ctx); assert.ok(direction.x>0 && direction.y<0);
  joystick.listeners.pointerup(pointer(2,130,582)); assert.ok(vm.runInContext('input().x',h.ctx)>0);
  joystick.listeners.pointercancel(pointer(1,230,550)); assert.equal(vm.runInContext('input().x',h.ctx),0);
  joystick.listeners.pointerdown(pointer(3,220,582)); h.click('settings'); h.click('screen-back'); assert.equal(vm.runInContext('input().x',h.ctx),0);
  joystick.listeners.pointerdown(pointer(4,220,582)); joystick.listeners.lostpointercapture(pointer(4,220,582)); assert.equal(vm.runInContext('input().x',h.ctx),0);
});

test('正式探索 HUD 僅鄰近入口顯示互動，七大區地圖可查看且無 NPC',()=>{
 const h=harness();h.click('begin-run');const run=h.game.run;run.world.enemies=[];run.position={x:80,y:80};h.step(2);assert.equal(h.elements.get('interact').hidden,true);assert.equal(h.elements.get('skillbar').hidden,true);assert.equal(h.ctx.GameData.explorationObjects.length,0);
 const d=h.ctx.GameData.dungeons[0];h.click('world-map');h.click('world-region','central_mines');h.click('world-map-detail',d.mapId);h.click('world-enter-map',d.mapId);run.position={x:d.x,y:d.y+65};h.step(2);assert.equal(h.elements.get('interact').hidden,false);h.click('interact');assert.equal(h.game.modal,'dungeon');assert.ok(h.elements.get('modal').innerHTML.includes('Lv.12'));assert.ok(!h.elements.get('modal').innerHTML.includes('heavy_slash'));h.click('close');h.click('journal');h.click('world-map');assert.ok(h.elements.get('modal').innerHTML.includes('暗黑帝國'));h.click('close');assert.equal(h.game.scene,'explore');
});

test('世界地圖可跨七大區切換，局內已取得招式可重新配置且重整保留',()=>{
 const h=harness();h.click('begin-run');const run=h.game.run;run.level=18;run.ultimateCharge=27;h.ctx.Progression.receiveAbility(h.game.permanent,run,'moves','spark');run.pendingAcquisitions=[];
 h.click('world-map');h.click('world-region','southern_kingdom');h.click('world-map-detail','southern_kingdom_1');assert.match(h.elements.get('modal').innerHTML,/舊魔法研究室/);h.click('world-enter-map','southern_kingdom_1');assert.equal(run.currentMapId,'southern_kingdom_1');
 h.click('journal');h.click('run-loadout');h.click('run-slot',null,{kind:'moves',index:0});h.click('run-config-select','spark');assert.equal(run.build.moves[0],'spark');assert.equal(run.level,18);assert.equal(run.ultimateCharge,27);
 h.click('close');const second=harness(h.saved);assert.equal(second.game.run.currentMapId,'southern_kingdom_1');assert.equal(second.game.run.build.moves[0],'spark');assert.equal(second.game.run.level,18);
});

test('靠近右側邊界顯示下一區，互動後保留本局狀態並從另一側進場',()=>{
 const h=harness();h.click('begin-run');h.click('world-map');h.click('world-region','north_plains');h.click('world-map-detail','north_plains_2');h.click('world-enter-map','north_plains_2');const run=h.game.run;run.level=31;run.ultimateCharge=44;run.position={x:h.ctx.GameData.world.width-40,y:1800};h.step(2);
 assert.equal(h.elements.get('interact').hidden,false);assert.match(h.elements.get('interact').textContent,/前往下一區.*地圖 3/);h.click('interact');assert.equal(run.currentMapId,'north_plains_3');assert.equal(run.position.x,180);assert.equal(run.position.y,1800);assert.equal(run.level,31);assert.equal(run.ultimateCharge,44);
});

test('v0.2 HUD 最終消耗、液面、需求線、MP/SP 分色與容器充能',()=>{
 const h=harness();h.click('begin-run');const b=h.ctx.GameDebug.build({talents:['economy'],moves:['fireball','heavy_slash'],rng:()=>.99});h.game.battle=b;h.game.run.build=b.build;h.game.scene='battle';h.game.transition=0;h.game.encounter={type:'boss',level:1};
 vm.runInContext('rebuildSkills();renderUI()',h.ctx);
 const buttons=h.elements.get('skillbar').querySelectorAll('[data-action="move"]'),mp=buttons[0],sp=buttons[1],ult=buttons[4];
 assert.equal(mp.dataset.resource,'mana');assert.equal(sp.dataset.resource,'stamina');assert.equal(mp.style['--liquid'],'100%');assert.equal(mp.style['--demand'],'17%');assert.equal(mp.querySelector('.actual-cost').textContent,'17 MP');
 assert.ok(mp.innerHTML.includes('博阿露巫・爾拉'));assert.ok(mp.innerHTML.includes('火球術'));
 b.player.mana=50;vm.runInContext('renderUI()',h.ctx);assert.equal(mp.style['--liquid'],'50%');
 b.player.mana=16;vm.runInContext('renderUI()',h.ctx);assert.equal(mp.attributes['aria-disabled'],'true');assert.equal(b.choose('fireball').ok,false);
 b.player.mana=100;const chargeCost=h.ctx.GameData.moves[b.build.ultimate].ultimateChargeCost;for(const percent of [0,25,50,75,100]){b.charge=chargeCost*percent/100;vm.runInContext('renderUI()',h.ctx);assert.equal(ult.style['--charge'],percent+'%');assert.equal(h.elements.get('charge-label').textContent,percent===100?'READY':percent+'%');assert.equal(ult.attributes['aria-disabled'],percent===100?'false':'true');}
 b.player.mana=0;vm.runInContext('renderUI()',h.ctx);assert.equal(h.elements.get('charge-label').textContent,'READY');assert.equal(h.elements.get('ultimate-warning').textContent,'資源不足');assert.equal(ult.attributes['aria-disabled'],'true');
 h.events.focusin({target:mp});h.advanceTimers(600);assert.ok(h.elements.get('tooltip').innerHTML.includes('17 MP'));assert.ok(h.elements.get('tooltip').innerHTML.includes('節能施法'));assert.ok(h.elements.get('tooltip').innerHTML.includes('預估傷害'));
});

test('設定頁可開啟測試工作台、修改資源／大絕／屬性並開始獨立戰鬥',()=>{
 const h=harness();h.click('settings');const settingsHtml=h.ctx.GameScreens.settings(h.game.settings);assert.ok(settingsHtml.includes('遊戲版本'));assert.ok(settingsHtml.includes('v'+h.ctx.GameData.release.version));h.click('debug-lab');
 const values={};for(let i=0;i<4;i++){values['skill-'+i]=['economy','afterimage','chill','earth_body'][i];values['move-'+i]=['fireball','double_slash','water_0','earth_0'][i];}
 Object.assign(values,{ultimate:'nova',hp:'1000',mana:'50',stamina:'80',agility:'70',charge:'75',physical:'1.2',attack:'5',element:'light','enemy-element':'dark','enemy-element2':'fire',statuses:'[]'});
 for(const k of ['head','chest','arms','feet','weapon'])values['gear-'+k]=k==='weapon'?'sword':'';
 for(const [id,value]of Object.entries(values))h.elements.get('lab-'+id).value=value;
 const saved=JSON.stringify(h.game.permanent);h.click('debug-start');assert.equal(h.game.scene,'battle');assert.equal(h.game.debugBattle,true);assert.equal(h.game.battle.player.mana,50);assert.equal(h.game.battle.charge,h.ctx.GameData.moves.nova.ultimateChargeCost*.75);assert.equal(h.game.battle.enemy.elements.length,2);assert.equal(JSON.stringify(h.game.permanent),saved);
 h.click('pause');assert.equal(h.game.modal,'debug-lab');h.click('debug-end');assert.equal(h.game.scene,'title');assert.equal(h.game.run,null);assert.equal(JSON.stringify(h.game.permanent),saved);
});

test('招式介紹延遲、移出取消、觸控短按不開啟、長按才顯示',()=>{
 const h=harness();h.click('begin-run');const target=new h.Element('data-tooltip="move:fire"');
 h.events.pointerover({target,pointerType:'mouse'});h.advanceTimers(599);assert.equal(h.elements.get('tooltip').hidden,true);h.advanceTimers(1);assert.equal(h.elements.get('tooltip').hidden,false);
 h.events.pointerout({target});h.events.pointerover({target,pointerType:'mouse'});h.advanceTimers(200);h.events.pointerout({target});h.advanceTimers(500);assert.equal(h.elements.get('tooltip').hidden,true);
 h.events.pointerdown({target,pointerType:'touch',clientX:10,clientY:10});h.advanceTimers(200);h.events.pointerup({});h.advanceTimers(500);assert.equal(h.elements.get('tooltip').hidden,true);
 h.events.pointerdown({target,pointerType:'touch',clientX:10,clientY:10});h.advanceTimers(419);assert.equal(h.elements.get('tooltip').hidden,true);h.advanceTimers(1);assert.equal(h.elements.get('tooltip').hidden,false);
 h.events.pointercancel({});h.events.pointerdown({target,pointerType:'touch',clientX:10,clientY:10});h.events.pointermove({clientX:40,clientY:40});h.advanceTimers(600);assert.equal(h.elements.get('tooltip').hidden,true);
});
test('戰鬥與殘影效果不繪製玩家本體',()=>{
 const h=harness();h.click('begin-run');const renderer=h.ctx.GameApp.renderer;
 h.game.battle=h.ctx.GameDebug.build();h.game.encounter={type:'boss',level:1};renderer.width=480;renderer.height=480*16/9;
 renderer.person=()=>{throw Error('戰鬥不可繪製玩家');};renderer.drawBattle(h.game);
 renderer.event({type:'afterimage',actorId:'player',targetId:'enemy',damage:20,delay:.15});renderer.drawEffects(.2);
});


test('世界測試 UI：查看敵人／獎勵池、指定組合／池、等級修改與跨區傳送',()=>{
 const h=harness();h.click('settings');h.click('world-debug');const set=(id,value)=>h.elements.get('world-'+id).value=value;
 set('region','obsidian');set('dungeon','terminal_structure');set('level','190');set('enemy',h.game.run.world.enemies[0].id);set('enemy-level','99');set('samples','100');set('combination','rare');set('pool','');
 const saved=JSON.stringify(h.game.permanent);h.click('world-enemies');assert.ok(h.elements.get('world-output').textContent.includes('黑曜禁域'));h.click('world-inspect');assert.ok(h.elements.get('world-output').textContent.includes('terminal_structure_primary'));h.click('world-sample');assert.equal(JSON.parse(h.elements.get('world-output').textContent).combinations.rare,100);
 set('pool','abandoned_mine_secondary');h.click('world-sample');assert.equal(JSON.parse(h.elements.get('world-output').textContent).count,100);assert.equal(JSON.stringify(h.game.permanent),saved);h.click('world-level');assert.equal(h.game.run.level,190);h.click('world-enemy-level');assert.equal(h.game.run.world.enemies[0].level,99);h.click('world-teleport');assert.equal(h.game.scene,'explore');assert.equal(h.game.run.currentMapId,'dark_empire_5');
});

test('十一座地下城可經 UI 入口、連戰、領獎、返回探索；Lv.1 無進入硬鎖',()=>{
 for(const id of ['abandoned_mine','old_lab','root_cave','sunken_temple','lava_vein','giant_ruins','frozen_tower','thunder_workshop','blacklight_chapel','element_abyss','terminal_structure']){
  const h=harness();h.click('begin-run');const d=h.ctx.GameData.dungeons.find(d=>d.id===id),run=h.game.run;h.click('world-map');h.click('world-region',h.ctx.GameData.maps[d.mapId].regionId);h.click('world-map-detail',d.mapId);h.click('world-enter-map',d.mapId);run.world.enemies=[];run.position={x:d.x,y:d.y+65};h.step(2);h.click('interact');h.click('enter-dungeon',id);assert.equal(run.level,1);assert.equal(h.game.scene,'battle');
  for(let i=0;i<d.enemyWaves.length;i++){const b=h.game.battle;b.player.stats.stamina=100000;b.player.stamina=100000;b.player.stats.hp=100000;b.player.hp=100000;for(let ticks=0;ticks<1200&&h.game.modal!=='result';ticks++){h.key('w');h.step();}assert.equal(h.game.result.won,true,id+' wave '+i);h.click('result-next');}
  assert.equal(h.game.modal,'reward');assert.equal(h.game.permanent.dungeonCompletions[id],1);h.click('reward-next');while(h.game.modal==='acquire')h.click('acquire-skip');assert.equal(h.game.scene,'explore');assert.equal(run.dungeon,null);
 }
});


test('重新整理接續探索位置、戰鬥讀條，並暫停等待玩家操作',()=>{
 const h=harness();h.click('begin-run');h.game.run.position={x:650,y:350};h.click('journal');const second=harness(h.saved);assert.equal(second.game.scene,'explore');assert.equal(second.game.run.position.x,650);assert.equal(second.game.modal,'pause');second.click('close');second.game.run.position={x:590,y:350};second.click('interact');second.step(12);second.key('w');second.step(22);const before=second.game.battle,third=harness(second.saved);assert.equal(third.game.scene,'battle');assert.equal(third.game.modal,'pause');assert.ok(third.game.battle.time<=before.time);assert.equal(third.game.battle.player.mana,before.player.mana);third.click('close');const time=third.game.battle.time;third.step(3);assert.ok(third.game.battle.time>time);
});

test('從網頁版開始冒險時請求全螢幕，已安裝 App 不重複請求',()=>{
 const h=harness();let requested=0;h.ctx.document.documentElement.requestFullscreen=()=>{requested++;return Promise.resolve();};h.click('begin-run');assert.equal(requested,1);
 const installed=harness();installed.ctx.matchMedia=()=>({matches:true});installed.ctx.document.documentElement.requestFullscreen=()=>{throw Error('installed app should not request fullscreen');};installed.click('begin-run');assert.equal(installed.game.scene,'explore');
});

test('重整領獎畫面不重複發放，取得新能力選擇可繼續',()=>{
 const h=harness();h.click('begin-run');const run=h.game.run;run.dungeon={id:'abandoned_mine',stage:3};h.game.rewards=h.ctx.Progression.dungeonReward(h.game.permanent,run,()=>0,{combination:'move_gear'});h.game.scene='explore';vm.runInContext('showReward();saveSession()',h.ctx);const second=harness(h.saved);assert.equal(second.game.modal,'reward');assert.equal(second.game.permanent.completions,1);second.click('reward-next');assert.equal(second.game.modal,'acquire');const third=harness(second.saved);assert.equal(third.game.modal,'acquire');third.click('acquire-skip');assert.equal(third.game.scene,'explore');assert.equal(third.game.permanent.completions,1);
});


test('全新開局兩招無技能，升級畫面五項跳字落在實際值並可跳過',()=>{
 const h=harness();h.click('begin-run');assert.equal(h.game.run.build.moves.length,2);assert.equal(h.game.run.build.talents.length,0);const run=h.game.run;run.exp=h.ctx.Progression.levelCost(1)+h.ctx.Progression.levelCost(2);const exp=h.ctx.Progression.grantExp(run,2);h.game.result={won:true,exp,beforeLevel:exp.beforeLevel};h.game.encounter={type:'greywind_0',level:2};vm.runInContext('showResult();saveSession()',h.ctx);assert.ok(h.elements.get('modal').innerHTML.includes('等級提升'));assert.ok(!h.elements.get('modal').innerHTML.includes('data-action="allocate"'));const before=JSON.stringify(h.ctx.Progression.statsFor(run));h.step(40);for(const k of ['hp','mana','stamina','agility','luck'])assert.equal(h.elements.get('growth-'+k).textContent,Number(exp.afterStats[k].toFixed(1)).toLocaleString('zh-TW'));assert.equal(JSON.stringify(h.ctx.Progression.statsFor(run)),before);const reload=harness(h.saved);assert.equal(reload.game.modal,'result');assert.equal(reload.game.run.level,run.level);reload.click('result-next');assert.equal(reload.game.scene,'explore');
 const quick=harness();quick.click('begin-run');quick.game.run.exp=100;const e=quick.ctx.Progression.grantExp(quick.game.run,2);quick.game.result={won:true,exp:e};quick.game.encounter={type:'greywind_0',level:2};vm.runInContext('showResult()',quick.ctx);quick.click('result-next');assert.equal(quick.game.scene,'explore');
});
test('基礎配置重開需確認，取消不改本局，確認保留收藏',()=>{const h=legacyHarness();h.click('begin-run');h.game.run.level=8;const permanent=JSON.stringify(h.game.permanent);h.click('settings');h.click('restart-basic');h.click('close');assert.equal(h.game.run.level,8);h.click('restart-basic');h.click('restart-basic-confirm');assert.equal(h.game.run.level,1);assert.equal(h.game.run.build.moves.length,2);assert.equal(h.game.run.build.talents.length,0);const expected=JSON.parse(permanent);assert.equal(JSON.stringify(h.game.permanent.moves),JSON.stringify(expected.moves));assert.equal(JSON.stringify(h.game.permanent.skills),JSON.stringify(expected.skills));assert.equal(h.game.permanent.meta.runs,expected.meta.runs+1);assert.equal(h.game.permanent.meta.marks,expected.meta.marks+10);assert.ok(h.game.permanent.completedAchievementIds.includes('ACH_JOURNEY_RANK_0'));});


test('整局結算呈現本局所有收穫，重整後清單仍在且不重發',()=>{const h=harness();h.click('begin-run');const g=h.game;h.ctx.Progression.grantRewards(g.permanent,g.run,[{kind:'moves',id:'spark'},{kind:'equipment',id:'windboots'},{kind:'books',id:'inferno'},{kind:'talents',id:'economy'}]);g.run.status='failed';g.run.deaths=3;g.result={won:false,exp:null};g.encounter={type:'greywind_0',level:2};vm.runInContext('showResult();saveSession()',h.ctx);const html=h.elements.get('modal').innerHTML;assert.ok(html.includes('冒險結算'));for(const text of ['雷電術','疾風靴','爆炎','節能施法'])assert.ok(html.includes(text));const next=harness(h.saved);assert.ok(next.elements.get('modal').innerHTML.includes('本局收穫'));assert.equal(Object.values(next.game.run.loot).reduce((n,r)=>n+r.count,0),4);next.click('result-next');assert.equal(next.game.scene,'title');next.click('begin-run');assert.equal(Object.keys(next.game.run.loot).length,0);});
test('實際戰鬥結果流程將充能带往下一場',()=>{const h=harness();h.click('begin-run');h.game.run.position={x:590,y:350};h.click('interact');h.step(12);h.game.battle.charge=8.5;h.game.battle.finish(true);h.step(25);assert.equal(h.game.modal,'result');assert.equal(h.game.run.ultimateCharge,8.5);h.click('result-next');vm.runInContext("startEncounter({type:'greywind_0',level:2})",h.ctx);assert.equal(h.game.battle.charge,8.5);});


test('Lv.18 大型石頭人在營地附近保持中立，只有點擊互動才進戰鬥',()=>{const h=harness();h.click('begin-run');const run=h.game.run,e=run.world.enemies.find(e=>e.type==='camp_golem'),d=h.ctx.GameData.monsters[e.type];assert.equal(e.level,18);assert.equal(d.sprite,'golem');assert.ok(d.worldScale>1.1);assert.ok(h.ctx.World.distance(e,h.ctx.GameData.world.camp)<300);run.world.enemies=[e];run.position={x:e.x,y:e.y};h.step(30);assert.equal(h.game.scene,'explore');assert.equal(e.x,e.homeX);assert.equal(e.y,e.homeY);assert.equal(e.alert,false);h.click('interact');assert.equal(h.game.scene,'battle');assert.equal(h.game.encounter.type,'camp_golem');});
test('完全重置：取消保留、確認清除所有遊戲進度與設定、不動其他網站資料',()=>{const h=legacyHarness();h.saved.set('unrelated','keep');h.click('begin-run');h.game.run.level=12;h.game.permanent.moves.fire=3;h.game.permanent.books.push('inferno');h.click('settings');h.click('setting-toggle','sound');h.click('full-reset');h.click('close');assert.equal(h.game.run.level,12);assert.equal(h.game.permanent.moves.fire,3);h.click('full-reset');h.click('full-reset-confirm');assert.equal(h.game.scene,'title');assert.equal(h.game.run,null);assert.equal(h.game.permanent.moves.fire,1);assert.equal(h.game.permanent.books.length,0);assert.equal(h.game.permanent.skills.length,0);assert.equal(h.game.settings.sound,true);assert.equal(h.saved.get('unrelated'),'keep');assert.equal(h.saved.has('afterlight.progress.v2'),false);assert.equal(h.saved.has('afterlight.loadout.v1'),false);assert.equal(h.saved.has('afterlight.settings.v1'),false);const reload=harness(h.saved);assert.equal(reload.game.scene,'title');assert.equal(reload.game.run,null);assert.equal(reload.game.permanent.moves.fire,1);});
test('重置存取遭拒時不清空目前記憶體進度，舊存檔補石頭人且不重複',()=>{const h=legacyHarness();h.click('begin-run');h.game.run.level=9;h.game.run.world.enemies=h.game.run.world.enemies.filter(e=>e.type!=='camp_golem');h.click('settings');const first=harness(h.saved);assert.equal(first.game.run.world.enemies.filter(e=>e.type==='camp_golem').length,1);first.click('close');first.click('settings');const second=harness(first.saved);assert.equal(second.game.run.world.enemies.filter(e=>e.type==='camp_golem').length,1);h.ctx.localStorage.removeItem=()=>{throw Error('denied');};h.click('full-reset');h.click('full-reset-confirm');assert.equal(h.game.run.level,9);assert.equal(h.game.modal,'full-reset');});
test('商店購買永久解鎖、圖鑑分頁與下一局配置，魔法名稱維持大字上排中文小字下排',()=>{const h=harness();h.ctx.GameMeta.normalize(h.game.permanent).marks=1000;h.click('shop');const shop=h.game.permanent.meta.shop,key=shop.items[0],item=h.ctx.GameMeta.catalog.find(c=>c.key===key),before=h.game.permanent.meta.marks;h.click('shop-buy',key);assert.equal(h.game.permanent.meta.marks,before-item.price);h.forged('shop-buy',key);assert.equal(h.game.permanent.meta.marks,before-item.price);h.click('screen-back');h.click('codex');h.click('codex-tab','skills');assert.ok(h.elements.get('screen').innerHTML.includes('尚未發現'));h.click('screen-back');const next=harness(h.saved);assert.equal(next.game.permanent.meta.marks,before-item.price);assert.ok(item.kind==='moves'?next.game.permanent.moves[item.id]:next.game.permanent.skills.includes(item.id));h.game.permanent.moves.flame_bolt=1;h.game.permanent.ultimateUnlocked=true;h.game.build.moves=['quick','fire','flame_bolt'];h.game.build.ultimate='flame_bolt';h.click('begin-run');const html=h.elements.get('skillbar').innerHTML;assert.ok(html.includes('<strong class="spell-name">博阿露巫・德</strong><span class="skill-subtitle">火焰彈</span>'));assert.equal((html.match(/<strong class="spell-name">博阿露巫・德/g)||[]).length,2);});
test('主動結算徽記後可返回商店，重整結果不重領',()=>{const h=harness();h.click('begin-run');h.ctx.GameMeta.encounter(h.game.permanent,'greywind_0',true,h.game.run);vm.runInContext('showJournal()',h.ctx);h.click('end-run');h.click('end-run-confirm');assert.equal(h.game.modal,'result');assert.ok(h.elements.get('modal').innerHTML.includes('＋2 ◇'));assert.equal(h.game.permanent.meta.marks,12);const next=harness(h.saved);assert.equal(next.game.permanent.meta.marks,12);next.click('result-next');next.click('shop');assert.equal(next.game.permanent.meta.marks,12);});
test('本局正常擊敗後觸發0.55秒壓制，不進戰鬥HUD，重整演出與結算不重發',()=>{const h=harness();h.click('begin-run');const e=h.game.run.world.enemies[0];h.game.run.level=e.level+5;h.ctx.quickTestEnemy=e;vm.runInContext('startEncounter(quickTestEnemy)',h.ctx);assert.equal(h.game.scene,'battle');h.game.battle.finish(true);h.step(35);assert.ok(h.game.run.defeatedEnemyTypesThisRun.includes(e.type));h.click('result-next');e.defeatedUntil=0;vm.runInContext('startEncounter(quickTestEnemy)',h.ctx);assert.equal(h.game.scene,'explore');assert.equal(h.game.battle,null);assert.equal(h.game.modal,'suppression');h.key('Escape');assert.equal(h.game.modal,'suppression');h.step(3);vm.runInContext('saveSession()',h.ctx);const next=harness(h.saved);assert.equal(next.game.modal,'suppression');const before=next.game.run.exp;next.step(14);assert.equal(next.game.modal,'result');assert.ok(next.game.result.quick);assert.equal(next.game.run.battleStats.normalKills,1);assert.equal(next.game.run.battleStats.quickKills,1);assert.ok(next.game.run.exp>before);const earned=next.game.run.metaRewards.combat;const third=harness(next.saved);assert.equal(third.game.modal,'result');assert.equal(third.game.run.metaRewards.combat,earned);assert.equal(third.game.run.battleStats.quickKills,1);});
test('關閉自動壓制後即使符合門檻仍正常戰鬥，設定跨重整保留',()=>{const h=harness();h.click('settings');h.click('setting-toggle','autoQuickBattle');assert.equal(h.game.settings.autoQuickBattle,false);const next=harness(h.saved);assert.equal(next.game.settings.autoQuickBattle,false);next.click('begin-run');const e=next.game.run.world.enemies[0];next.game.run.level=e.level+5;next.game.run.defeatedEnemyTypesThisRun=[e.type];next.ctx.quickTestEnemy=e;vm.runInContext('startEncounter(quickTestEnemy)',next.ctx);assert.equal(next.game.scene,'battle');assert.equal(next.game.run.quickBattle,undefined);});
test('多敵人任一不合格時整組正常戰鬥，不部分壓制或遺漏剩餘敵人',()=>{const h=harness();h.click('begin-run');const [a,b]=h.game.run.world.enemies;h.game.run.level=20;h.game.run.defeatedEnemyTypesThisRun=[a.type];h.ctx.testGroup={enemies:[a,b]};vm.runInContext('startEncounter(testGroup)',h.ctx);assert.equal(h.game.scene,'battle');assert.equal(h.game.encounter.id,a.id);h.game.battle.finish(true);h.step(35);h.click('result-next');assert.equal(h.game.scene,'battle');assert.equal(h.game.encounter.id,b.id);assert.equal(h.game.run.quickBattle,undefined);});
test('整局結算呈現真實戰績與差8%回饋，最高單擊新紀錄保留',()=>{const h=harness();h.click('begin-run');const e=h.game.run.world.enemies[0];h.ctx.summaryEnemy=e;vm.runInContext('startEncounter(summaryEnemy)',h.ctx);h.ctx.EncounterFlow.hit(h.game.permanent,h.game.run,{type:'damage',actorId:'player',targetId:'enemy',damage:1842,moveId:'fire'});h.game.battle.enemy.hp=h.game.battle.enemy.stats.hp*.08;h.game.battle.run.deaths=2;h.game.battle.finish(false);h.step(35);const html=h.elements.get('modal').innerHTML;assert.ok(html.includes('還差 <b>8%</b>'));assert.ok(html.includes('新紀錄 · 最高單擊'));assert.ok(html.includes('1,842'));assert.ok(html.includes('擊敗敵人'));assert.ok(html.includes('通過地下城'));const next=harness(h.saved);assert.equal(next.game.permanent.meta.bestHit,1842);assert.ok(next.elements.get('modal').innerHTML.includes('還差 <b>8%</b>'));});
