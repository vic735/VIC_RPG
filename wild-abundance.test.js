const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),P=require('./progression'),Maps=require('./world-maps'),Rewards=require('./world-rewards');
test('每張地圖提高野怪密度，出生安全圈仍保留',()=>{
 const counts=Maps.maps.map(m=>m.spawnPoints.length);assert.ok(Math.min(...counts)>=205,Math.min(...counts));
 for(const map of Maps.maps)assert.ok(map.spawnPoints.every(p=>Math.hypot(p.x-map.entry.x,p.y-map.entry.y)>=Maps.safeRadius));
});
test('普通野怪十五場保底，掉落後重置；快速戰鬥共用同一計數',()=>{
 const run=P.createRun(P.freshProgress()),never=()=>.999999;
 for(let i=1;i<15;i++){assert.deepEqual(Rewards.enemy('greywind_0',never,'north_plains_1',run),[]);assert.equal(run.wildRewardPity,i);}
 assert.equal(Rewards.enemy('greywind_0',never,'north_plains_1',run).length,1);assert.equal(run.wildRewardPity,0);
 const always=()=>0;assert.equal(Rewards.enemy('greywind_0',always,'north_plains_1',run).length,1);assert.equal(run.wildRewardPity,0);
});
test('提高數量不擴張野外獨占種類，地下城收藏占比仍為75%～90%',()=>{
 const c=D.contentDistribution,dm=new Set(Object.values(c.dungeonMoves).flat()),ds=new Set(Object.values(c.dungeonSkills).flat()),wm=new Set(Object.values(c.wildMoves).flat()),ws=new Set(Object.values(c.wildSkills).flat());
 const dungeon=dm.size+ds.size,total=dungeon+wm.size+ws.size;assert.ok(dungeon/total>=.75&&dungeon/total<=.9);
});
