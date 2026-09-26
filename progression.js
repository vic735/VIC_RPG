(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.GameData;
  const C = typeof module !== 'undefined' ? require('./engine.js') : root.BattleCore;
  const R = typeof module !== 'undefined' ? require('./skill-runtime.js') : root.SkillRuntime;
  const Rewards=typeof module!=='undefined'?require('./world-rewards.js'):root.WorldRewards;
  const Meta=typeof module!=='undefined'?require('./meta'):root.GameMeta;
  const Classes=typeof module!=='undefined'?require('./classes'):root.ClassSystem;
  if(typeof module!=='undefined')require('./content-v1');
  const Maps=typeof module!=='undefined'?require('./world-maps'):root.WorldMaps;
  const clone = x => JSON.parse(JSON.stringify(x));
  function freshProgress() { const p={ schemaVersion: 2, ultimateUnlocked: false, skills: [...D.startingSkills], moves: Object.fromEntries(D.startingMoves.map(id=>[id,1])), ultimates: ['nova'], books: [], equipment: ['hood', 'coat', 'wraps', 'boots', 'sword'], completions: 0 };Classes.normalize(p);return p; }
  function loadProgress(storage) {
    try {
      const raw = storage.getItem('afterlight.progress.v2'); let session=null;try{session=JSON.parse(storage.getItem('afterlight.session.v1')||'null');}catch(_){}if (!raw&&!session?.permanent) return { progress: freshProgress(), warning: null };
      let p = raw?JSON.parse(raw):session.permanent; if((session?.permanent?.meta?.revision||0)>(p.meta?.revision||0))p=session.permanent; if (p.schemaVersion !== 2 || !p.moves || !Array.isArray(p.books) || !Array.isArray(p.equipment) || !Array.isArray(p.skills)) throw Error('版本不符');
      const result = freshProgress();
      if(p.meta)result.meta=clone(p.meta);Meta.normalize(result);Classes.normalize(p);result.unlockedClassIds=[...p.unlockedClassIds];result.achievementProgress=clone(p.achievementProgress);result.completedAchievementIds=[...p.completedAchievementIds];result.unlockedClassExclusiveMoveIds=[...p.unlockedClassExclusiveMoveIds];result.unlockedClassExclusiveSkillIds=[...p.unlockedClassExclusiveSkillIds];
      result.ultimateUnlocked = p.ultimateUnlocked === true;
      // Content-v1 introduces 100 collectible move records, including magic,
      // support and ultimate entries. Preserve every known move id from saves;
      // the old `kind === normal` gate silently discarded the new records.
      for (const [id, level] of Object.entries(p.moves)) {
        const actual = id.startsWith('moves:') ? id.slice(6) : id;
        if (D.moves[actual] && Number.isInteger(level) && level >= 1) result.moves[actual] = Math.min(3, level);
      }
      result.skills = [...new Set([...result.skills,...p.skills.map(id=>id.startsWith('skills:')?id.slice(7):id).filter(id=>D.skills[id])])];
      result.ultimates = [...new Set([...result.ultimates,...(p.ultimates||[]).filter(id=>D.moves[id]?.kind==='ultimate')])];
      result.books = [...new Set(p.books.filter(id => D.books[id]))];
      result.equipment = [...new Set([...result.equipment, ...p.equipment.filter(id => D.equipment[id])])];
      result.dungeonCompletions=Object.fromEntries(Object.entries(p.dungeonCompletions||{}).filter(([id,n])=>D.dungeons.some(d=>d.id===id)&&Number.isInteger(n)&&n>=0));
      result.completions = Number.isInteger(p.completions) && p.completions >= 0 ? p.completions : 0;
      return { progress: result, warning: null };
    } catch (_) { return { progress: freshProgress(), warning: '無法讀取收藏，這次先使用初始收藏；取得獎勵時會再次嘗試儲存。' }; }
  }
  function saveProgress(storage, progress) { try { storage.setItem('afterlight.progress.v2', JSON.stringify(progress)); return true; } catch (_) { return false; } }
  function defaultBuild() { return { activeClassId:'ADVENTURER', talents: [], moves: ['quick', 'fire'], ultimate: null, equipment: { head: 'hood', chest: 'coat', arms: 'wraps', feet: 'boots', weapon: 'sword' } }; }
  function validateBuild(build, permanent) {
    Classes.normalize(permanent);
    if(!permanent.unlockedClassIds.includes(build.activeClassId||'ADVENTURER'))throw Error('職業尚未解鎖');
    C.validateBuild(build, Object.keys(permanent.moves));
    if(build.ultimate && permanent.ultimateUnlocked===false)throw Error('首次冒險結束後解鎖必殺槽');
    if (build.talents.some(id => !permanent.skills.includes(id) || !D.skills[id] || !Classes.eligible(D.skills[id],build.activeClassId||'ADVENTURER',permanent))) throw Error('技能尚未學會或不屬於目前職業');
    if (build.ultimate && !D.moves[build.ultimate]) throw Error('必殺技不存在');
    if (build.ultimate && !Object.prototype.hasOwnProperty.call(permanent.moves, build.ultimate) && !permanent.ultimates.includes(build.ultimate)) throw Error('必殺技尚未學會');
    if(build.moves.some(id=>!Classes.eligible(D.moves[id],build.activeClassId||'ADVENTURER',permanent)) || (build.ultimate&&!Classes.eligible(D.moves[build.ultimate],build.activeClassId||'ADVENTURER',permanent)))throw Error('招式不屬於目前職業');
    for (const [slot, id] of Object.entries(build.equipment)) if (id && (!permanent.equipment.includes(id) || D.equipment[id]?.slot !== slot)) throw Error('裝備尚未解鎖或欄位錯誤');
  }
  function createRun(permanent, build = defaultBuild(), rng = Math.random) {
    validateBuild(build, permanent);
    const run={ adventurerRank:{version:1,index:0,progress:0,last:{kills:0,dungeons:0,level:1},normalKills:0,challengeKills:0,history:[]}, schemaVersion: 2, currentMapId:'north_plains_1', activeClassId:build.activeClassId||'ADVENTURER', defeatedEnemyTypesThisRun: [], battleStats:{kills:0,normalKills:0,quickKills:0,clearedDungeonIds:[],highestHit:0,previousBestHit:permanent.meta?.bestHit||0,lastDefeat:null}, loot: {}, ultimateCharge: 0, ultimateChargeVersion: 2, level: 1, exp: 0, points: 0, allocated: { hp: 0, stamina: 0, mana: 0, agility: 0, luck: 0 }, deaths: 0, debuffIds: [], status: 'active', moveLevels: clone(permanent.moves), build: clone(build), position: { x: D.world.camp.x, y: D.world.camp.y }, world: { time: 0, enemies: D.world.spawns.map(([x, y, type], index) => ({ id: type==='camp_golem'?'enemy-camp-golem':'enemy-' + index, x, y, homeX: x, homeY: y, type, level: D.enemySpawnData[index]?.level || regionLevel(x,y)+(D.enemySpawnData[index]?.levelBonus||0), elite:!!D.enemySpawnData[index]?.elite, regionId:D.enemySpawnData[index]?.regionId, discovered: false, defeatedUntil: 0 })), discoveredDungeons: [] }, dungeon: null };
    ensureWorldContent(run);return run;
  }
  function ensureWorldContent(run){Maps.ensureRun(run);const spawn=D.enemySpawnData.find(e=>e.id==='camp-golem');if(spawn&&!run.world.enemies.some(e=>e.type==='camp_golem'))run.world.enemies.push({id:'enemy-camp-golem',mapId:'north_plains_1',x:D.world.camp.x+220,y:D.world.camp.y+80,homeX:D.world.camp.x+220,homeY:D.world.camp.y+80,type:spawn.type,level:spawn.level,regionId:spawn.regionId,elite:false,discovered:false,defeatedUntil:0});const golem=run.world.enemies.find(e=>e.type==='camp_golem');if(golem){golem.mapId='north_plains_1';golem.x=golem.homeX=D.world.camp.x+220;golem.y=golem.homeY=D.world.camp.y+80;}for(const [i,s] of D.enemySpawnData.entries())if(s.openingRoute&&!run.world.enemies.some(e=>e.id==='enemy-'+i))run.world.enemies.push({id:'enemy-'+i,mapId:'north_plains_1',x:s.x,y:s.y,homeX:s.x,homeY:s.y,type:s.type,level:s.level,regionId:s.regionId,elite:false,discovered:false,defeatedUntil:0});}
  function regionAt(x,y){return D.world.regions.find(r=>x>=r.bounds[0]&&x<r.bounds[0]+r.bounds[2]&&y>=r.bounds[1]&&y<r.bounds[1]+r.bounds[3])||D.world.regions[0];}
  function regionDepth(r,x,y){return Math.max(0,Math.min(1,1-Math.max(Math.abs(x-r.x)/(r.bounds[2]/2),Math.abs(y-r.y)/(r.bounds[3]/2))));}
  function regionLevel(x,y){const r=regionAt(x,y),p=regionDepth(r,x,y),index=Math.min(3,Math.floor(p*4)),band=r.subAreaLevelRanges[index],within=Math.min(1,p*4-index);return Math.round(band.min+(band.max-band.min)*within);}
  function statBreakdown(run) {
    const result = {}, bonuses = {}, rates = {}, baseRates = {}, finalRates = {};
    for(const id of run.build.talents){const skill=D.skills[id];for(const [k,v]of Object.entries(skill.statRates||{})){const target=skill.baseOnly?baseRates:finalRates;target[k]=(target[k]||0)+v;}}
    for (const id of run.build.talents) { const s = D.skills[id]; for (const [k, v] of Object.entries(s.modifiers)) bonuses[k] = (bonuses[k] || 0) + v; for (const [k, v] of Object.entries(s.growthRates || {})) rates[k] = (rates[k] || 0) + v; }
    for (const id of Object.values(run.build.equipment)) if (id) for (const [k, v] of Object.entries(D.equipment[id].modifiers)) bonuses[k] = (bonuses[k] || 0) + v;
    const cls=Classes.active(run);for (const k of Object.keys(D.player)) result[k] = { base: D.adventure.baseStats[k]*cls.baseStatMultipliers[k]*(1+(baseRates[k]||0)) + (bonuses[k] || 0), finalRate: finalRates[k]||0, perLevel: D.adventure.growth[k]*cls.levelGrowthMultipliers[k], bonusRate: rates[k] || 0, allocated: run.allocated[k] * D.balance.pointValues[k] };
    return result;
  }
  function statsFor(run, withDebuffs = true) {
    const stats = {}, detail = statBreakdown(run);
    for (const [k, d] of Object.entries(detail)) {let growth=0,start=1;for(const band of D.adventure.balance50.growth){const end=Math.min(run.level,band.through);growth+=Math.max(0,end-start)*band[k];start=band.through;}growth+=Math.max(0,run.level-50)*d.perLevel;stats[k]=(d.base+growth*(1+d.bonusRate)+d.allocated)*(1+d.finalRate);}
    if (withDebuffs) for (const id of run.debuffIds) { const d = D.debuffs.find(d => d.id === id); stats[d.stat] *= d.factor; }
    return stats;
  }
  function moveScale(level) { const knots=D.adventure.balance50.mastery;for(let i=1;i<knots.length;i++){const [a,x]=knots[i-1],[b,y]=knots[i];if(level<=b)return x+(Math.max(a,level)-a)/(b-a)*(y-x);}return knots.at(-1)[1]+Math.max(0,level-50)*D.balance.moveGrowth.at(-1); }
  function expMultiplier(gap) {
    const table = D.balance.expGap; if (gap <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) if (gap <= table[i][0]) { const [a, av] = table[i - 1], [b, bv] = table[i]; return av + (bv - av) * (gap - a) / (b - a); }
    return table.at(-1)[1];
  }
  const levelCost = level => D.balance.levelCost + (level - 1) * D.balance.levelCostGrowth;
  function grantExp(run, enemyLevel, enemyType) {
    const beforeLevel=run.level,beforeStats=statsFor(run);
    const actor={stats:statsFor(run),statuses:{},hp:1,mana:1,stamina:1};const runtime=new R.Runtime({time:0,run,player:actor,log(){}},actor,run.build.talents.map(id=>D.skills[id]));
    const expFactor=runtime.modify('exp',1);
    const opening=run.level<D.balance.openingExp.through&&enemyType?.startsWith('greywind_'),gap=expMultiplier(enemyLevel-run.level);
    const amount = Math.round((D.monsters[enemyType]?.expFactor||1)*expFactor*(D.balance.expBase + enemyLevel * D.balance.expPerLevel) * (opening?Math.max(gap,D.balance.openingExp.minimumGapFactor):gap) * (opening?D.balance.openingExp.multiplier:1) * (1 + statsFor(run).luck * D.balance.expPerLuck));
    runtime.emit('OnEXPReceived',{amount}); run.exp += amount; let levels = 0;
    while (run.exp >= levelCost(run.level)) { run.exp -= levelCost(run.level); run.level++; levels++; runtime.emit('OnLevelUp',{level:run.level}); }
    const afterStats=statsFor(run);if(run.dungeonResources)for(const k of ['hp','mana','stamina'])run.dungeonResources[k]=Math.min(afterStats[k],run.dungeonResources[k]+afterStats[k]-beforeStats[k]);
    run.points=0;return { amount, levels, beforeLevel, afterLevel:run.level, beforeStats, afterStats };
  }
  function allocate() { return false; } // Compatibility API: manual allocation is retired.
  function acquireMove(permanent, run, id) {
    if (!D.moves[id] || D.moves[id].kind !== 'normal') throw Error('未知普通招式');
    const old = permanent.moves[id] || 0; permanent.moves[id] = Math.min(3, old + 1);
    run.moveLevels[id] = (run.moveLevels[id] || old) + 1;
    return run.moveLevels[id];
  }
  function understandBook(permanent, run, id) {
    const book = D.books[id]; if (!book || !permanent.books.includes(id) || (permanent.moves[book.requirement.moveId] || 0) < book.requirement.level) return false;
    if (!permanent.moves[book.moveId]) { permanent.moves[book.moveId] = 1; if (run) run.moveLevels[book.moveId] = 1; }
    return true;
  }
  function learnSkill(permanent,id,run=null){if(!D.skills[id])throw Error('未知技能');if(run)return receiveAbility(permanent,run,'talents',id);const isNew=!permanent.skills.includes(id);if(isNew)permanent.skills.push(id);return {id,isNew};}
  function receiveAbility(permanent, run, kind, id) {
    run.pendingAcquisitions ||= [];
    if (!['moves', 'talents'].includes(kind)) throw Error('未知能力種類');
    const known = kind === 'moves' ? !!run.moveLevels[id] : permanent.skills.includes(id);
    const before = kind === 'moves' ? run.moveLevels[id] || 0 : known ? 1 : 0;
    if (kind === 'moves') acquireMove(permanent, run, id);
    else { if (!D.skills[id]) throw Error('未知技能'); if (!permanent.skills.includes(id)) permanent.skills.push(id); }
    if (!known) run.pendingAcquisitions.push({ kind, id });
    const available=kind==='moves'?'availableMoves':'availableSkills';run[available]||=[];if(!run[available].includes(id))run[available].push(id);
    const receipt={ kind, id, isNew: !known, before, after: kind === 'moves' ? run.moveLevels[id] : 1 };recordLoot(run,receipt);return receipt;
  }
  // The acquisition ticket is consumed on equip OR skip. There is no general in-run loadout setter.
  function resolveAcquisition(run, kind, id, index = null) {
    const ticket = (run.pendingAcquisitions || []).findIndex(t => t.kind === kind && t.id === id);
    if (ticket < 0) return false;
    if (index !== null) {
      if (!['moves', 'talents'].includes(kind) || !Number.isInteger(index) || index < 0 || index > 3) return false;
      const list = run.build[kind]; if (list.includes(id) || index > list.length) return false;
      if (index === list.length) { if (list.length >= 4) return false; list.push(id); } else list[index] = id;
    }
    run.pendingAcquisitions.splice(ticket, 1); return true;
  }
  function recordLoot(run,reward){run.loot||={};const key=reward.kind+':'+reward.id,previous=run.loot[key];if(previous){previous.count++;previous.isNew||=!!reward.isNew;if(reward.after!==undefined)previous.after=reward.after;}else run.loot[key]={kind:reward.kind,id:reward.id,count:1,isNew:!!reward.isNew,...(reward.before!==undefined?{before:reward.before,after:reward.after}:{})};}
  function ultimateChargeCost(run){return D.moves[run.build.ultimate]?.ultimateChargeCost||100;}
  function normalizeUltimateCharge(run){const cap=ultimateChargeCost(run);if(run.ultimateChargeVersion!==2){run.ultimateCharge=Math.max(0,Math.min(1,(Number(run.ultimateCharge)||0)/12))*cap;run.ultimateChargeVersion=2;}else run.ultimateCharge=Math.max(0,Math.min(cap,Number(run.ultimateCharge)||0));return run.ultimateCharge;}
  function carryBattleCharge(run,battle){const cap=ultimateChargeCost(run);run.ultimateChargeVersion=2;run.ultimateCharge=Math.max(0,Math.min(cap,Number.isFinite(battle.charge)?battle.charge:0));}
  function grantRewards(permanent,run,rewards){return rewards.map(reward=>{if(['moves','talents'].includes(reward.kind))return {...reward,...receiveAbility(permanent,run,reward.kind,reward.id)};const collection=permanent[reward.kind],source=reward.kind==='books'?D.books:D.equipment;if(!collection||!source[reward.id])throw Error('未知獎勵內容');const isNew=!collection.includes(reward.id);if(isNew)collection.push(reward.id);const receipt={...reward,isNew};recordLoot(run,receipt);return receipt;});}
  function dungeonReward(permanent,run,rng=Math.random,options={}){
    if(!run.dungeon)throw Error('不在地下城');const d=D.dungeons.find(d=>d.id===run.dungeon.id);
    if(run.dungeon.stage!==d.enemyWaves.length-1)throw Error('尚未完成所有波次');
    if(run.dungeon.rewardClaimed)return [];
    const draw=Rewards.dungeon(d.id,rng,{...options,level:run.level}),rewards=grantRewards(permanent,run,draw.rewards);run.dungeon.rewardClaimed=true;run.dungeon.rewardCombination=draw.combination;permanent.completions++;permanent.dungeonCompletions||={};permanent.dungeonCompletions[d.id]=(permanent.dungeonCompletions[d.id]||0)+1;return rewards;
  }
  function enemyDefinition(type,level,options={}){const source=D.monsters[type];if(!source)throw Error('未知敵人');const stats={},pressure=D.balance.enemyLevelPressure||{start:5,perLevel:0,agilityPerLevel:0},pressureScale=options.overworld===false?1:1+Math.max(0,level-pressure.start)*pressure.perLevel,defense=D.balance.enemyDefense||{base:0,perLevel:0};for(const [k,v]of Object.entries(source.stats)){if(source.growth){stats[k]=k==='agility'||k==='luck'?v+(level-1)*source.growth[k]:v*(1+(level-1)*source.growth[k])*pressureScale;}else{stats[k]=v*(1+(level-1)*D.balance.enemyGrowth)*pressureScale;}if(k==='agility'&&options.overworld!==false)stats[k]+=Math.max(0,level-pressure.start)*pressure.agilityPerLevel;}return {...source,stats,level,physicalDefense:defense.base+level*defense.perLevel+(source.physicalDefenseBonus||0),magicResistance:defense.base+level*defense.perLevel+(source.magicResistanceBonus||0)};}
  function battleFor(run, encounter, rng = Math.random) {
    const effects = {}; for (const id of Object.values(run.build.equipment)) if (id) for (const key of ['physicalMultiplier', 'physicalAttackTime', 'onDodgeShorten']) if (D.equipment[id][key]) effects[key] = D.equipment[id][key];
    const b = new C.Battle({ rng, balance50:true, levelGap:encounter.level-run.level, preserveResources:!!run.dungeon, stats: statsFor(run, false), build: run.build, moveLevels: run.moveLevels, moveScale, enemy: enemyDefinition(encounter.type, encounter.level,{overworld:!run.dungeon}), equipmentEffects: effects, rules: {
      dodgeChance: stats => Math.min(D.balance.dodgeCap, stats.agility * D.balance.dodgePerAgility),
      critChance: stats => Math.min(D.balance.critCap, D.balance.critBase + stats.luck * D.balance.critPerLuck),
      critMultiplier: stats => D.balance.critDamageBase + stats.luck * D.balance.critDamagePerLuck
    } });
    b.run.deaths = run.deaths; b.run.debuffIds = [...run.debuffIds]; b.start(); b.charge=normalizeUltimateCharge(run);if(run.dungeon&&run.dungeonResources)for(const k of ['hp','mana','stamina'])b.player[k]=Math.max(0,Math.min(b.player.stats[k],run.dungeonResources[k]));return b;
  }
  function dungeonEncounter(run){const d=D.dungeons.find(d=>d.id===run.dungeon?.id),wave=d?.enemyWaves[run.dungeon.stage];if(!wave)throw Error('地下城波次不存在');return {...wave,level:wave.level};}
  const api = { ensureWorldContent, recordLoot, ultimateChargeCost, normalizeUltimateCharge, carryBattleCharge, freshProgress, loadProgress, saveProgress, defaultBuild, validateBuild, createRun, regionAt, regionDepth, regionLevel, statBreakdown, statsFor, moveScale, expMultiplier, levelCost, grantExp, allocate, acquireMove, learnSkill, receiveAbility, resolveAcquisition, understandBook, grantRewards, dungeonReward, enemyDefinition, battleFor, dungeonEncounter };
  if (typeof module !== 'undefined') module.exports = api; else root.Progression = api;
})(globalThis);
