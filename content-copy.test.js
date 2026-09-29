const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./data');require('./content-v1');require('./classes');
const unique=o=>[...new Set(Object.values(o))];
test('招式與技能不顯示開發期或規格表用語',()=>{for(const x of [...unique(D.moves),...unique(D.skills)]){assert.doesNotMatch(x.name,/舊版|測試|暫定|占位/);assert.doesNotMatch(x.description,/舊版|原型|詳細數值與實際觸發效果|WARRIOR|MAGE|RANGER|CLERIC|SPELLSWORD|專屬招式|專屬被動/,x.id);}});
test('傷害招式說明列出倍率、消耗與讀條',()=>{for(const m of unique(D.moves).filter(x=>(x.multiplier||0)>0)){assert.match(m.description,/威力倍率 ×\d+\.\d{2}/,m.id);assert.match(m.description,/消耗：/,m.id);assert.match(m.description,/讀條值：/,m.id);}});
test('早期能力與高階巨球使用正式名稱',()=>{assert.equal(D.skills.vigor.name,'強健體魄');assert.equal(D.skills.control.name,'魔力調律');assert.equal(D.moves.std_fire_greater_orb.subtitle,'獄炎巨球');});
