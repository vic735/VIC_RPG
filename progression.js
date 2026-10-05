(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.GameData;
  const C = typeof module !== 'undefined' ? require('./engine.js') : root.BattleCore;
  const R = typeof module !== 'undefined' ? require('./skill-runtime.js') : root.SkillRuntime;
  const Rewards=typeof module!=='undefined'?require('./world-rewards.js'):root.WorldRewards;
  const Meta=typeof module!=='undefined'?require('./meta'):root.GameMeta;
  const Classes=typeof module!=='undefined'?require('./classes'):root.ClassSystem;
  if(typeof module!=='undefined')require('./content-v1');
  const Maps=typeof module!=='undefined'?require('./world-maps'):root.WorldMaps;
  const LevelProgression=typeof module!=='undefined'?require('./level-progression'):root.LevelProgression;if(typeof module!=='undefined')LevelProgression.apply(D);
  const Training=typeof module!=='undefined'?require('./training-map'):root.TrainingMap;
  const Exploration=typeof module!=='undefined'?require('./run-exploration'):root.RunExploration;
  const clone = x => JSON.parse(JSON.stringify(x));
  function freshProgress() { const p={ schemaVersion: 2, rankDisplayVersion:2, ultimateUnlocked: false, skills: [...D.startingSkills], moves: Object.fromEntries(D.startingMoves.map(id=>[id,1])), ultimates: ['nova'], books: [], equipment: ['hood', 'coat', 'wraps', 'boots', 'sword'], completions: 0 };Classes.normalize(p);return p; }
  function migratePermanent(p){if(p.rankDisplayVersion===2)return p;for(const key of Object.keys(p.achievementProgress||{}))if(key.endsWith('_rank'))p.achievementProgress[key]=Math.max(0,p.achievementProgress[key]-2);p.rankDisplayVersion=2;return p;}
  function loadProgress(storage) {
    try {
      const raw = storage.getItem('afterlight.progress.v2'); let session=null;try{session=JSON.parse(storage.getItem('afterlight.session.v1')||'null');}catch(_){}if (!raw&&!session?.permanent) return { progress: freshProgress(), warning: null };
      let p = raw?JSON.parse(raw):session.permanent; if((session?.permanent?.meta?.revision||0)>(p.meta?.revision||0))p=session.permanent; if (p.schemaVersion !== 2 || !p.moves || !Array.isArray(p.books) || !Array.isArray(p.equipment) || !Array.isArray(p.skills)) throw Error('版本不符');
      migratePermanent(p);const result = freshProgress();
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
  function saveProgress(storage, progress) { try { migratePermanent(progress);storage.setItem('afterlight.progress.v2', JSON.stringify(progress)); return true; } catch (_) { return false; } }
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
    const run={ mapGeometryVersion:Maps.geometry.version, adventurerRank:{version:2,index:0,progress:0,last:{kills:0,dungeons:0,level:1},normalKills:0,challengeKills:0,history:[]}, schemaVersion: 2, restoredRulesVersion:1, enemyLevelCurveVersion:LevelProgression?.VERSION||0, currentMapId:'north_plains_1', activeClassId:build.activeClassId||'ADVENTURER', defeatedEnemyTypesThisRun: [], battleStats:{kills:0,normalKills:0,quickKills:0,clearedDungeonIds:[],highestHit:0,previousBestHit:permanent.meta?.bestHit||0,lastDefeat:null}, loot: {}, ultimateCharge: 0, ultimateChargeVersion: 2, level: 1, exp: 0, points: 0, allocated: { hp: 0, stamina: 0, mana: 0, agility: 0, luck: 0 }, deaths: 0, debuffIds: [], status: 'active', moveLevels: clone(permanent.moves), build: clone(build), position: { x: D.world.camp.x, y: D.world.camp.y }, world: { time: 0, enemies: D.world.spawns.map(([x, y, type], index) => ({ id: type==='camp_golem'?'enemy-camp-golem':'enemy-' + index, x, y, homeX: x, homeY: y, type, level: D.enemySpawnData[index]?.level || regionLevel(x,y)+(D.enemySpawnData[index]?.levelBonus||0), elite:!!D.enemySpawnData[index]?.elite, regionId:D.enemySpawnData[index]?.regionId, discovered: false, defeatedUntil: 0 })), discoveredDungeons: [] }, dungeon: null };
    Exploration.ensure(run,{rng,permanent});ensureWorldContent(run);return run;
  }
  function migrateRun(run){
    const needsLevel=run.enemyLevelCurveVersion!==LevelProgression.VERSION;
    if(!needsLevel&&run.restoredRulesVersion===1)return false;
    const before=needsLevel?legacyStatsFor(run):statsBeforeRollback(run);if(needsLevel)LevelProgression.migrateRun(D,run);const after=statsFor(run);
    if(run.dungeonResources)for(const k of ['hp','mana','stamina'])run.dungeonResources[k]=Math.max(0,Math.min(after[k],run.dungeonResources[k]/Math.max(1,before[k])*after[k]));
    run.restoredRulesVersion=1;
    return true;
  }
  // Read-only reconstruction of 0.26.0/0.26.1 capacity for save migration.
  function statsBeforeRollback(run){
    const bands=[{through:10,hp:12,stamina:3,mana:3,agility:.6,luck:.3},{through:50,hp:14,stamina:3.5,mana:3.5,agility:.45,luck:.16},{through:150,hp:14,stamina:4,mana:4,agility:.35,luck:.10},{through:300,hp:16,stamina:4.5,mana:4.5,agility:.25,luck:.08},{through:500,hp:18,stamina:5,mana:5,agility:.20,luck:.06}],stats={},detail=statBreakdown(run);
    for(const [k,d]of Object.entries(detail)){let growth=0,start=1;for(const b of bands){growth+=Math.max(0,Math.min(run.level,b.through)-start)*b[k];start=b.through;}stats[k]=(d.base+growth*d.classGrowthMultiplier*(1+d.bonusRate)+d.allocated)*(1+d.finalRate);}
    for(const id of run.debuffIds){const d=D.debuffs.find(d=>d.id===id);if(d)stats[d.stat]*=d.factor;}
    for(const k of Object.keys(stats))stats[k]*=Exploration.statFactor(run,k);return stats;
  }
  function legacyStatsFor(run){
    const stats={},detail=statBreakdown(run);
    for(const [k,d]of Object.entries(detail)){let growth=0,start=1;for(const band of D.adventure.balance50.growth){growth+=Math.max(0,Math.min(run.level,band.through)-start)*band[k]*d.classGrowthMultiplier;start=band.through;}growth+=Math.max(0,run.level-50)*d.perLevel;stats[k]=(d.base+growth*(1+d.bonusRate)+d.allocated)*(1+d.finalRate);}
    for(const id of run.debuffIds){const d=D.debuffs.find(d=>d.id===id);if(d)stats[d.stat]*=d.factor;}
    for(const k of Object.keys(stats))stats[k]*=Exploration.statFactor(run,k);return stats;
  }
  function ensureWorldContent(run){migrateRun(run);Maps.ensureRun(run);Exploration.ensure(run);if(run.starter&&run.currentMapId===run.starter.mapId)return;const spawn=D.enemySpawnData.find(e=>e.id==='camp-golem');if(spawn&&!run.world.enemies.some(e=>e.type==='camp_golem'))run.world.enemies.push({id:'enemy-camp-golem',mapId:'north_plains_1',x:D.world.camp.x+220,y:D.world.camp.y+80,homeX:D.world.camp.x+220,homeY:D.world.camp.y+80,type:spawn.type,level:spawn.level,regionId:spawn.regionId,elite:false,discovered:false,defeatedUntil:0});const golem=run.world.enemies.find(e=>e.type==='camp_golem');if(golem){golem.mapId='north_plains_1';golem.x=golem.homeX=D.world.camp.x+220;golem.y=golem.homeY=D.world.camp.y+80;}for(const [i,s] of D.enemySpawnData.entries())if(!run.starter&&!D.maps[run.currentMapId]?.route&&s.openingRoute&&!run.world.enemies.some(e=>e.id==='enemy-'+i))run.world.enemies.push({id:'enemy-'+i,mapId:'north_plains_1',x:s.x,y:s.y,homeX:s.x,homeY:s.y,type:s.type,level:s.level,regionId:s.regionId,elite:false,discovered:false,defeatedUntil:0});}
  function regionAt(x,y){return D.world.regions.find(r=>x>=r.bounds[0]&&x<r.bounds[0]+r.bounds[2]&&y>=r.bounds[1]&&y<r.bounds[1]+r.bounds[3])||D.world.regions[0];}
  function regionDepth(r,x,y){return Math.max(0,Math.min(1,1-Math.max(Math.abs(x-r.x)/(r.bounds[2]/2),Math.abs(y-r.y)/(r.bounds[3]/2))));}
  function regionLevel(x,y){const r=regionAt(x,y),p=regionDepth(r,x,y),index=Math.min(3,Math.floor(p*4)),band=r.subAreaLevelRanges[index],within=Math.min(1,p*4-index);return Math.round(band.min+(band.max-band.min)*within);}
  function statBreakdown(run) {
    const result = {}, bonuses = {}, rates = {}, baseRates = {}, finalRates = {};
    for(const id of run.build.talents){const skill=D.skills[id];for(const [k,v]of Object.entries(skill.statRates||{})){const target=skill.baseOnly?baseRates:finalRates;target[k]=(target[k]||0)+v;}}
    for (const id of run.build.talents) { const s = D.skills[id]; for (const [k, v] of Object.entries(s.modifiers)) bonuses[k] = (bonuses[k] || 0) + v; for (const [k, v] of Object.entries(s.growthRates || {})) rates[k] = (rates[k] || 0) + v; }
    for (const id of Object.values(run.build.equipment)) if (id) for (const [k, v] of Object.entries(D.equipment[id].modifiers)) bonuses[k] = (bonuses[k] || 0) + v;
    const cls=Classes.active(run);for (const k of Object.keys(D.player)) result[k] = { base: D.adventure.baseStats[k]*cls.baseStatMultipliers[k]*(1+(baseRates[k]||0)) + (bonuses[k] || 0), finalRate: finalRates[k]||0, classGrowthMultiplier:cls.levelGrowthMultipliers[k], perLevel: D.adventure.growth[k]*cls.levelGrowthMultipliers[k], bonusRate: rates[k] || 0, allocated: run.allocated[k] * D.balance.pointValues[k] };
    return result;
  }
  function statsFor(run, withDebuffs = true) {
    const stats = {}, detail = statBreakdown(run);
    for (const [k, d] of Object.entries(detail)) {const growth=LevelProgression.growth(run.level,k)*d.classGrowthMultiplier;stats[k]=(d.base+growth*(1+d.bonusRate)+d.allocated)*(1+d.finalRate);}
    if (withDebuffs) for (const id of run.debuffIds) { const d = D.debuffs.find(d => d.id === id); stats[d.stat] *= d.factor; }
    for(const key of Object.keys(stats))stats[key]*=Exploration.statFactor(run,key);return stats;
  }
  function moveScale(level) { const knots=D.adventure.balance50.mastery;for(let i=1;i<knots.length;i++){const [a,x]=knots[i-1],[b,y]=knots[i];if(level<=b)return x+(Math.max(a,level)-a)/(b-a)*(y-x);}let value=knots.at(-1)[1],start=50;for(const [through,rate]of D.balance.post50Mastery){const end=Math.min(level,through);value+=Math.max(0,end-start)*rate;start=through;if(level<=through)break;}return value; }
  function expMultiplier(gap) {
    const table = D.balance.expGap; if (gap <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) if (gap <= table[i][0]) { const [a, av] = table[i - 1], [b, bv] = table[i]; return av + (bv - av) * (gap - a) / (b - a); }
    return table.at(-1)[1];
  }
  const levelCost = LevelProgression.cost;
  function targetLevelsFor(enemyLevel,role='normal'){const knots=D.balance.expPacing.levelKnots;let value=knots[0][1];for(let i=1;i<knots.length;i++){const [a,av]=knots[i-1],[b,bv]=knots[i];if(enemyLevel<=b){value=av+(Math.max(a,enemyLevel)-a)/(b-a)*(bv-av);break;}value=bv;}return value*(D.balance.expPacing.roleMultipliers[role]||1);}
  function expForLevels(level,levels){let exp=0,whole=Math.floor(levels),current=level;for(let i=0;i<whole;i++,current++)exp+=90+(Math.min(D.adventure.maxLevel-1,current)-1)*30;exp+=(levels-whole)*(90+(Math.min(D.adventure.maxLevel-1,current)-1)*30);return exp;}
  function grantExp(run, enemyLevel, enemyType, encounter={}) {
    const beforeLevel=run.level,beforeStats=statsFor(run);
    const actor={stats:statsFor(run),statuses:{},hp:1,mana:1,stamina:1};const runtime=new R.Runtime({time:0,run,player:actor,log(){}},actor,run.build.talents.map(id=>D.skills[id]));
    const expFactor=runtime.modify('exp',1);
    const opening=!run.dungeon&&run.level<D.balance.openingExp.through&&enemyType?.startsWith('greywind_'),gap=expMultiplier(enemyLevel-run.level),profile=enemyProfile(enemyType,{...encounter,overworld:!run.dungeon,dungeonId:run.dungeon?.id});
    const pacing=D.balance.expPacing,referenceLevel=Math.min(D.adventure.maxLevel-1,Math.max(1,enemyLevel));
    const targetLevels=targetLevelsFor(enemyLevel,profile.role)*profile.species.exp;
    const earlyExp=(D.balance.expBase+enemyLevel*D.balance.expPerLevel)*pacing.earlyExpMultiplier*profile.species.exp*profile.tuning.exp;
    const lateExp=expForLevels(referenceLevel,targetLevels),blend=Math.max(0,Math.min(1,(enemyLevel-pacing.legacyThrough)/(pacing.surgeFrom-pacing.legacyThrough)));
    const baseExp=earlyExp+(lateExp-earlyExp)*blend;
    const luckBonus=Math.min(D.balance.expLuckCap,statsFor(run).luck*D.balance.expPerLuck);
    const inStarter=run.starter&&run.currentMapId===run.starter.mapId,cap=inStarter?Maps.starterConfig.levelCap:D.adventure.maxLevel;
    const target=run.training&&encounter.trainingTargetLevel;
    const amount = run.level>=cap?0:target?Math.max(0,Math.round(expForLevels(run.level,Math.max(0,target-run.level))-run.exp)):Math.round(baseExp*expFactor*gap*(inStarter?Maps.starterConfig.expMultiplier:opening?pacing.openingMultiplier:1)*(1+luckBonus));
    runtime.emit('OnEXPReceived',{amount}); run.level=Math.min(D.adventure.maxLevel,Math.max(1,run.level));run.exp += amount; let levels = 0;
    while (run.level<cap&&run.exp >= levelCost(run.level)) { run.exp -= levelCost(run.level); run.level++; levels++; runtime.emit('OnLevelUp',{level:run.level}); }
    if(inStarter&&run.level>=cap)run.exp=0;Maps.syncStarter(run);
    const capped=run.level>=D.adventure.maxLevel;if(capped)run.exp=0;
    const afterStats=statsFor(run);if(run.dungeonResources)for(const k of ['hp','mana','stamina'])run.dungeonResources[k]=Math.min(afterStats[k],run.dungeonResources[k]+afterStats[k]-beforeStats[k]);
    run.points=0;return { amount, levels, beforeLevel, afterLevel:run.level, beforeStats, afterStats, ...(capped?{capped:true,maxLevel:D.adventure.maxLevel}:{}) };
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
  function starterReward(permanent,run,enemy,rng=Math.random){if(!run.starter||run.starter.phase!=='cleared'||enemy.id!==run.starter.bossId||run.starter.rewardProcessed)return [];run.starter.rewardProcessed=true;const reward=Meta.claimStarter(permanent,rng);if(!reward)return [];if(reward.kind==='marks'){recordLoot(run,reward);return [reward];}return grantRewards(permanent,run,[reward]);}
  function dungeonReward(permanent,run,rng=Math.random,options={}){
    if(!run.dungeon)throw Error('不在地下城');const d=D.findDungeon(run.dungeon.id);
    if(run.dungeon.stage!==d.enemyWaves.length-1)throw Error('尚未完成所有波次');
    if(run.dungeon.rewardClaimed)return [];
    if(d.training){run.dungeon.rewardClaimed=true;run.training.stage=7;Maps.syncStarter(run);return [];}
    const draw=Rewards.dungeon(d.id,rng,{...options,level:run.level,permanent,preferUnowned:D.maps[d.mapId]?.sortOrder===0}),rewards=grantRewards(permanent,run,draw.rewards);run.dungeon.rewardClaimed=true;run.dungeon.rewardCombination=draw.combination;permanent.completions++;permanent.dungeonCompletions||={};permanent.dungeonCompletions[d.id]=(permanent.dungeonCompletions[d.id]||0)+1;return rewards;
  }
  function enemyProfile(type,options={}){
    const m=D.monsters[type]||{},cfg=D.enemyBalance;
    const role=options.role==='boss'||m.boss||type==='boss'?(m.id?.startsWith('terminal_structure')||m.id?.startsWith('element_abyss')?'importantBoss':'boss'):options.role==='elite'||options.elite||m.elite?'elite':options.role==='strong'?'strong':options.overworld===false?'dungeon':'normal';
    const species=cfg.species[m.sprite||type]||cfg.species.default;
    return {role,species,tuning:role==='boss'&&(options.dungeonId==='abandoned_mine'||type==='opening_mine_boss_3')?cfg.firstBoss:cfg.roles[role]};
  }
  function enemyDefinition(type,level,options={}){
    const source=D.monsters[type];if(!source)throw Error('未知敵人');const cfg=D.enemyBalance,{role,species,tuning}=enemyProfile(type,options);
    const interpolate=values=>{let i=cfg.levels.findIndex(x=>x>=level);if(i===0)return values[0];if(i<0)i=cfg.levels.length-1;const a=cfg.levels[i-1],b=cfg.levels[i];return values[i-1]+(level-a)/(b-a)*(values[i]-values[i-1]);};
    const starterBoss=type.startsWith('starter_');
    level=Math.min(D.adventure.maxLevel,level);
    const attackPower=interpolate(cfg.attack)*species.damage*(source.training?.35:starterBoss?Maps.starterConfig.bossDamageMultiplier:tuning.damage);
    const damaging=source.moves.map(id=>D.moves[id]).filter(m=>m&&m.multiplier>0),all=source.moves.map(id=>D.moves[id]).filter(Boolean);
    const averageMultiplier=damaging.reduce((n,m)=>n+m.multiplier,0)/Math.max(1,damaging.length);
    const averageCast=all.reduce((n,m)=>n+m.attackTime,0)/Math.max(1,all.length);
    return {...source,level,originLevel:arguments[1],balanceRole:role,attackPower,averageMultiplier:averageMultiplier||1,averageCast:averageCast||100,castCycle:source.training?6:cfg.castSeconds*species.cycle,
      stats:{...source.stats,hp:source.training?source.trainingHP:Math.round(interpolate(cfg.hp)*species.hp*(starterBoss?Maps.starterConfig.bossHpMultiplier:tuning.hp)),stamina:Math.max(120,attackPower*4),mana:Math.max(120,attackPower*4),agility:10+Math.min(30,(level-1)*.15),luck:Math.min(15,1+(level-1)*.07)},
      physicalDefense:cfg.defenseBase+(level-1)*cfg.defensePerLevel+(source.physicalDefenseBonus||0),magicResistance:cfg.defenseBase+(level-1)*cfg.defensePerLevel+(source.magicResistanceBonus||0)};
  }
  const gradeCache=new Map();
  function enemyGrade(type,level,options={}){
    const key=JSON.stringify([type,level,options.role,options.elite,options.overworld,options.dungeonId]);if(gradeCache.has(key))return gradeCache.get(key);
    const e=enemyDefinition(type,level,options),cfg=D.enemyBalance;
    const control=e.moves.some(id=>D.moves[id]?.effects?.some(f=>['interrupt','freeze'].includes(f.type)))?1.08:1;
    const threat=Math.sqrt(e.stats.hp*(1+(e.physicalDefense+e.magicResistance)/200)*e.attackPower/e.castCycle)*control;
    let index=0;
    for(const [i,n]of LevelProgression.anchors.entries()){
      const basic=enemyDefinition('goblin',n,{role:'normal',overworld:true});
      const reference=Math.sqrt(basic.stats.hp*(1+(basic.physicalDefense+basic.magicResistance)/200)*basic.attackPower/basic.castCycle);
      if(threat>=reference*.92)index=i;
    }
    const result={index,rank:D.runRating.ranks[index],level:e.level,threat};gradeCache.set(key,result);return result;
  }
  const mapGradeCache=new Map();
  function mapGrades(map){if(mapGradeCache.has(map.id))return mapGradeCache.get(map.id);const grades=(map.spawnPoints||[]).map((p,i)=>{const pool=p.elite?map.elitePoolIds:map.enemyPoolIds;return enemyGrade(pool[i%pool.length],p.level,{...p,overworld:true}).index;});if(!grades.length)grades.push(0);const low=D.runRating.ranks[Math.min(...grades)],high=D.runRating.ranks[Math.max(...grades)],result={low,high,caption:low===high?low:low+'～'+high};mapGradeCache.set(map.id,result);return result;}
  function dungeonGrade(d,run=null){const waves=run?Exploration.waves(run,d.id):d.enemyWaves;return waves.map(w=>enemyGrade(w.type,w.level,{...w,overworld:false,dungeonId:d.id})).sort((a,b)=>b.index-a.index)[0]?.rank||'D';}
  function battleFor(run, encounter, rng = Math.random) {
    const effects = {}; for (const id of Object.values(run.build.equipment)) if (id) for (const key of ['physicalMultiplier', 'physicalAttackTime', 'onDodgeShorten']) if (D.equipment[id][key]) effects[key] = D.equipment[id][key];
    const b = new C.Battle({ rng, extraSources:Exploration.sources(run), classTrait:Classes.active(run).innateTrait, balance50:true, levelGap:LevelProgression.referenceLevel(enemyDefinition(encounter.type,encounter.level,{...encounter,overworld:!run.dungeon,dungeonId:run.dungeon?.id}).level)-LevelProgression.referenceLevel(run.level), preserveResources:!!run.dungeon, stats: statsFor(run, false), build: run.build, moveLevels: run.moveLevels, moveScale, enemy: enemyDefinition(encounter.type, encounter.level,{...encounter,overworld:!run.dungeon,dungeonId:run.dungeon?.id}), equipmentEffects: effects, rules: {
      dodgeChance: stats => Math.min(D.balance.dodgeCap, stats.agility * D.balance.dodgePerAgility),
      critChance: stats => Math.min(D.balance.critCap, D.balance.critBase + stats.luck * D.balance.critPerLuck),
      critMultiplier: stats => D.balance.critDamageBase + stats.luck * D.balance.critDamagePerLuck
    } });
    if(run.training&&['tutorial-first','tutorial-caster'].includes(encounter.id)){b.rules.critChance=0;b.rules.dodgeChance=0;}
    b.run.deaths = run.deaths; b.run.debuffIds = [...run.debuffIds]; b.start(); b.charge=normalizeUltimateCharge(run);if(run.dungeon&&run.dungeonResources)for(const k of ['hp','mana','stamina'])b.player[k]=Math.max(0,Math.min(b.player.stats[k],run.dungeonResources[k]));return b;
  }
  function dungeonEncounter(run){const d=D.findDungeon(run.dungeon?.id),wave=d?Exploration.waves(run,d.id)[run.dungeon.stage]:null;if(!wave)throw Error('地下城波次不存在');return {...wave,level:wave.level};}
  const api = { statsBeforeRollback, migratePermanent, migrateRun, legacyStatsFor, ensureWorldContent, recordLoot, ultimateChargeCost, normalizeUltimateCharge, carryBattleCharge, freshProgress, loadProgress, saveProgress, defaultBuild, validateBuild, createRun, regionAt, regionDepth, regionLevel, statBreakdown, statsFor, moveScale, expMultiplier, levelCost, targetLevelsFor, expForLevels, grantExp, allocate, acquireMove, learnSkill, receiveAbility, resolveAcquisition, understandBook, grantRewards, starterReward, dungeonReward, enemyProfile, enemyDefinition, enemyGrade, mapGrades, dungeonGrade, battleFor, dungeonEncounter };
  if (typeof module !== 'undefined') module.exports = api; else root.Progression = api;
})(globalThis);
