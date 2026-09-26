const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),P=require('./progression'),E=require('./encounters'),A=require('./achievements'),Save=require('./run-save');
const fixture=()=>{const p=P.freshProgress();return {p,run:P.createRun(p)};};
function kill(f,level=1,quick=false){E.victory(f.p,f.run,{type:'greywind_0',level},quick);}
test('一般路線：滿分才出任務，門檻事件不算新任務，溢出與任務期間分數全部丟棄',()=>{
 const f=fixture();assert.equal(E.rankView(f.run).normal.length,0);
 for(let i=0;i<16;i++)kill(f);assert.equal(E.rankView(f.run).progress,48);
 kill(f);let v=E.rankView(f.run);assert.equal(v.progress,50);assert.equal(v.index,0);assert.equal(v.normal[0].value,0);
 kill(f);kill(f);assert.equal(E.rankView(f.run).progress,50);kill(f);v=E.rankView(f.run);assert.equal(v.index,1);assert.equal(v.progress,0);assert.equal(v.active,false);assert.equal(v.normal.length,0);assert.equal(f.run.battleStats.kills,20);
});
test('直接挑戰不用滿分，不需要一般任務；每次只升一階、擊殺不重用',()=>{
 const f=fixture();kill(f,3);assert.equal(E.rankView(f.run).challenge.value,1);kill(f,3);
 let v=E.rankView(f.run);assert.equal(v.index,1);assert.equal(v.progress,0);assert.equal(v.challenge.value,0);assert.equal(f.run.adventurerRank.history[0].route,'challenge');
 kill(f,75);assert.equal(E.rankView(f.run).index,1);kill(f,75);assert.equal(E.rankView(f.run).index,2);
});
test('壓制可累積分數與一般討伐，但不能完成直接挑戰；敗北不加進度',()=>{
 const f=fixture();kill(f,75,true);kill(f,75,true);assert.equal(E.rankView(f.run).index,0);assert.equal(E.rankView(f.run).challenge.value,0);
 const before=JSON.stringify(f.run.adventurerRank);E.loss(f.p,f.run,{type:'greywind_0'},{enemy:{hp:5,stats:{hp:10}}});assert.equal(JSON.stringify(f.run.adventurerRank),before);
});
test('大筆分數只填滿當階，地下城重複通關不加分；中高階條件可追認',()=>{
 const f=fixture();f.run.level=30;E.clear(f.p,f.run,'abandoned_mine');assert.equal(E.rankView(f.run).progress,50);assert.equal(E.rankView(f.run).index,0);
 f.run.adventurerRank.index=6;f.run.adventurerRank.progress=110;const v=E.rankView(f.run);assert.equal(v.normal.length,3);assert.ok(v.normal[1].value>=v.normal[1].target);assert.ok(v.normal[2].value>=v.normal[2].target);
 f.run.adventurerRank.progress=0;E.clear(f.p,f.run,'abandoned_mine');assert.equal(E.rankView(f.run).progress,0);
});
test('所有17階可透過固定挑戰完成，最高階穩定，新局歸零',()=>{
 const f=fixture();for(let i=0;i<17;i++){const c=D.rankPromotions[i].challenge;for(let n=0;n<c.kills;n++)kill(f,c.enemyLevel);assert.equal(E.rankView(f.run).index,i+1);assert.equal(E.rankView(f.run).progress,0);}
 kill(f,100);assert.equal(E.rankView(f.run).rank,'SS＋');assert.equal(E.rankView(f.run).nextRank,null);assert.equal(E.rankView(P.createRun(f.p)).rank,'D−');
});
test('存檔保留晉階任務進度，重整不發生額外晉階；舊檔保留舊評級',()=>{
 const f=fixture();for(let i=0;i<18;i++)kill(f);let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};Save.save(storage,{scene:'explore',run:f.run,permanent:f.p,build:f.run.build});const loaded=Save.load(storage).snapshot;
 assert.deepEqual(E.rankView(loaded.run),E.rankView(f.run));assert.equal(E.rankView(loaded.run).normal[0].value,1);
 delete loaded.run.adventurerRank;loaded.run.level=27;loaded.run.battleStats.kills=73;loaded.run.battleStats.clearedDungeonIds=['abandoned_mine','old_lab'];const old=E.rankView(loaded.run);assert.equal(old.rank,'B＋');assert.equal(old.progress,0);assert.equal(loaded.run.level,27);
});
test('結算與任務獎勵採實際階級，不按累計戰績直接跳階',()=>{
 const f=fixture();f.run.level=100;f.run.battleStats.kills=999;f.run.battleStats.clearedDungeonIds=D.dungeons.map(d=>d.id);E.advanceRank(f.run);assert.equal(E.summary(f.run).rating.rank,'D−');f.run.status='failed';const s=A.settleJourney(f.p,f.run);assert.ok(!s.receipts.some(r=>r.id==='ACH_JOURNEY_RANK_3'));assert.ok(!s.receipts.some(r=>r.id==='RUN_RANK_3'));
});
