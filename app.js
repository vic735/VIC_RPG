/* Scene and interaction controller. Static content, simulation and UI templates remain separate. */
const $ = id => document.getElementById(id), D = GameData, P = Progression, U = GameUI, S = GameScreens, Audio = GameAudio, Meta = GameMeta, Enc = EncounterFlow, Classes = ClassSystem, Ach = Achievements, Maps = WorldMaps;
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const loaded = P.loadProgress(storage);
const game = {
  scene: 'title', screen: null, modal: null, run: null, permanent: loaded.progress, build: P.defaultBuild(),
  setupTab: 'stats', category: 'moves', selected: 'fire', battle: null, encounter: null,
  keys: new Set(), touch: new Set(), moving: false, facing: 1, toastUntil: 0, transition: 0,
  resultDelay: null, recoveryCountdown: null, resultHandled: false, noRandom: false, settings: Audio.settings, castFlashes: {}, wasReady: false
};
try { const build = JSON.parse(storage.getItem('afterlight.loadout.v1') || 'null'); if (build) { P.validateBuild(build, game.permanent); game.build = build; } } catch (_) {}
const renderer = new GameArt.Renderer($('scene'));
let last = performance.now(), uiTime = 0, longPressTimer = null, hoverTimer = null, pressOrigin = null, suppressClick = false;
let saveElapsed=0,saveErrorShown=false;
function resetAllProgress(){
 const keys=['afterlight.progress.v2','afterlight.loadout.v1','afterlight.settings.v1',RunSave.KEY],backup={};
 try{for(const key of keys)backup[key]=localStorage.getItem(key);for(const key of keys)localStorage.removeItem(key);}catch(_){for(const [key,value]of Object.entries(backup))try{if(value!==null&&value!==undefined)localStorage.setItem(key,value);}catch(_){}toast('重置未完成，請檢查瀏覽器儲存權限。');return;}
 game.run=null;game.battle=null;game.permanent=P.freshProgress();game.build=P.defaultBuild();game.scene='title';game.screen=null;game.debugBattle=false;game.noRandom=false;game.result=null;game.resultDelay=null;game.resultHandled=false;game.encounter=null;game.rewards=[];game.fieldRewards=[];game.offered=null;game.growthAnimation=null;game.lastRegion=null;game.castFlashes={};game.wasReady=false;game.transition=0;game.keys.clear();game.touch.clear();resetJoystick();renderer.fx=[];renderer.hits={};renderer.attacks={};Audio.reset();applySettings();saveErrorShown=false;$('screen').hidden=true;$('debug').hidden=true;$('transition').hidden=true;closeModal();renderUI();toast('已完全重置，回到全新遊戲。');
}
function saveSession(){if(!RunSave.save(storage,game)&&!saveErrorShown){saveErrorShown=true;toast('自動存檔失敗，請勿關閉頁面。');}}
function resumeSession(){const loaded=RunSave.load(storage);if(loaded.warning){toast(loaded.warning);return;}const snapshot=loaded.snapshot;if(!snapshot)return;for(const k of ['scene','run','permanent','build','encounter','result','resultDelay','resultHandled','rewards','fieldRewards','offered','noRandom','battle'])if(snapshot[k]!==undefined)game[k]=snapshot[k];const latest=P.loadProgress(storage).progress;if((latest.meta?.revision||0)>(game.permanent.meta?.revision||0))game.permanent=latest;game.eventCursor=0;game.transition=0;game.screen=null;rebuildSkills();renderUI();
 if(game.run.quickBattle){showSuppression();return;}if(snapshot.modal==='reward')showReward();else if(['acquire','replace','replace-confirm'].includes(snapshot.modal))acquisitionNext();else if(snapshot.modal==='result')showResult();else pause();toast('已接續上次冒險');}
let stageHeight = 2560 / 3;
function resizeStage() {
  const availableHeight = Math.max(320, window.innerHeight - 24);
  stageHeight = 480 * 16 / 9;
  const scale = Math.min(window.innerWidth / 480, availableHeight / stageHeight);
  $('game').style.setProperty('--stage-height', stageHeight + 'px');
  $('game').style.setProperty('--stage-scale', scale); hideTooltip();
}
function requestGameFullscreen(silent = true) {
  // Fullscreen requests must originate from a player gesture. Installed PWAs
  // already own the viewport, so this only applies to the browser edition.
  if (document.fullscreenElement || window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true) return;
  const operation = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  if (operation?.catch) operation.catch(() => { if (!silent) toast('此瀏覽器未允許全螢幕。可手動放大視窗。'); });
  else if (!operation && !silent) toast('此瀏覽器未支援全螢幕。');
}
function applySettings() { $('game').classList.toggle('reduced-motion', game.settings.reducedMotion); $('game').classList.toggle('high-contrast', game.settings.contrast); }
function toast(message) { $('toast').textContent = message; game.toastUntil = performance.now() + 3700; }
function persist() { if (!P.saveProgress(storage, game.permanent)) toast('收藏暫時無法儲存；目前頁面仍保留進度。'); }
function saveBuild() { try { storage.setItem('afterlight.loadout.v1', JSON.stringify(game.build)); } catch (_) { toast('配置暫時無法儲存至瀏覽器。'); } }
function openModal(kind, content, className = '') {
  hideTooltip(); game.modal = kind; game.keys.clear(); game.touch.clear(); resetJoystick();
  $('modal').className = 'modal game-panel ' + className; $('modal').innerHTML = content; $('modal-backdrop').hidden = false;
  $('modal').scrollTop = 0; $('modal').focus({ preventScroll: true });
}
function closeModal() { game.modal = null; $('modal-backdrop').hidden = true; hideTooltip(); }
function achievementScreen(){
  const p=game.permanent;Classes.normalize(p);
  const tabs=[['classes','職業解鎖'],['skills','技能解鎖'],['moves','招式解鎖']];
  const tab=tabs.some(([id])=>id===game.achievementTab)?game.achievementTab:'classes';
  const kind={classes:'UnlockClass',skills:'UnlockSkill',moves:'UnlockMove'}[tab];
  const rows=Object.values(Ach.defs).filter(a=>a.rewardType===kind).map(a=>{
    const content=tab==='skills'?D.skills[a.rewardId]:tab==='moves'?D.moves[a.rewardId]:null;
    const owners=content?.allowedClassIds||[];
    const missing=owners.length&&!owners.some(id=>p.unlockedClassIds.includes(id));
    const prerequisites=(a.prerequisites||[]).filter(id=>!p.unlockedClassIds.includes(id));
    const locked=!!missing||prerequisites.length>0;
    const done=!locked&&p.completedAchievementIds.includes(a.id);
    const required=(missing?owners:prerequisites).map(id=>Classes.classes[id]?.className||id).join('、');
    const reward=content?.name||Classes.classes[a.rewardId]?.className||a.rewardId;
    return `<article class="codex-entry achievement-card ${locked?'unknown':'known'}"><div><small>${locked?'🔒 尚未開放':done?'✓ 已完成':'進行中'}</small><strong>${U.escape(reward)}</strong><p>${U.escape(a.name)} · ${p.achievementProgress[a.id]||0} / ${a.progressTarget}</p><p>${locked?'先解鎖職業：'+U.escape(required):U.escape(a.description)}</p></div></article>`;
  }).join('');
  return `<header class="screen-header"><div><div class="eyebrow">ACHIEVEMENTS</div><h1>成就</h1></div>${U.button('返回','screen-back')}</header><div class="meta-scroll"><nav class="codex-tabs achievement-tabs" aria-label="成就分類">${tabs.map(([id,name])=>`<button data-action="achievement-tab" data-id="${id}" class="${tab===id?'selected':''}">${name}</button>`).join('')}</nav><p class="quiet-note">職業解鎖後，才會開放對應的專屬技能與招式成就。</p><div class="codex-grid">${rows||'<p>這個分類尚無成就。</p>'}</div></div>`;
}
function renderScreen() {
  if (!game.screen) return;
  if(game.screen==='achievements'){$('screen').innerHTML=achievementScreen();$('screen').hidden=false;$('title-screen').hidden=true;$('hud').hidden=true;return;}
  const html = game.screen === 'shop' ? MetaScreens.shop(game) : game.screen === 'codex' ? MetaScreens.codex(game) : game.screen === 'setup' ? S.setup(game, game.setupTab) : game.screen === 'library' ? S.library(game, game.category, game.selected) : S.settings(game.settings);
  $('screen').innerHTML = game.run ? html.replaceAll('返回主選單', '返回遊戲') : html;
  $('screen').hidden = false; $('title-screen').hidden = true; $('hud').hidden = true;
}
function openScreen(name) {
  if (game.run && name !== 'settings') { toast('能力庫只在出發前開放。新能力可在取得時選擇裝備。'); return false; }
  if(name==='shop'){Meta.stock(game.permanent);persist();saveSession();}
  closeModal(); game.screen = name; game.keys.clear(); game.touch.clear(); resetJoystick(); renderScreen(); return true;
}
function screenBack() { game.screen = null; $('screen').hidden = true; hideTooltip(); renderUI(); }
function assignBuild(kind, index, id) {
  if (game.run) return false;
  const draft = JSON.parse(JSON.stringify(game.build));
  if (kind === 'ultimate') draft.ultimate = id;
  else if (kind === 'equipment') draft.equipment[index] = id;
  else if (['moves', 'talents'].includes(kind)) {
    if (id === null) draft[kind].splice(Number(index), 1);
    else { if (draft[kind].includes(id) && draft[kind][index] !== id) return false; if (Number(index) >= draft[kind].length) draft[kind].push(id); else draft[kind][index] = id; }
  } else return false;
  try { P.validateBuild(draft, game.permanent); } catch (_) { return false; }
  game.build = draft; saveBuild(); return true;
}
function openPicker(kind, index) { if (game.run) return; game.picker = { kind, index: kind === 'equipment' ? index : Number(index) }; openModal('picker', S.picker(game, kind, game.picker.index)); }
function libraryEquip(id) {
  if (game.run) return;
  const kind = game.category === 'talents' ? 'talents' : D.moves[id]?.kind === 'ultimate' ? 'ultimate' : 'moves';
  if (kind === 'ultimate') { assignBuild(kind, 0, game.build.ultimate === id ? null : id); renderScreen(); return; }
  const list = game.build[kind], at = list.indexOf(id);
  if (at >= 0) assignBuild(kind, at, null);
  else if (list.length < 4) assignBuild(kind, list.length, id);
  else {
    game.libraryPending = { kind, id };
    openModal('library-replace', `<div class="eyebrow">CHOOSE A SLOT</div><h2 id="modal-title">替換一個開局欄位</h2><p>已攜帶四個${kind === 'talents' ? '技能' : '招式'}。選擇要卸下的能力。</p><div class="picker-grid">${list.map((old, index) => `<button class="picker-card" data-action="loadout-replace" data-index="${index}">${U.icon((kind === 'talents' ? D.skills[old] : D.moves[old]).icon)}<strong>${(kind === 'talents' ? D.skills[old] : D.moves[old]).name}</strong></button>`).join('')}</div><div class="modal-footer">${U.button('取消', 'close')}</div>`); return;
  }
  renderScreen();
}
function previewRun() { return game.run || P.createRun(game.permanent, game.build, () => .5); }
function statExplanation(id) {
  const run = previewRun(), d = P.statBreakdown(run)[id];
  return `<span class="eyebrow">ATTRIBUTE GROWTH</span><h3>${S.statNames[id]} · 成長明細</h3><p>基礎值 B：${d.base}<br>每級成長 X：${d.perLevel}<br>額外成長 Y：+${Math.round(d.bonusRate * 100)}%<br>既有加成：${d.allocated}</p><div class="formula">S = B + (N − 1) × X × (1 + Y)<br>再加上既有加成、乘最大值加成 ${(1+d.finalRate).toFixed(2)}、套用本局舊傷。</div><p>基礎值含開局技能與裝備加成；目前等級 Lv.${run.level}。</p>`;
}
function beginRun() {
  if (game.run) return;
  if (!game.build.moves.length) { openScreen('setup'); game.setupTab = 'build'; renderScreen(); toast('至少攜帶一個普通招式再出發。'); return; }
  requestGameFullscreen();
  game.voluntaryEnd=false;game.debugBattle=false; game.run = P.createRun(game.permanent, game.build); game.scene = 'explore'; game.screen = null; game.battle = null; game.transition = 0;
  $('screen').hidden = true; closeModal(); rebuildSkills(); renderUI();openModal('world-map',WorldDebug.atlas(game.run),'world-route-modal');
}
function startDebugBattle(){
 try{
  const value=id=>$('lab-'+id).value, number=id=>{const n=Number(value(id));if(!Number.isFinite(n))throw Error('數值必須有效');return n;};
  const config={applyStatBonuses:true,talents:Array.from({length:4},(_,i)=>value('skill-'+i)).filter(Boolean),moves:Array.from({length:4},(_,i)=>value('move-'+i)).filter(Boolean),ultimate:value('ultimate')||null,equipment:Object.fromEntries(['head','chest','arms','feet','weapon'].map(k=>[k,value('gear-'+k)||null])),resources:{hp:number('hp'),mana:number('mana'),stamina:number('stamina')},stats:{agility:number('agility')},charge:number('charge'),elements:[value('element')].filter(Boolean),enemyElements:[...new Set([value('enemy-element'),value('enemy-element2')].filter(Boolean))],equipmentEffects:{physicalMultiplier:number('physical'),physicalAttackTime:number('attack')},statuses:JSON.parse(value('statuses')||'[]')};
  const b=GameDebug.build(config), permanent=P.freshProgress();permanent.ultimateUnlocked=true;permanent.skills=Object.keys(D.skills);permanent.moves=Object.fromEntries(Object.values(D.moves).filter(m=>m.kind==='normal').map(m=>[m.id,1]));permanent.equipment=Object.keys(D.equipment);
  game.run=P.createRun(permanent,b.build);game.debugBattle=true;game.screen=null;$('screen').hidden=true;game.scene='battle';game.battle=b;game.encounter={type:'boss',level:1};game.eventCursor=0;game.resultHandled=false;game.resultDelay=null;game.transition=0;game.castFlashes={};game.wasReady=false;closeModal();rebuildSkills();renderUI();
 }catch(error){toast('測試設定錯誤：'+error.message);}
}
function worldDebugAction(action,id){
 try{
  if(game.scene==='battle')return;
  if(action==='world-debug'){if(!game.run){game.run=P.createRun(game.permanent,game.build);game.scene='explore';}game.screen=null;$('screen').hidden=true;openModal('world-debug',WorldDebug.form(game.run));renderUI();return;}
  if(action==='world-map'&&game.run){openModal('world-map',WorldDebug.atlas(game.run),'world-route-modal');return;}
  if(action==='world-region'&&game.run&&['world-map','world-region','world-map-detail'].includes(game.modal)){openModal('world-region',WorldDebug.regionMaps(game.run,id),'world-route-modal');return;}
  if(action==='world-map-detail'&&game.run&&game.modal==='world-region'){openModal('world-map-detail',WorldDebug.mapDetail(game.run,id),'world-route-modal');return;}
  if(action==='world-enter-map'&&game.run&&game.modal==='world-map-detail'){
    const map=Maps.enter(game.run,id);if(!map){toast('目前無法切換地圖。');return;}
    game.keys.clear();game.touch.clear();resetJoystick();game.lastRegion=id;renderer.fx=[];renderer.hits={};renderer.attacks={};closeModal();renderUI();saveSession();toast(map.name+' · 推薦 Lv.'+map.recommendedLevelMin+'～'+map.recommendedLevelMax);return;
  }
  if(game.modal!=='world-debug')return;
  const value=id=>$('world-'+id).value;
  if(action==='world-teleport'){const region=WorldDebug.teleport(game.run,value('region'));returnExplore();toast(region.name+' · Lv.'+region.min+'–'+region.max);}
  else if(action==='world-level'){WorldDebug.setLevel(game.run,value('level'));toast('本局等級已更新');}
  else if(action==='world-enemy-level'){const e=WorldDebug.enemyLevel(game.run,value('enemy'),value('enemy-level'));toast(D.monsters[e.type].name+' → Lv.'+e.level);}
  else if(action==='world-enter'){WorldDebug.enter(game.run,value('dungeon'));game.scene='explore';startEncounter(P.dungeonEncounter(game.run));}
  else if(action==='world-sample')$('world-output').textContent=JSON.stringify(WorldDebug.sample(value('dungeon'),value('samples'),value('combination'),value('pool')),null,2);
  else if(action==='world-enemies'){const r=D.world.regions.find(r=>r.id===value('region'));$('world-output').textContent=JSON.stringify({region:r.name,ranges:r.subAreaLevelRanges,enemies:[...r.enemyPools,...r.elitePools].map(id=>D.monsters[id])},null,2);}
  else if(action==='world-inspect'){const d=D.dungeons.find(d=>d.id===value('dungeon'));$('world-output').textContent=JSON.stringify(value('pool')?D.rewardPools[value('pool')]:{rules:d.rewardCombinationRules,pools:[d.primaryRewardPool,d.secondaryRewardPool,d.rareRewardPool].map(id=>D.rewardPools[id])},null,2);}
 }catch(error){toast(error.message);}
}
function skillHTML(id,index,ultimate=false){
 const m=D.moves[id], key=ultimate?'Space':['W ↑','D →','S ↓','A ←'][index];
 const title=m?.subtitle?`<strong class="spell-name">${U.escape(m.name)}</strong><span class="skill-subtitle">${U.escape(m.subtitle)}</span>`:`<strong>${U.escape(m?.name||'未配置')}</strong>`;
 return `<button class="skill dir-${index} ${ultimate?'ultimate':''}" data-action="move" data-id="${id||''}" data-ultimate="${ultimate}" data-tooltip="move:${id||''}" aria-label="${U.escape(m?.name||'空招式欄位')}" aria-disabled="true">${ultimate?'<span class="vessel"><i class="vessel-liquid"></i><i class="vessel-shine"></i></span>':'<span class="resource-liquid"></span><span class="demand-line"></span>'}<span class="tile-content"><kbd>${key}</kbd><span class="skill-level" id="skill-level-${index}"></span><span class="skill-face">${U.icon(m?.icon||'star',32)}</span>${title}${ultimate?'<b class="ring-label" id="charge-label">0%</b>':''}<small class="actual-cost">${m?U.cost(m):'空欄位'}</small>${ultimate?'<span class="resource-warning" id="ultimate-warning"></span>':''}</span></button>`;
}
function rebuildSkills() { if (!game.run) return; $('skillbar').innerHTML = Array.from({ length: 4 }, (_, i) => skillHTML(game.run.build.moves[i], i)).join('') + skillHTML(game.run.build.ultimate, 4, true); }
function startEncounter(encounter) {
  if (game.scene !== 'explore' || !game.run || game.run.quickBattle) return;
  if(!game.debugBattle&&Enc.startQuick(game.run,encounter,game.settings.autoQuickBattle)){game.encounter={...Enc.members(encounter)[0]};game.battle=null;showSuppression();saveSession();return;}
  if(Array.isArray(encounter.enemies)){if(!encounter.enemies.length)return;game.run.fieldEncounterQueue=encounter.enemies.slice(1).map(e=>({...e,forceNormalGroup:true}));encounter={...encounter.enemies[0],forceNormalGroup:true};}
  if(!game.debugBattle){Meta.encounter(game.permanent,encounter.type);persist();}
  game.encounter = { ...encounter }; game.battle = P.battleFor(game.run, encounter); Ach.start(game.run);
  if (game.noRandom) { game.battle.rules.critChance = 0; game.battle.rules.dodgeChance = 0; }
  game.scene = 'battle'; game.eventCursor = 0; game.resultHandled = false; game.resultDelay = null; game.transition = .55; game.castFlashes = {}; game.wasReady = false;
  game.keys.clear(); game.touch.clear(); resetJoystick(); renderer.fx = []; renderer.hits = {}; renderer.attacks = {}; closeModal(); $('transition').hidden = false;
  // Restart the CSS transition without delaying the simulation longer than 0.55 seconds.
  $('transition').style.animation = 'none'; void $('transition').offsetWidth; $('transition').style.animation = '';
  renderUI();
}
function showSuppression(){
  game.scene='explore';game.battle=null;game.resultDelay=null;game.resultHandled=false;
  openModal('suppression',`<div class="suppression-seal" aria-hidden="true">${U.icon('sword',54)}</div><h2 id="modal-title">壓制</h2><p>一擊掠過，步履未停。</p>`,'suppression-modal');$('modal').style.setProperty('--suppress-duration',D.balance.quickBattleSeconds+'s');Audio.emit('skillCast');
}
function completeSuppression(){
  const result=Enc.finishQuick(game.permanent,game.run);if(!result)return;
  if(result.fallback){closeModal();startEncounter({enemies:result.fallback});return;}
  game.fieldRewards=result.rewards;game.encounter={...result.enemies[0]};game.result={won:true,exp:result.exp,beforeLevel:result.exp.beforeLevel,quick:true,countsForCombatChallenges:false,enemyNames:result.enemies.map(e=>D.monsters[e.type].name).join('、')};game.resultHandled=true;
  showResult();saveSession();persist();
}
function runSummaryHTML(run){
  const s=Enc.summary(run,game.permanent),near=s.lastDefeat;
  return `<section class="journey-summary"><div class="journey-level"><small>本局到達</small><strong>Lv.${s.level}</strong></div><div class="journey-counts"><div><strong>${s.kills}</strong><small>擊敗敵人</small></div><div><strong>${s.dungeons}</strong><small>通過地下城</small></div></div><p class="quiet-note">實戰 ${s.normalKills} 隻 · 壓制 ${s.quickKills} 隻${run.battleStatsPartial?' · 舊存檔僅統計更新後戰績':''}</p>${near?`<div class="near-miss"><small>${near.remainingPercent<=25?'就差最後一步':'最後未完成的挑戰'}</small><strong>${U.escape(near.name)}</strong><p>${near.remainingPercent<=25?'還差':'剩餘'} <b>${near.remainingPercent}%</b> HP${near.remainingPercent<=25?' 就能擊敗':''}</p><div class="near-miss-track"><i style="width:${100-near.remainingPercent}%"></i></div></div>`:'<p class="quiet-note">這段旅途的收穫，將陪你再次出發。</p>'}<div class="hit-record"><small>${s.newHitRecord?'新紀錄 · 最高單擊':'本局最高單擊'}</small><strong>${Math.floor(s.highestHit).toLocaleString('zh-TW')}</strong></div></section>`;
}
function currentDungeon() { return D.dungeons.find(d=>d.id===game.run?.dungeon?.id); }
function showDungeon(d) {
  openModal('dungeon', `<div class="eyebrow">DUNGEON · ${d.dungeonType.toUpperCase()}</div><h2 id="modal-title">${d.name}</h2><p>推薦 Lv.${d.recommendedLevel} · 自由進入</p><p>${d.features.join(' ／ ')}</p><div class="dungeon-stages">${d.enemyWaves.map((wave,i)=>`<div><small>${i+1} · ${{normal:'普通',elite:'精英',boss:'首領'}[wave.role]||wave.role}</small><strong>Lv.${wave.level}</strong></div>`).join('')}</div><p>可能獲得：${d.rewardTypes.map(k=>({moves:'招式',talents:'技能',equipment:'裝備',books:'魔法書'}[k]||k)).join('、')}<br>通關後依獎勵池抽取；波間不回復資源；通關離開後回滿。</p><div class="modal-footer">${U.button('稍後再來','close')}${U.button('進入地下城 →','enter-dungeon',{id:d.id,primary:true})}</div>`, 'result-modal');
}
function interact() { if (game.scene !== 'explore' || game.modal || game.screen) return; const target = World.nearby(game.run); if (!target) return; if (target.kind === 'dungeon') showDungeon(target.entity);
  else if (target.kind === 'enemy') startEncounter(target.entity);
  else { const result = World.interactObject(game.run, target.entity.id); if (!result) return;
    if (result.reward) Audio.emit('itemGain');
    openModal('discovery', `<div class="eyebrow">A MOMENT ON THE ROAD</div><h2 id="modal-title">${U.escape(target.entity.name)}</h2><p>${U.escape(result.text)}</p>${result.reward ? `<div class="detail-badge">獲得 ${U.escape(result.reward)}</div>` : ''}<div class="modal-footer">${U.button('繼續探索', 'close', { primary: true })}</div>`);
  } }
function chooseMove(id, asUltimate = false) {
  if (!id || game.scene !== 'battle' || game.modal || game.screen || game.transition > 0 || !$('debug').hidden || game.battle.phase !== 'fighting') return;
  const result = game.battle.choose(id, asUltimate); if (!result.ok) toast(result.reason); else { Audio.emit('skillSelect', { id }); hideTooltip(); }
  renderUI();
}
function showJournal() {
  if (!game.run || game.scene === 'battle') return;
  const run = game.run, stats = P.statsFor(run);
  openModal('journal', `<div class="eyebrow">THIS JOURNEY · CHARACTER STATUS</div><h2 id="modal-title">旅人的此刻</h2><p>Lv.${run.level} · 倒下 ${run.deaths} / 3<br>${run.debuffIds.length ? run.debuffIds.map(id => D.debuffs.find(d => d.id === id).name).join(' ／ ') : '尚未留下舊傷。'}</p><div class="journal-grid">${Object.keys(S.statNames).map(k => `<div class="journal-stat">${U.icon(S.statIcons[k], 26)}<strong>${Math.round(stats[k])}</strong><small>${S.statNames[k]}</small></div>`).join('')}</div><div class="journal-abilities">${run.build.moves.map(id => `<div>${U.icon(D.moves[id].icon, 22)} ${D.moves[id].name}<small>本局 Lv.${run.moveLevels[id]} · 永久 ${U.stars(game.permanent.moves[id])}</small></div>`).join('')}</div><p>本局待結算徽記：◇ ${Meta.ledger(run).combat+Meta.ledger(run).exploration+Meta.ledger(run).dungeons}</p><p>探索收藏：${run.world.inventory?.length ? run.world.inventory.map(U.escape).join("、") : "尚未收集"}</p><p class="quiet-note">可隨時調整本局已取得的招式、技能與必殺指向。</p><div class="modal-footer">${U.button('世界地圖','world-map')}${U.button('調整招式技能','run-loadout')}${U.button('結束本局','end-run')}${U.button('繼續探索', 'close', { primary: true })}</div>`);
}
function showRunLoadout(){
 if(!game.run||game.scene==='battle')return;
 const b=game.run.build,slots=[...Array.from({length:4},(_,index)=>({kind:'moves',index,id:b.moves[index]})),...Array.from({length:4},(_,index)=>({kind:'talents',index,id:b.talents[index]})),{kind:'ultimate',index:0,id:b.ultimate}];
 openModal('run-loadout',`<div class="eyebrow">THIS RUN · LOADOUT</div><h2 id="modal-title">調整本局配置</h2><p>只列出這局已帶入或取得的能力。切換地圖後配置仍會保留。</p><div class="run-loadout-grid">${slots.map(slot=>`<button data-action="run-slot" data-kind="${slot.kind}" data-index="${slot.index}"><small>${slot.kind==='talents'?'技能':slot.kind==='ultimate'?'必殺':'招式 '+('ABCD'[slot.index])}</small><strong>${U.escape(slot.id?(slot.kind==='talents'?D.skills[slot.id]:D.moves[slot.id])?.name||slot.id:'空欄位')}</strong></button>`).join('')}</div><div class="modal-footer">${U.button('返回角色狀態','journal')}${U.button('繼續探索','close',{primary:true})}</div>`,'world-route-modal');
}
function showRunSlot(kind,index){
 const run=game.run;if(!run||game.scene==='battle'||!['moves','talents','ultimate'].includes(kind)||!Number.isInteger(index)||index<0||index>3)return;
 game.runPicker={kind,index};const list=kind==='talents'?run.availableSkills:run.availableMoves,source=kind==='talents'?D.skills:D.moves;
 const candidates=(list||[]).filter(id=>source[id]&&Classes.eligible(source[id],run.activeClassId,game.permanent)&&(kind!=='moves'||source[id].kind==='normal'));
 openModal('run-slot',`<div class="eyebrow">THIS RUN · SELECT ABILITY</div><h2 id="modal-title">${kind==='talents'?'選擇技能':kind==='ultimate'?'選擇必殺指向':'選擇招式'}</h2><div class="run-choice-list">${candidates.map(id=>`<button data-action="run-config-select" data-id="${id}"><strong>${U.escape(source[id].name)}</strong><small>${U.escape(source[id].subtitle||source[id].description||'')}</small></button>`).join('')||'<p>這局尚未取得可用能力。</p>'}</div><div class="modal-footer"><button data-action="run-config-select" data-id="">清空欄位</button>${U.button('返回配置','run-loadout')}</div>`,'world-route-modal');
}
function selectRunAbility(id){
 const run=game.run,pick=game.runPicker;if(!run||game.modal!=='run-slot'||!pick)return;
 const {kind,index}=pick,available=kind==='talents'?run.availableSkills:run.availableMoves;
 if(id&&!available.includes(id)){toast('這局尚未取得這項能力。');return;}
 const draft=JSON.parse(JSON.stringify(run.build));
 if(kind==='ultimate'){if(id&&!game.permanent.ultimateUnlocked){toast('必殺槽尚未解鎖。');return;}draft.ultimate=id||null;}
 else {const list=draft[kind];if(index>list.length){toast('請依序填入欄位。');return;}if(!id){if(index<list.length)list.splice(index,1);}else if(list.includes(id)&&list[index]!==id){toast('同一能力不能重複配置。');return;}else if(index===list.length)list.push(id);else list[index]=id;}
 if(!draft.moves.length){toast('至少需要一個普通招式。');return;}
 try{P.validateBuild(draft,game.permanent);}catch(error){toast(error.message);return;}
 run.build=draft;rebuildSkills();showRunLoadout();saveSession();
}
function finishEncounter() {
  const b = game.battle, run = game.run; game.resultHandled = true;
  P.carryBattleCharge(run,b);
  run.deaths = b.run.deaths; run.debuffIds = [...b.run.debuffIds]; run.status = b.run.status;
  if(run.dungeon&&b.phase==='victory')run.dungeonResources=Object.fromEntries(['hp','mana','stamina'].map(k=>[k,b.player[k]]));
  if(run.status==='failed'&&!game.debugBattle&&!game.permanent.ultimateUnlocked){game.permanent.ultimateUnlocked=true;persist();}
  if(!game.debugBattle){const unlocked=Ach.battleEnd(game.permanent,run,b);if(unlocked.length)persist();} const won = b.phase === 'victory', beforeLevel = run.level, exp = won ? P.grantExp(run, game.encounter.level, game.encounter.type) : null;
  if (won && game.encounter.id) { const e = run.world.enemies.find(e => e.id === game.encounter.id); if (e) { e.defeatedUntil = run.world.time + D.balance.respawnSeconds; e.x = e.homeX; e.y = e.homeY; } }
  if(!game.debugBattle){if(won)Enc.victory(game.permanent,run,game.encounter);else Enc.loss(game.permanent,run,game.encounter,b);run.lastEncounterResult={mode:'normal',countsForCombatChallenges:true};persist();}
  game.fieldRewards = won && !run.dungeon && !game.debugBattle ? P.grantRewards(game.permanent,run,WorldRewards.enemy(game.encounter.type,Math.random,run.currentMapId)) : []; if(game.fieldRewards.length)persist();
 game.result = { won, exp, beforeLevel }; game.resultDelay = 1.05;

}
function runLootHTML(run){
 const kinds={moves:['招式',D.moves],talents:['技能',D.skills],equipment:['裝備',D.equipment],books:['魔法書',D.books]},rows=Object.values(run.loot||{}),count=rows.reduce((n,r)=>n+r.count,0);
 return `<section class="run-loot"><h3>本局收穫 <small>${count} 次取得</small></h3>${run.lootHistoryPartial?'<p class="quiet-note">舊存檔僅記錄更新後的收穫。</p>':''}${rows.length?Object.entries(kinds).map(([kind,[name,source]])=>{const list=rows.filter(r=>r.kind===kind);return list.length?`<h4>${name}</h4>${list.map(r=>`<div class="run-loot-row"><div><strong>${U.escape(source[r.id]?.name||r.id)}</strong><small>${r.isNew?'本局首次學會／解鎖':'既有收藏'}${kind==='moves'&&r.after!==undefined?' · 本局 Lv.'+r.before+' → '+r.after:''}</small></div><b>×${r.count}</b></div>`).join('')}`:'';}).join(''):'<p>這次尚未取得物品或能力。</p>'}<p class="quiet-note">收穫已加入永久收藏；重複招式的本局等級加成不帶到下一局。</p></section>`;
}
function showResult() {
  const r = game.result, run = game.run, dead = run.status === 'failed';
  if(dead&&!game.debugBattle){Meta.settle(game.permanent,run);saveSession();persist();}
  if(dead&&!game.debugBattle&&!game.permanent.ultimateUnlocked){game.permanent.ultimateUnlocked=true;persist();}
  game.recoveryCountdown=!r.won&&!dead?D.balance.recoverySeconds:null;
  openModal('result', `<div class="eyebrow">${r.won ? 'THE JOURNEY CONTINUES' : dead ? 'THE LAST LIGHT FADES' : 'REST, THEN RISE'}</div><div class="result-seal">${U.icon(r.won ? 'star' : 'hood', 60)}</div><h2 id="modal-title" class="result-title">${r.won ? r.exp?.levels ? '等級提升' : r.quick?'壓制成功':'戰鬥勝利' : dead ? '冒險結算' : '休養之後'}</h2>${r.won&&r.exp?.levels?LevelUp.html(r.exp):''}${r.won ? `<div class="exp-reward">＋${r.exp.amount} <small>EXP</small></div>` : ''}<p>${r.won ? `${r.quick?'壓制':'擊敗'} ${U.escape(r.enemyNames||D.monsters[game.encounter.type].name)}<br>${run.dungeon?'保留 HP／MP／SP，繼續深入。':'HP、MP、SP 已完全恢復。'}` : dead ? `${run.endedVoluntarily?'這段旅途暫告一段落。':'第三次倒下，你的腳步終於停下。'}<br>必殺槽已永久解鎖。<br>下次出發前，可指定已學會招式為必殺。` : `第 ${run.deaths} 次倒下，你回營地休養。<br>留下【${D.debuffs.find(d => d.id === run.debuffIds.at(-1)).name}】<br>休養後恢復至新的能力上限。`}</p>${!r.won&&!dead?'<p class="recovery-countdown">約 <strong id="recovery-countdown">3.0</strong> 秒後返回探索</p>':''}${dead?runSummaryHTML(run)+MetaScreens.settlement(run)+runLootHTML(run):''}${r.won && run.dungeon ? `<p>${currentDungeon().name} ${run.dungeon.stage + 1} / ${currentDungeon().enemyWaves.length} 場完成</p>` : ''}<div class="modal-footer">${U.button(dead ? '返回主選單' : !r.won ? '立即返回探索' : run.dungeon ? run.dungeon.stage === currentDungeon().enemyWaves.length-1 ? '查看封存的獎勵' : '走向下一間石室 →' : '繼續探索 →', 'result-next', { primary: true })}</div>`, r.won&&r.exp?.levels?'result-modal growth-result':dead?'result-modal journey-result':'result-modal');
  game.growthAnimation=r.won&&r.exp?.levels?{elapsed:0,exp:r.exp}:null;if(game.growthAnimation)Audio.emit('levelUp',{level:run.level});saveSession();
}
function continueResult() {
  if (game.modal !== 'result') return;
  const run = game.run;
  if(game.debugBattle){game.debugBattle=false;game.run=null;game.battle=null;game.scene='title';closeModal();renderUI();return;}
  if (run.status === 'failed') { closeModal(); game.scene = 'title'; game.run = null; game.battle = null; saveSession(); renderUI(); return; }
  if (game.result.won && run.dungeon) {
    if (run.dungeon.stage < currentDungeon().enemyWaves.length-1) { run.dungeon.stage++; game.scene = 'explore'; startEncounter(P.dungeonEncounter(run)); return; }
    game.rewards = P.dungeonReward(game.permanent, run); Ach.dungeonClear(game.permanent,run,run.dungeon.id); Meta.clear(game.permanent,run,run.dungeon.id);Enc.clear(game.permanent,run,run.dungeon.id); saveSession();persist(); Audio.emit('itemGain', { rewards: game.rewards }); showReward(); return;
  }
  if (!game.result.won) { delete run.fieldEncounterQueue;run.position = { ...(D.maps[run.currentMapId]?.entry||D.world.camp) }; run.dungeon = null; delete run.dungeonResources; }
  if(game.result.won && game.fieldRewards?.length){game.rewards=game.fieldRewards;game.fieldRewards=[];showReward();return;}
  returnExplore();
}
function showReward() {
  const names={moves:'招式',talents:'技能',equipment:'裝備',books:'魔法書'};
  openModal('reward', `<div class="eyebrow">COLLECTION</div><h2 id="modal-title">${currentDungeon()?.name||'探索'} · 收穫</h2><p>收藏永久保留。新能力可選擇立即攜帶，裝備於下次出發配置。</p><div class="reward-list">${game.rewards.map(r=>{const data=({moves:D.moves,talents:D.skills,equipment:D.equipment,books:D.books})[r.kind][r.id];return `<div class="reward-line ${r.isNew?'new':'duplicate'}">${U.icon(data.icon||'book',36)}<div><strong>${data.name}</strong><small>${names[r.kind]} · ${r.isNew?'已加入永久收藏':r.after?'本局 Lv.'+r.before+' → '+r.after:'已擁有'}</small></div></div>`;}).join('')}</div><div class="modal-footer">${U.button(game.run.pendingAcquisitions?.length?'選擇新能力 →':'繼續探索 →','reward-next',{primary:true})}</div>`, 'result-modal');
}
function acquisitionNext() {
  const ticket = game.run.pendingAcquisitions?.[0];
  if (!ticket) { game.run.dungeon = null; returnExplore(); return; }
  game.offered = { ...ticket }; showAcquisition();
}
function showAcquisition() {
  const t = game.offered, data = t.kind === 'talents' ? D.skills[t.id] : D.moves[t.id], level = game.run.moveLevels[t.id] || 1;
  openModal('acquire', `<div class="eyebrow">A NEW ART AWAKENS</div><h2 id="modal-title">獲得新${t.kind === 'talents' ? '技能' : '招式'}</h2>${t.kind === 'moves' ? U.moveDetail({ ...data, multiplier: data.multiplier * P.moveScale(level) }, level, P.statsFor(game.run).agility) : `<div class="detail-icon">${U.icon(data.icon, 80)}</div><h3>${data.name}</h3><p>${data.description}</p>`}<p class="quiet-note">永久收藏已保留。暫不使用後，本局不能再從能力庫自由換入。</p><div class="modal-footer">${U.button('暫不使用', 'acquire-skip')}${U.button('裝備這個能力', 'acquire-equip', { primary: true })}</div>`, 'acquire-modal');
}
function showReplacement() {
  const t = game.offered, source = t.kind === 'moves' ? D.moves : D.skills;
  openModal('replace', `<div class="eyebrow">MAKE ROOM FOR A NEW POSSIBILITY</div><h2 id="modal-title">選擇要替換的能力</h2><div class="replace-layout"><div class="replace-center"><div class="detail-icon tone-${U.tone(t.id)}">${U.icon(source[t.id].icon, 56)}</div><strong>${source[t.id].name}</strong></div>${game.run.build[t.kind].map((id, i) => `<button class="replace-choice choice-${i} tone-${U.tone(id)}" data-action="replace-choose" data-index="${i}">${U.icon(source[id].icon, 40)}<strong>${source[id].name}</strong><small>本局 Lv.${game.run.moveLevels[id] || 1}</small></button>`).join('')}</div><div class="modal-footer">${U.button('返回', 'acquire-back')}</div>`, 'acquire-modal');
}
function confirmReplacement(index) {
  const t = game.offered, source = t.kind === 'moves' ? D.moves : D.skills, oldId = game.run.build[t.kind][index]; if (!oldId) return;
  game.replaceIndex = index;
  openModal('replace-confirm', `<div class="eyebrow">RESHAPE YOUR PATH</div><h2 id="modal-title">確認替換</h2><div class="swap-confirm"><div>${U.icon(source[oldId].icon, 65)}<strong>${source[oldId].name}</strong><small>卸下本局配置</small></div><span>→</span><div>${U.icon(source[t.id].icon, 65)}<strong>${source[t.id].name}</strong><small>裝備新能力</small></div></div><p>舊招式的永久收藏與等級都會保留。</p><div class="modal-footer">${U.button('重新選擇', 'replace-back')}${U.button('確認替換', 'replace-confirm', { primary: true })}</div>`, 'acquire-modal');
}
function applyAcquisition(index) {
  const t = game.offered; if (!t || !P.resolveAcquisition(game.run, t.kind, t.id, index)) return;
  Audio.emit('itemGain', { id: t.id, equipped: index !== null }); if (index !== null) toast('已裝備 · ' + (D.moves[t.id] || D.skills[t.id]).name);
  rebuildSkills(); $('skillbar').classList.remove('acquisition-insert'); void $('skillbar').offsetWidth; $('skillbar').classList.add('acquisition-insert'); game.offered = null; acquisitionNext();
}
function returnExplore() { if(!game.run.dungeon)delete game.run.dungeonResources;game.scene = 'explore'; game.battle = null; game.resultDelay = null; game.recoveryCountdown=null; closeModal(); rebuildSkills(); renderUI();if(game.run.fieldEncounterQueue?.length)startEncounter(game.run.fieldEncounterQueue.shift()); }
function pause() { if(game.debugBattle){openModal('debug-lab',GameDebug.form(game.debugBattle));return;} if (!game.run || game.modal || game.screen) return; openModal('pause', `<div class="eyebrow">A MOMENT OF STILLNESS</div><h2 id="modal-title">旅途暫歇</h2><p>時間已暫停。整理呼吸，再繼續前行。</p><div class="modal-footer">${U.button('設定', 'settings')}${U.button('繼續旅途', 'close', { primary: true })}</div>`, 'result-modal'); }
function renderUI() {
  $('game').dataset.mode = game.scene; $('title-screen').hidden = game.scene !== 'title' || !!game.screen;
  $('hud').hidden = !game.run || !!game.screen; if (!game.run) return;
  if(renderer.time>(game.passiveUntil||0))$('passive-flash').textContent='';
  const run = game.run, fighting = game.scene === 'battle', stats = P.statsFor(run), actor = fighting ? game.battle.player : { ...stats, stats };
  $('level').textContent = 'Lv.' + run.level; $('resources').innerHTML = U.statBar(actor.hp, actor.stats.hp, 'hp', 'HP') + U.statBar(actor.mana, actor.stats.mana, 'mp', 'MP') + U.statBar(actor.stamina, actor.stats.stamina, 'sp', 'SP');
  $('xp-fill').style.width = (run.exp / P.levelCost(run.level) * 100) + '%'; $('xp-label').textContent = `${run.exp}/${P.levelCost(run.level)}`;
  $('region-name').textContent = run.dungeon ? currentDungeon().name : D.maps[run.currentMapId]?.name||P.regionAt(run.position.x, run.position.y).name;
  $('skillbar').hidden = !fighting;
  $('quest').hidden = true; $('battle-heading').hidden = !fighting; $('enemy-battle').hidden = !fighting; $('player-cast').hidden = !fighting; $('battle-tip').hidden = !fighting;
  $('bottom-hint').textContent = fighting ? 'W ↑ · D → · S ↓ · A ← 選招式　／　Space 必殺　／　長按查看詳細' : 'WASD / 方向鍵 移動　·　E 互動　·　B 角色狀態　·　Esc 暫停';
  if (fighting) {
    const b = game.battle; $('battle-location').textContent = run.dungeon ? currentDungeon().name : D.maps[run.currentMapId]?.name||P.regionAt(run.position.x, run.position.y).name;
    $('battle-subtitle').textContent = `${run.dungeon ? `試煉 ${run.dungeon.stage + 1} / ${currentDungeon().enemyWaves.length} · ` : ''}戰鬥中無法逃跑`;
    const flash = id => game.castFlashes[id]?.until > renderer.time ? game.castFlashes[id].type : '';
    $('enemy-battle').innerHTML = `<div class="enemy-name"><h3>${D.monsters[game.encounter.type].name}</h3><span>Lv.${game.encounter.level}</span></div>${U.statBar(b.enemy.hp, b.enemy.stats.hp, 'hp', 'HP')}<div class="enemy-status"><span>${b.phase === 'victory' ? '已倒下' : Object.values(b.enemy.statuses).map(s=>s.name).join(' · ') || ''}</span><span>${b.enemy.elements.map(e=>D.elements[e]).join('＋')||'無屬性'}</span></div>${U.castBar(b.enemy, b.time, flash('enemy'))}`;
    $('player-cast').innerHTML = U.castBar(b.player, b.time, flash('player'));
    $('player-status').textContent=Object.values(b.player.statuses).map(s=>s.name).join(' · ')+(b.player.shield>0?' · 護盾 '+Math.ceil(b.player.shield):'');
  }
  const nearby = fighting ? null : World.nearby(run); $('interact').hidden = !nearby || !!game.modal || !!game.screen;
  if (nearby) $('interact').textContent = nearby.kind === 'dungeon' ? '◇ 進入 · ' + nearby.entity.name : nearby.kind === 'enemy' ? `Lv.${nearby.entity.level} · 挑戰` : nearby.entity.action + ' · ' + nearby.entity.name;
  for (const [index, button] of [...$('skillbar').querySelectorAll('[data-action="move"]')].entries()) {
    const id = button.dataset.id, move = fighting ? game.battle.getMove(id) : D.moves[id], ultimate = index === 4;
    if (!move) { button.setAttribute('aria-disabled', 'true'); continue; }
    button.querySelector('.actual-cost').textContent=U.cost(move);
    const resource=Object.hasOwn(move.cost,'mana')?'mana':'stamina', maximum=actor.stats[resource];
    button.dataset.resource=resource;button.style.setProperty('--liquid',Math.max(0,Math.min(100,maximum?actor[resource]/maximum*100:0))+'%');
    button.style.setProperty('--demand',Math.min(100,maximum?(move.cost[resource]||0)/maximum*100:100)+'%');
    const chargeCost = move?.ultimateChargeCost || 100;
    const charge = fighting && ultimate ? Math.min(100, game.battle.charge / chargeCost * 100) : 0, charged = charge >= 100;
    const lacksResource = Object.entries(move.cost).some(([k, v]) => actor[k] < v);
    const unavailable = !fighting || game.battle.phase !== 'fighting' || !!game.battle.player.cast || !!game.modal || !!game.screen || game.transition > 0 || lacksResource || ultimate && !charged;
    button.classList.toggle('insufficient',lacksResource);button.setAttribute('aria-disabled', String(unavailable)); button.classList.toggle('unavailable', unavailable); button.classList.toggle('casting-selected', fighting && game.battle.player.cast?.moveId === id);
    $(`skill-level-${index}`).textContent = ultimate ? '' : 'Lv.' + (run.moveLevels[id] || 1);
    if (ultimate) { button.classList.toggle('ready', charged); button.classList.toggle('resource-short', charged && lacksResource); button.style.setProperty('--charge',charge+'%'); $('charge-label').textContent = charged ? 'READY' : `${Math.floor(charge)}%`; $('ultimate-warning').textContent = charged && lacksResource ? '資源不足' : '';
      if (charged && !game.wasReady) Audio.emit('ultimateReady'); game.wasReady = charged;
    }
  }
  if (!$('debug').hidden) $('debug-state').textContent = JSON.stringify({ scene: game.scene, level: run.level, position: run.position, deaths: run.deaths, dungeon: run.dungeon, charge: game.battle?.charge }, null, 2);
}
function hideTooltip() { clearTimeout(hoverTimer); clearTimeout(longPressTimer); hoverTimer=null; longPressTimer=null; $('tooltip').hidden = true; }
function scheduleTooltip(element){hideTooltip();hoverTimer=setTimeout(()=>showTooltip(element),600);}
function showTooltip(element) {
  if (!element?.dataset.tooltip || (game.modal && !element.dataset.tooltip.startsWith('skill:')) || game.transition > 0) return;
  const [kind, id] = element.dataset.tooltip.split(':'); if (!id) return;
  if (kind === 'stat') $('tooltip').innerHTML = statExplanation(id);
  else if(kind==='skill') $('tooltip').innerHTML=U.skillDetail(D.skills[id]);
  else {
    const run = previewRun(), level = run.moveLevels[id] || 1, move = game.scene === 'battle' ? game.battle.preview(id) : { ...D.moves[id], multiplier: D.moves[id].multiplier * P.moveScale(level), attackTime: D.moves[id].attackTime + (D.moves[id].damageType === 'physical' ? D.equipment[run.build.equipment.weapon]?.physicalAttackTime || 0 : 0) };
    $('tooltip').innerHTML = game.scene==='battle'?U.compactMoveDetail(move):U.moveDetail(move, level, P.statsFor(run).agility);
  }
  $('tooltip').classList.toggle('compact-tooltip',game.scene==='battle'&&kind==='move');
  $('tooltip').hidden = false;
  const stage = $('game').getBoundingClientRect(), rect = element.getBoundingClientRect(), scale = stage.width / 480;
  const width = $('tooltip').offsetWidth || 360, height = $('tooltip').offsetHeight || 400, x = (rect.left - stage.left) / scale, y = (rect.top - stage.top) / scale;
  $('tooltip').style.left = Math.min(480 - width - 12, Math.max(12, x - width - 12)) + 'px';
  $('tooltip').style.top = Math.max(12, Math.min(stageHeight - height - 12, y - height - 12)) + 'px';
  if(game.scene==='battle'&&kind==='move'){$('tooltip').style.left='12px';$('tooltip').style.top=(stageHeight/2+10)+'px';}
}
function handleAction(action, id, element) {
  if(action==='achievements'){openScreen('achievements');return;}
  if(action==='achievement-tab'&&game.screen==='achievements'){game.achievementTab=id;renderScreen();return;}
  if (action === 'setup') { game.setupTab = 'stats'; openScreen('setup'); }
  else if (action === 'library') openScreen('library');
  else if(action==='end-run'&&game.run&&!game.debugBattle)openModal('end-run',`<h2 id="modal-title">結束這段旅途？</h2><p>帶回已累積的旅者徽記與收藏，返回主選單。下次冒險從 Lv.1 開始。</p><div class="modal-footer">${U.button('繼續冒險','close')}${U.button('結算並返回','end-run-confirm',{primary:true})}</div>`);
  else if(action==='end-run-confirm'&&game.modal==='end-run'&&game.run){Meta.settle(game.permanent,game.run);game.permanent.ultimateUnlocked=true;game.run.status='failed';game.result={won:false};game.resultHandled=true;game.resultDelay=null;game.run.endedVoluntarily=true;saveSession();persist();showResult();}
  else if(action==='shop'||action==='codex')openScreen(action);
  else if(action==='class-achievements'&&!game.run){
    const rows=Object.values(Classes.classes).map(c=>{const unlocked=game.permanent.unlockedClassIds.includes(c.classId),selected=(game.build.activeClassId||'ADVENTURER')===c.classId;return `<button class="picker-card ${selected?'selected':''}" data-action="class-select" data-id="${c.classId}" ${unlocked?'':'disabled'}><div><strong>${c.className}${unlocked?'':' · 🔒'}</strong><p>${c.innateTrait.name}：${c.innateTrait.description}</p><small>${unlocked?'選擇此職業':'完成對應成就後解鎖'}</small></div></button>`;}).join('');
    openModal('class-achievements',`<div class="eyebrow">CLASS</div><h2 id="modal-title">選擇職業</h2><p>本局開始後不可切換。解鎖條件可至成就頁查看。</p><div class="picker-grid">${rows}</div><div class="modal-footer">${U.button('查看成就','achievements')}${U.button('返回','close')}</div>`,'result-modal');
  }
  else if(action==='class-select'&&game.modal==='class-achievements'){
    try{Classes.select(game.permanent,game.build,id);saveBuild();closeModal();toast('已選擇職業：'+Classes.classes[id].className);}catch(error){toast(error.message);}
  }
  else if(action==='codex-tab'&&game.screen==='codex'){game.codexTab=id;renderScreen();}
  else if(action==='shop-buy'&&!game.run&&game.screen==='shop'){
    const draft=JSON.parse(JSON.stringify(game.permanent)),result=Meta.buy(draft,id,element.dataset.epoch);
    if(result.ok){const next={...game,permanent:draft};if(!RunSave.save(storage,next)){toast('儲存失敗，未扣除徽記。');return;}game.permanent=draft;persist();Audio.emit('itemGain');toast('永久解鎖，可至角色設定配置。');}else toast(result.message);renderScreen();
  }
  else if(action==='debug-lab'){ $('debug').hidden=true;openModal('debug-lab',GameDebug.form(game.debugBattle)); }
  else if(action==='debug-end'&&game.debugBattle){game.debugBattle=false;game.run=null;game.battle=null;game.scene='title';game.screen=null;$('screen').hidden=true;closeModal();renderUI();}
  else if(action==='debug-start')startDebugBattle();
  else if (action === 'settings') openScreen('settings');
  else if (action === 'screen-back') screenBack();
  else if (action === 'setup-tab') { game.setupTab = id; hideTooltip(); renderScreen(); }
  else if (action === 'library-category') { game.category = id; game.selected = null; renderScreen(); }
  else if (action === 'catalog-select') { game.selected = id; renderScreen(); }
  else if (action === 'slot-pick') openPicker(element.dataset.kind, element.dataset.index);
  else if (action === 'gear-pick') openPicker('equipment', element.dataset.index);
  else if (action === 'picker-select' && game.modal === 'picker') { if (assignBuild(game.picker.kind, game.picker.index, id)) { closeModal(); renderScreen(); } }
  else if (action === 'picker-remove' && game.modal === 'picker') { assignBuild(game.picker.kind, game.picker.index, null); closeModal(); renderScreen(); }
  else if (action === 'library-equip') libraryEquip(id);
  else if (action === 'loadout-replace' && game.modal === 'library-replace') { assignBuild(game.libraryPending.kind, Number(element.dataset.index), game.libraryPending.id); closeModal(); renderScreen(); }
  else if (action === 'stat-explain') openModal('stat', statExplanation(id).replace('<h3>', '<h2 id="modal-title">').replace('</h3>', '</h2>') + `<div class="modal-footer">${U.button('返回', 'close')}</div>`);
  else if (action === 'learn-book' && !game.run && game.screen === 'library') { if (P.understandBook(game.permanent, null, id)) { persist(); Audio.emit('itemGain', { id }); toast('已學會 · ' + D.moves[D.books[id].moveId].name); renderScreen(); } }
  else if (action === 'begin-run') beginRun();
  else if (action === 'close') { if (!['result', 'reward', 'acquire', 'replace', 'replace-confirm'].includes(game.modal)) closeModal(); }
  else if (action === 'journal') showJournal();
  else if (action === 'run-loadout') showRunLoadout();
  else if (action === 'run-slot'&&game.modal==='run-loadout') showRunSlot(element.dataset.kind,Number(element.dataset.index));
  else if (action === 'run-config-select'&&game.modal==='run-slot') selectRunAbility(id);
  else if (action === 'pause') pause();
  else if(action==='full-reset')openModal('full-reset',`<h2 id="modal-title">完全重置遊戲？</h2><p>將永久刪除這個瀏覽器內的所有收藏、招式熟練度、通關紀錄、本局冒險、配置與設定。</p><p>此操作無法復原。離線遊戲檔案會保留。</p><div class="modal-footer">${U.button('取消','close')}${U.button('確認完全重置','full-reset-confirm',{primary:true})}</div>`);
  else if(action==='full-reset-confirm'&&game.modal==='full-reset')resetAllProgress();
  else if(action==='restart-basic')openModal('restart-basic',`<h2 id="modal-title">基礎配置重新出發</h2><p>結束目前冒險，以 Lv.1、快速斬擊與火球術、空白被動技能欄重新出發。</p><p>永久收藏與已累積的招式熟練度都會保留。</p>${game.run?runLootHTML(game.run):''}<div class="modal-footer">${U.button('取消','close')}${U.button('重新出發','restart-basic-confirm',{primary:true})}</div>`);
  else if(action==='restart-basic-confirm'&&game.modal==='restart-basic'){if(game.run&&!game.debugBattle){Meta.settle(game.permanent,game.run);saveSession();persist();}game.run=null;game.battle=null;game.result=null;game.rewards=[];game.fieldRewards=[];game.offered=null;game.noRandom=false;game.build=P.defaultBuild();game.lastRegion=null;saveBuild();beginRun();}
  else if(action.startsWith('world-'))worldDebugAction(action,id);
  else if (action === 'interact') interact();
  else if (action === 'move') chooseMove(id, element.dataset.ultimate === 'true');
  else if (action === 'enter-dungeon' && game.modal === 'dungeon' && D.dungeons.some(d=>d.id===id)) { if(!game.debugBattle){Meta.enter(game.permanent,id);persist();}game.run.dungeon = { id, stage: 0 }; Audio.emit('dungeonEnter'); startEncounter(P.dungeonEncounter(game.run)); }
  else if (action === 'result-next') continueResult();

  else if (action === 'reward-next' && game.modal === 'reward') acquisitionNext();
  else if (action === 'acquire-skip' && game.modal === 'acquire') applyAcquisition(null);
  else if (action === 'acquire-equip' && game.modal === 'acquire') { const list = game.run.build[game.offered.kind]; list.length < 4 ? applyAcquisition(list.length) : showReplacement(); }
  else if (action === 'replace-choose' && game.modal === 'replace') confirmReplacement(Number(element.dataset.index));
  else if (action === 'replace-confirm' && game.modal === 'replace-confirm') applyAcquisition(game.replaceIndex);
  else if (action === 'replace-back' && game.modal === 'replace-confirm') showReplacement();
  else if (action === 'acquire-back' && game.modal === 'replace') showAcquisition();
  else if (action === 'setting-toggle') { if (!Audio.update(id, !game.settings[id])) toast('設定暫時無法儲存。'); applySettings(); renderScreen(); }
  else if (action === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen?.(); else requestGameFullscreen(false); }
  else if (action === 'debug-close') $('debug').hidden = true;
  else if (action === 'debug-exp' && game.scene === 'explore') { P.grantExp(game.run, game.run.level); $('debug').hidden = true; showJournal(); }
  else if (action === 'debug-dungeon' && game.scene === 'explore') { Maps.enter(game.run,D.dungeons[0].mapId); game.run.position = { x: D.dungeons[0].x, y: D.dungeons[0].y + 65 }; $('debug').hidden = true; }
  else if (action === 'debug-random') { game.noRandom = !game.noRandom; if (game.battle) { const sample = P.battleFor(game.run, game.encounter); game.battle.rules = game.noRandom ? { ...sample.rules, critChance: 0, dodgeChance: 0 } : sample.rules; } toast(game.noRandom ? '測試模式：固定命中，無爆擊' : '恢復隨機判定'); }
  renderUI();
}
document.addEventListener('click', event => {
  if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
  const element = event.target.closest('[data-action]'); if (!element || element.disabled) return;
  Audio.unlock(); if (element.dataset.action !== 'move') Audio.emit('buttonConfirm');
  handleAction(element.dataset.action, element.dataset.id, element);saveSession();
});
document.addEventListener('input', event => { if (event.target.id === 'volume') { Audio.update('volume', Number(event.target.value) / 100); $('volume-label').textContent = event.target.value + '%'; } });
document.addEventListener('pointerover', event => { const target = event.target.closest('button'); if (target && !target.contains(event.relatedTarget)) Audio.emit('buttonHover'); const element = event.target.closest('[data-tooltip]'); if (element && event.pointerType !== 'touch' && !element.contains(event.relatedTarget)) scheduleTooltip(element); });
document.addEventListener('pointerout', event => { const element = event.target.closest('[data-tooltip]'); if (element && !element.contains(event.relatedTarget)) hideTooltip(); });
document.addEventListener('focusin', event => { const element = event.target.closest('[data-tooltip]'); if (element && !pressOrigin) scheduleTooltip(element); });
document.addEventListener('focusout', hideTooltip);
document.addEventListener('pointerdown', event => {
  hideTooltip();const element=event.target.closest('[data-tooltip]');
  if(!element||event.button===2)return;
  pressOrigin={x:event.clientX,y:event.clientY};
  longPressTimer=setTimeout(()=>{showTooltip(element);suppressClick=!$('tooltip').hidden;},event.pointerType==='touch'?420:600);
});
document.addEventListener('pointermove',event=>{if(pressOrigin&&Math.hypot(event.clientX-pressOrigin.x,event.clientY-pressOrigin.y)>10){clearTimeout(longPressTimer);pressOrigin=null;}});
document.addEventListener('pointerup',()=>{clearTimeout(longPressTimer);pressOrigin=null;});
document.addEventListener('pointercancel',()=>{pressOrigin=null;suppressClick=false;hideTooltip();});
document.addEventListener('contextmenu',event=>{const element=event.target.closest('[data-tooltip]');if(!element)return;event.preventDefault();hideTooltip();showTooltip(element);});

document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && game.modal) {
    const focusable = [...$('modal').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
    if (focusable.length) { const first = focusable[0], last = focusable.at(-1); if (event.shiftKey && [first, $('modal')].includes(document.activeElement)) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && [last, $('modal')].includes(document.activeElement)) { event.preventDefault(); first.focus(); } }
    return;
  }
  if (event.key === 'F1') { resetJoystick(); event.preventDefault(); $('debug').hidden = !$('debug').hidden; game.keys.clear(); return; }
  if (event.key === 'Escape') { hideTooltip(); if (game.modal) { if (['pause', 'journal', 'stat', 'picker', 'library-replace', 'dungeon', 'discovery', 'debug-lab'].includes(game.modal)) closeModal(); else if (game.modal === 'replace-confirm') showReplacement(); else if (game.modal === 'replace') showAcquisition(); } else if (game.screen) screenBack(); else pause(); return; }
  if (event.target?.tagName === 'INPUT' || game.modal || game.screen || !game.run || event.repeat || !$('debug').hidden) return;
  const key = event.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  Audio.unlock();
  if (game.scene === 'battle') {
    const directions = { w: 0, arrowup: 0, d: 1, arrowright: 1, s: 2, arrowdown: 2, a: 3, arrowleft: 3 };
    if (key in directions) chooseMove(game.run.build.moves[directions[key]]);
    else if (key === ' ' || key === '5') chooseMove(game.run.build.ultimate, true);
    else if (/^[1-4]$/.test(key)) chooseMove(game.run.build.moves[Number(key) - 1]);
  } else { game.keys.add(key); if (key === 'e') interact(); if (key === 'b') showJournal(); }
});
document.addEventListener('keyup', event => game.keys.delete(event.key.toLowerCase()));
const stick = { pointer: null, x: 0, y: 0 };
function resetJoystick() {
  stick.pointer = null; stick.x = stick.y = 0;
  $('joystick-thumb').style.transform = 'translate(-50%, -50%)';
  $('joystick').classList.remove('active');
}
function dragJoystick(event) {
  if (event.pointerId !== stick.pointer) return;
  const rect = $('joystick').getBoundingClientRect(), radius = rect.width * .32;
  const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
  const distance = Math.hypot(dx, dy), amount = Math.min(1, distance / radius);
  const strength = amount < .13 ? 0 : (amount - .13) / .87;
  stick.x = distance ? dx / distance * strength : 0; stick.y = distance ? dy / distance * strength : 0;
  const scale = rect.width / 164;
  $('joystick-thumb').style.transform = `translate(calc(-50% + ${distance ? dx / distance * amount * radius / scale : 0}px), calc(-50% + ${distance ? dy / distance * amount * radius / scale : 0}px))`;
}
$('joystick').addEventListener('pointerdown', event => {
  if (game.scene !== 'explore' || game.modal || game.screen || !$('debug').hidden || stick.pointer !== null) return;
  event.preventDefault(); stick.pointer = event.pointerId; $('joystick').setPointerCapture(event.pointerId);
  $('joystick').classList.add('active'); dragJoystick(event);
});
$('joystick').addEventListener('pointermove', dragJoystick);
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(name, event => { if (event.pointerId === stick.pointer) resetJoystick(); });
window.addEventListener('resize', resizeStage);
window.addEventListener('blur', () => { game.keys.clear(); game.touch.clear(); resetJoystick(); clearTimeout(longPressTimer); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) {pause();saveSession();} last = performance.now(); });
function input() { return { x: stick.x + Number(game.keys.has('d') || game.keys.has('arrowright') || game.touch.has('right')) - Number(game.keys.has('a') || game.keys.has('arrowleft') || game.touch.has('left')), y: stick.y + Number(game.keys.has('s') || game.keys.has('arrowdown') || game.touch.has('down')) - Number(game.keys.has('w') || game.keys.has('arrowup') || game.touch.has('up')) }; }
function combatEvent(event) {
  if(game.run&&!game.debugBattle)Enc.hit(game.permanent,game.run,event);
  renderer.event(event);
  if(event.type==='skill'&&event.actorId==='player'){$('passive-flash').textContent='【'+event.text+'】';game.passiveUntil=renderer.time+.8;}
  if (event.type === 'cast' && event.moveId === 'crush') Audio.emit('danger');
  if (event.type === 'damage' || event.type === 'dodge') { Audio.emit('skillCast', event); if (event.type === 'damage') Audio.emit(event.critical ? 'critical' : 'damage', event); game.castFlashes[event.actorId] = { type: 'complete', until: renderer.time + .28 }; }
  if (event.type === 'interrupt') { game.castFlashes[event.targetId] = { type: 'interrupted', until: renderer.time + .42 }; Audio.emit('interrupt', event); }
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now; game.moving = false;
  if (!game.modal && !game.screen && $('debug').hidden && game.run) {
    if (game.scene === 'explore') { const direction = input(); game.moving = !!(direction.x || direction.y); if (direction.x) game.facing = direction.x > 0 ? 1 : -1; const enemy = World.update(game.run, dt, direction);if(!game.debugBattle&&Meta.discover(game.permanent,game.run))persist();const map=D.maps[game.run.currentMapId];if(map&&game.lastRegion!==map.id){game.lastRegion=map.id;toast(map.name+' · 推薦 Lv.'+map.recommendedLevelMin+'～'+map.recommendedLevelMax);} if (enemy) startEncounter(enemy); }
    else if (game.scene === 'battle') {
      if (game.transition > 0) { game.transition = Math.max(0, game.transition - dt); if (!game.transition) $('transition').hidden = true; }
      else {
        if (game.battle.phase === 'fighting') { game.run.world.time += dt; game.battle.advance(dt); }
        while (game.eventCursor < game.battle.events.length) combatEvent(game.battle.events[game.eventCursor++]);
        if (game.battle.phase !== 'fighting' && !game.resultHandled) finishEncounter();
        if (game.resultDelay !== null) { game.resultDelay -= dt; if (game.resultDelay <= 0) { game.resultDelay = null; showResult(); } }
      }
    }
  }
  if(game.run?.quickBattle&&game.modal==='suppression'&&!document.hidden){game.run.quickBattle.remaining-=dt;if(game.run.quickBattle.remaining<=0)completeSuppression();}
  saveElapsed+=dt;if(saveElapsed>=1){saveElapsed=0;if(game.screen==='shop'&&game.shopMinute!==Math.floor(Date.now()/60000)){game.shopMinute=Math.floor(Date.now()/60000);renderScreen();persist();}saveSession();}
  if(game.modal==='result'&&game.growthAnimation){const a=game.growthAnimation,oldTick=Math.floor(a.elapsed/.14);a.elapsed+=dt;if(!game.settings.reducedMotion&&a.elapsed<1.8&&Math.floor(a.elapsed/.14)!==oldTick)Audio.emit('growthTick');LevelUp.update(game.growthAnimation.exp,game.growthAnimation.elapsed,game.settings.reducedMotion);}
  if(game.modal==='result'&&game.recoveryCountdown!==null){game.recoveryCountdown=Math.max(0,game.recoveryCountdown-dt);const label=$('recovery-countdown');if(label)label.textContent=game.recoveryCountdown.toFixed(1);if(game.recoveryCountdown<=0)continueResult();}
  renderer.draw(game, dt); uiTime += dt; if (uiTime >= .08) { renderUI(); uiTime = 0; }
  if (now > game.toastUntil) $('toast').textContent = '';
  requestAnimationFrame(frame);
}
$('portrait').innerHTML = U.icon('hood', 41);
resizeStage(); applySettings(); renderUI(); if (loaded.warning) toast(loaded.warning);
window.addEventListener('pagehide',saveSession);
resumeSession();
window.GameApp = { game, renderer };
requestAnimationFrame(frame);
