const test=require('node:test'),assert=require('node:assert/strict'),L=require('./level-up');
const exp={beforeLevel:120,afterLevel:145,levels:25,maxLevel:999,beforeStats:{hp:100,mana:40,stamina:45,agility:22,luck:5},afterStats:{hp:400,mana:140,stamina:155,agility:52,luck:20}};

test('升級畫面同時顯示會跳動的等級、能力值與增加量',()=>{
 const html=L.html(exp);
 assert.match(html,/id="growth-level-gain">0/);
 for(const key of Object.keys(exp.beforeStats))assert.match(html,new RegExp(`id="growth-${key}-gain">0`));
});

test('數字由零與原始值狂飆，最後精準停在實際結果',()=>{
 const nodes=new Map(),classes=new Set(['racing']);
 const ids=['growth-level-number','growth-level-gain',...Object.keys(exp.beforeStats).flatMap(k=>[`growth-${k}`,`growth-${k}-gain`])];
 for(const id of ids)nodes.set(id,{textContent:''});
 nodes.set('growth-celebration',{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}});
 const old=global.document;global.document={getElementById:id=>nodes.get(id)||null};
 try{
  L.update(exp,.85,false);
  assert.ok(Number(nodes.get('growth-level-number').textContent)>exp.beforeStats.hp);
  assert.ok(Number(nodes.get('growth-level-gain').textContent)>0);
  assert.ok(Number(nodes.get('growth-hp-gain').textContent)>0);
  assert.ok(classes.has('racing'));
  L.update(exp,L.DURATION+1,false);
  assert.equal(nodes.get('growth-level-number').textContent,'400');
  assert.equal(nodes.get('growth-level-gain').textContent,'300');
  assert.equal(nodes.get('growth-hp').textContent,'400');
  assert.equal(nodes.get('growth-hp-gain').textContent,'300');
  assert.ok(classes.has('landed'));assert.ok(!classes.has('racing'));
 }finally{global.document=old;}
});
