const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),P=require('./progression'),D=require('./data'),L=require('./level-progression'),E=require('./encounters'),Maps=require('./world-maps'),Routes=require('./map-routes'),Save=require('./run-save'),Up=require('./level-up'),B=require('./benchmark-rank500.cjs');
const fresh=()=>P.createRun(P.freshProgress());
test('500-row table is finite, continuous and automatically increases all five stats',()=>{
 assert.equal(L.table.length,500);assert.equal(D.adventure.maxLevel,500);assert.equal(L.table.at(-1).expToNext,null);
 const run=fresh();let old=P.statsFor(run);
 for(let n=2;n<=500;n++){run.level=n;const current=P.statsFor(run);for(const key of Object.keys(old)){assert.ok(current[key]>old[key],key+n);assert.ok(Number.isFinite(current[key]));}old=current;}
 assert.deepEqual(P.statsFor(fresh()),{hp:150,stamina:59,mana:40,agility:25,luck:5});
 const last=fresh();last.level=499;P.grantExp(last,500,'goblin');assert.equal(last.level,500);assert.equal(last.exp,0);assert.equal(P.allocate(last,'hp'),false);
});
test('all 16 named grades retain direct challenges, no point overflow or promotion stat grant',()=>{
 assert.deepEqual(D.runRating.ranks,['D','C−','C','C＋','B−','B','B＋','A−','A','A＋','S−','S','S＋','SS−','SS','SS＋']);
 const run=fresh(),p=P.freshProgress();
 for(let i=0;i<15;i++){const c=D.rankPromotions[i].challenge,stats=P.statsFor(run);for(let n=0;n<c.kills;n++)E.victory(p,run,{type:'goblin',level:c.enemyLevel});assert.equal(E.rankView(run).index,i+1);assert.deepEqual(P.statsFor(run),stats);assert.equal(run.adventurerRank.progress,0);}
 assert.equal(E.rankView(run).nextRank,null);
});
test('task gate keeps later growth independent; triggering kill is not replayed',()=>{
 const run=fresh(),p=P.freshProgress();for(let i=0;i<17;i++)E.victory(p,run,{type:'goblin',level:1});assert.equal(E.rankView(run).active,true);assert.equal(E.rankView(run).normal[0].value,0);
 run.level=20;const stats=P.statsFor(run);P.grantExp(run,30,'goblin');E.advanceRank(run);assert.ok(run.level>20);assert.equal(run.adventurerRank.index,0);assert.equal(run.adventurerRank.progress,50);assert.ok(P.statsFor(run).hp>stats.hp);
 for(let i=0;i<3;i++)E.victory(p,run,{type:'goblin',level:10},true);assert.equal(E.rankView(run).rank,'C−');assert.equal(run.adventurerRank.progress,0);
});
test('new starter D advances unconditionally to C− after actual guardian victory',()=>{
 const run=fresh(),p=P.freshProgress();Maps.startStarter(run,()=>0);assert.equal(E.rankView(run).rank,'D');run.level=9;Maps.syncStarter(run);const boss=run.world.enemies.find(e=>e.id===run.starter.bossId),before=P.statsFor(run);E.victory(p,run,boss);assert.equal(E.rankView(run).rank,'C−');assert.deepEqual(P.statsFor(run),before);assert.equal(run.starter.phase,'cleared');assert.equal(run.world.enemies.filter(e=>e.mapId===run.starter.mapId).length,0);
});
test('all prior spawn positions, IDs, counts, safety zones and 180px road clearance stay intact',()=>{
 const before=JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname,'fixtures/rank500-spawns.json'),'utf8'));
 for(const map of D.mapData){const original=before.maps.find(m=>m.id===map.id).points;assert.equal(map.spawnPoints.length,original.length);for(const [i,p]of map.spawnPoints.entries()){assert.equal(p.x,original[i].x);assert.equal(p.y,original[i].y);assert.equal(p.habitat,original[i].habitat);assert.ok(Routes.roadDistance(p,map.route.roads)>=180);}
 const normal=map.spawnPoints.filter(p=>!p.elite),top=Math.max(...normal.map(p=>p.level)),share=normal.filter(p=>p.level===top).length/normal.length;assert.ok(share<.15,map.id);assert.ok(new Set(normal.map(p=>p.level)).size>=10);}
});
test('999 save migration preserves collection, named rank, state, fractional EXP and live combat resources',()=>{
 const p=P.freshProgress(),run=P.createRun(p);run.level=850;run.exp=12780;run.enemyLevelCurveVersion=1;run.adventurerRank={version:1,index:13,progress:71,last:{kills:0,dungeons:0,level:850},normalKills:2,challengeKills:1,history:[]};run.world.enemies[0].defeatedUntil=123;
 const encounter={type:'goblin',level:850},b=P.battleFor(run,encounter);b.player.hp=b.player.stats.hp*.4;b.player.mana=b.player.stats.mana*.3;b.enemy.hp=b.enemy.stats.hp*.6;b.choose('quick');b.advance(.2);
 let raw;const storage={setItem:(k,v)=>raw=v,getItem:()=>raw};Save.save(storage,{scene:'battle',run,permanent:p,build:run.build,encounter,battle:b});const previous=JSON.parse(raw);previous.battle.player.stats=P.legacyStatsFor(run);previous.battle.player.hp=previous.battle.player.stats.hp*.4;previous.battle.player.mana=previous.battle.player.stats.mana*.3;raw=JSON.stringify(previous);
 const load=Save.load(storage);assert.equal(load.warning,undefined);const s=load.snapshot;assert.equal(s.run.level,427);assert.equal(E.rankView(s.run).rank,'S');assert.equal(s.run.adventurerRank.progress,71);assert.equal(s.run.adventurerRank.normalKills,2);assert.equal(s.run.world.enemies[0].defeatedUntil,123);assert.deepEqual(s.permanent,p);assert.ok(Math.abs(s.battle.player.hp/s.battle.player.stats.hp-.4)<1e-9);assert.ok(Math.abs(s.battle.player.mana/s.battle.player.stats.mana-.3)<1e-9);assert.ok(s.battle.player.cast);assert.equal(s.run.enemyLevelCurveVersion,2);const once=JSON.stringify(s.run);P.ensureWorldContent(s.run);assert.equal(JSON.stringify(s.run),once);
});
test('early/mid/late reasonable same-level builds survive; two-grade leap is meaningfully harder',()=>{
 for(const level of [10,120,400]){const index=L.gradeIndex(level);let sameWins=0,aboveWins=0;for(const build of B.builds)for(const seed of [1,17,73]){const same=B.fight(level,'goblin',level,build,seed),above=B.fight(level,'goblin',L.anchors[index+2],build,seed);sameWins+=same.won;aboveWins+=above.won;assert.ok(same.seconds>=4&&same.seconds<=30);assert.ok(Number.isFinite(same.dps));}assert.ok(sameWins>=10);assert.ok(aboveWins<sameWins);}
 const plain=P.enemyGrade('goblin',120),boss=P.enemyGrade('boss',120,{role:'boss'});assert.ok(boss.index>=plain.index);assert.ok(boss.threat>plain.threat);
});
test('ability celebration retains racing/flashing and shows actual stat gains with no numeric Lv',()=>{
 const r=fresh(),exp=P.grantExp(r,10,'goblin');const html=Up.html(exp);assert.match(html,/能力提升/);assert.match(html,/racing/);assert.match(html,/growth-burst/);assert.doesNotMatch(html,/Lv\.|LEVEL/);for(const k of ['hp','mana','stamina','agility','luck'])assert.match(html,new RegExp('growth-'+k+'-gain'));
});

test('migration keeps stable dungeon variants, queue types, cooldowns and achievement reward ownership',()=>{
 const run=fresh();run.level=850;run.enemyLevelCurveVersion=1;
 run.exploration.dungeons.abandoned_mine=[{type:'goblin',level:850,role:'normal'},{type:'wolf',level:999,role:'elite'}];
 run.fieldEncounterQueue=[{type:'slime',level:700}];run.quickBattle={enemies:[{type:'slime',level:600}],remaining:.4};
 P.migrateRun(run);assert.deepEqual(run.exploration.dungeons.abandoned_mine,[{type:'goblin',level:L.from999(850),role:'normal'},{type:'wolf',level:500,role:'elite'}]);
 assert.equal(run.fieldEncounterQueue[0].level,L.from999(700));assert.equal(run.quickBattle.enemies[0].level,L.from999(600));assert.equal(run.quickBattle.remaining,.4);
 const p=P.freshProgress();delete p.rankDisplayVersion;p.completedAchievementIds=['ACH_JOURNEY_RANK_0','ACH_JOURNEY_RANK_2'];p.achievementProgress={journey_rank:13,warrior_kills:45};const moves=JSON.stringify(p.moves);
 P.migratePermanent(p);assert.equal(p.achievementProgress.journey_rank,11);assert.equal(p.achievementProgress.warrior_kills,45);assert.ok(p.completedAchievementIds.includes('ACH_JOURNEY_RANK_1'));assert.equal(JSON.stringify(p.moves),moves);
 const once=JSON.stringify(p);P.migratePermanent(p);assert.equal(JSON.stringify(p),once);
});

test('empty tutorial map has a valid grade and scaled battle costs match move descriptions',()=>{
 assert.equal(P.mapGrades(D.maps.tutorial_court).caption,'D');const run=fresh();run.level=400;const b=P.battleFor(run,{type:'goblin',level:400}),move=b.preview('quick');
 assert.ok(move.cost.stamina>D.moves.quick.cost.stamina);assert.ok(move.description.includes(String(move.cost.stamina)+' SP'));
});
