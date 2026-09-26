const test=require('node:test'),assert=require('node:assert/strict');
const A=require('./achievements'),P=require('./progression'),D=require('./data');
function fixture(){const p=P.freshProgress(),run=P.createRun(p);run.adventurerRank.index=17;run.status='failed';run.level=100;run.battleStats.kills=300;run.battleStats.clearedDungeonIds=D.dungeons.slice(0,8).map(d=>d.id);return {p,run};}
test('全部評級與任務自動發獎、能力有效且不繞過職業限制',()=>{
 const {p,run}=fixture(),s=A.settleJourney(p,run);assert.equal(s.receipts.length,29);assert.equal(p.meta.marks,s.total);
 for(const d of A.journeyAchievements)if(d.ability){const [kind,id]=d.ability;assert.ok(D[kind][id]);assert.notEqual(D[kind][id].contentScope,'classExclusive');assert.ok(kind==='moves'?p.moves[id]:p.skills.includes(id));}
 assert.equal(p.unlockedClassExclusiveMoveIds.length,0);assert.equal(p.unlockedClassExclusiveSkillIds.length,0);
});
test('同局結算及存檔重載不重複發獎；新局只重複任務',()=>{
 const {p,run}=fixture(),first=A.settleJourney(p,run),balance=p.meta.marks;assert.equal(A.settleJourney(p,run),first);assert.equal(p.meta.marks,balance);
 const saved=new Map(),store={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};P.saveProgress(store,p);const loaded=P.loadProgress(store).progress;
 A.settleJourney(loaded,JSON.parse(JSON.stringify(run)));assert.equal(loaded.meta.marks,balance);
 const next=fixture().run,result=A.settleJourney(loaded,next);assert.equal(result.receipts.length,A.journeyTasks.length);assert.ok(result.receipts.every(r=>r.kind==='task'));assert.equal(loaded.meta.marks,balance+result.total);
});
test('已擁有能力折換25徽記，不升級；冒險尚未結束不發獎',()=>{
 const {p,run}=fixture();p.moves.spark=3;run.status='active';assert.equal(A.settleJourney(p,run),null);run.status='failed';const s=A.settleJourney(p,run),r=s.receipts.find(r=>r.ability?.id==='spark');assert.equal(r.duplicate,true);assert.equal(r.marks,A.journeyAchievements.find(d=>d.id===r.id).marks+25);assert.equal(p.moves.spark,3);
});
test('空白新局只有首次結算成就，任務進度不跨局累計',()=>{
 const p=P.freshProgress(),run=P.createRun(p);run.status='failed';const s=A.settleJourney(p,run);assert.equal(s.receipts.length,1);assert.equal(s.total,10);const next=P.createRun(p);next.status='failed';assert.equal(A.settleJourney(p,next).total,0);
});
