const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data'),P=require('./progression');require('./content-v1');

const newEquipment=['hunter_cowl','ember_visor','stone_mask','scout_leathers','thunder_mail','twilight_mantle','duelist_gloves','channeler_bracers','frost_grips','mire_boots','ember_greaves','shadow_treads','ash_staff','tide_mace','starfall_staff','trail_cap','novice_circlet','phoenix_diadem','voidglass_helm','apprentice_robe','leather_bracers','focus_bands','ember_claws','storm_gauntlet','starforged_bracer','field_shoes','stone_sandals','comet_steps','abyss_walkers','yew_longbow','stormbow','iron_maul','runic_staff'];
const newBooks=['thunder_grimoire','verdant_grimoire','glacial_grimoire','inferno_grimoire','titan_grimoire','radiance_grimoire','void_grimoire'];
const rewardIds=type=>new Set(Object.values(D.rewardPools).flatMap(pool=>pool.entries.filter(entry=>entry.rewardType===type).flatMap(entry=>entry.rewardIds)));

test('四個防具部位各 10 件，武器依類型各至少 3 件',()=>{
 assert.equal(Object.keys(D.equipment).length,54);
 for(const id of newEquipment)assert.ok(D.equipment[id]?.description,id);
 for(const slot of ['head','chest','arms','feet'])assert.equal(Object.values(D.equipment).filter(item=>item.slot===slot).length,10,slot);
 for(const type of ['sword','bow','blunt','staff'])assert.ok(Object.values(D.equipment).filter(item=>item.slot==='weapon'&&item.weaponType===type).length>=3,type);
 const obtainable=rewardIds('equipment');for(const id of newEquipment)assert.ok(obtainable.has(id),id+' 必須能由地下城取得');
});

test('每個部位恰有三件容易取得裝備與兩件高稀有裝備',()=>{
 for(const slot of ['head','chest','arms','feet','weapon']){const rows=Object.values(D.equipment).filter(item=>item.slot===slot);assert.equal(rows.filter(item=>item.acquisitionTier==='easy').length,3,slot+' easy');assert.equal(rows.filter(item=>['epic','legendary'].includes(item.rarity)).length,2,slot+' high rarity');}
 for(const item of Object.values(D.equipment).filter(item=>item.acquisitionTier==='rare-only')){assert.ok(item.sourceDungeons.length>0,item.id);for(const d of D.dungeons){const entry=D.rewardPools[d.secondaryRewardPool].entries.find(e=>e.rewardType==='equipment');assert.equal(entry.rewardIds.includes(item.id),false,item.id+' 不可出現在普通裝備池');}}
});

test('新增七本高階元素魔法書，招式只由理解魔法書取得',()=>{
 assert.equal(Object.keys(D.books).length,14);
 const obtainable=rewardIds('books'),directMoves=rewardIds('moves');
 for(const id of newBooks){const book=D.books[id];assert.ok(book&&D.moves[book.moveId]&&D.moves[book.requirement.moveId],id);assert.ok(obtainable.has(id),id+' 必須能掉落');assert.equal(directMoves.has(book.moveId),false,id+' 的招式不可直接掉落');}
});

test('高階魔法書遵守擁有與永久熟練度條件',()=>{
 const p=P.freshProgress(),id='inferno_grimoire',book=D.books[id];p.books.push(id);
 assert.equal(P.understandBook(p,null,id),false);p.moves[book.requirement.moveId]=3;
 assert.equal(P.understandBook(p,null,id),true);assert.equal(p.moves[book.moveId],1);
});

test('新裝備的戰鬥效果會進入實際傷害計算',()=>{
 const p=P.freshProgress();p.equipment.push('ash_staff');p.moves.fire=1;
 const plain=P.createRun(p),equipped=P.createRun(p);equipped.build.equipment.weapon='ash_staff';
 const a=P.battleFor(plain,{type:'greywind_0',level:1},()=>.99),b=P.battleFor(equipped,{type:'greywind_0',level:1},()=>.99);
 assert.ok(b.preview('fire').estimatedDamage>a.preview('fire').estimatedDamage);
});
