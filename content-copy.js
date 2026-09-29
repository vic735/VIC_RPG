/* Player-facing names and descriptions. IDs and combat values remain unchanged. */
(function(root){
 const elementName={metal:'金',wood:'木',water:'水',fire:'火',earth:'土',light:'光',dark:'闇'};
 const className={WARRIOR:'戰士',MAGE:'魔法師',RANGER:'遊俠',CLERIC:'聖職者',SPELLSWORD:'魔劍士'};
 const unique=o=>[...new Set(Object.values(o||{}))];
 const pct=n=>Math.round(Math.abs(n)*100);
 const skillNames={vigor:'強健體魄',control:'魔力調律',agility:'輕身步法',lucky:'命運眷顧'};
 const moveNames={lesser_heal:'初階治癒術'};
 const subtitles={flame_enchant:'火焰附魔',std_metal_greater_orb:'雷霆巨球',std_wood_greater_orb:'森靈巨球',std_water_greater_orb:'冰海巨球',std_fire_greater_orb:'獄炎巨球',std_earth_greater_orb:'山嶽巨球',std_light_greater_orb:'輝耀巨球',std_dark_greater_orb:'幽冥巨球'};
 const flavor={
  quick:'以俐落的劍路搶先出手',heavy:'凝聚全身力道揮出沉重一擊',interrupt:'以震盪力道破壞敵人的架勢',spark:'喚下疾雷貫穿敵人',nova:'引爆殘留在戰場上的星光',inferno:'將壓縮烈焰在命中瞬間引爆',
  double_slash:'快速交錯劍鋒，連續斬擊兩次',heavy_slash:'蓄勢後揮出足以破甲的重斬',break_stance:'瞄準架勢弱點發動破勢一擊',mana_bolt:'將純粹魔力壓縮成飛彈',pure_mana_cannon:'將大量純粹魔力匯聚成貫穿砲擊',
  WARRIOR_MOVE_001:'以破軍之勢劈出威力與中斷力兼具的重斬',WARRIOR_MOVE_002:'將土之力灌入劍鋒，震裂腳下大地',WARRIOR_MOVE_003:'化作一道劍光瞬間斬過敵人',
  MAGE_MOVE_001:'凝聚高密度魔力轟擊敵人',MAGE_MOVE_002:'瞬間釋放魔力，在近距離引發爆裂',MAGE_MOVE_003:'交織水火術式，掀起失控的元素洪流',
  RANGER_MOVE_001:'鎖定要害，射出貫穿力極強的一箭',RANGER_MOVE_002:'借風勢在短時間內連續放箭',RANGER_MOVE_003:'捕捉敵人出手的瞬間，以箭矢截斷攻勢',
  CLERIC_MOVE_002:'以聖光洗滌敵人，造成光屬性魔法傷害',SPELLSWORD_MOVE_001:'以魔力包覆劍刃，斬擊敵人',SPELLSWORD_MOVE_003:'同時引爆劍氣與魔力，造成猛烈衝擊'
 };
 function costText(move){const parts=[];if(move.cost?.stamina)parts.push(move.cost.stamina+' SP');if(move.cost?.mana)parts.push(move.cost.mana+' MP');return parts.length?parts.join(' + '):'無';}
 function statusText(status){
  if(!status)return'';const bits=[];
  if(status.tick?.ratio)bits.push(`每 ${status.tick.interval||1} 秒造成最大 ${status.tick.stat==='mana'?'MP':'HP'} ${pct(status.tick.ratio)}% 的持續傷害`);
  for(const m of status.modifiers||[]){const v=m.value,delta=(v>=1?pct(v-1):pct(1-v));if(m.stage==='agility')bits.push(`敏捷${v>=1?'提高':'降低'} ${delta}%`);else if(m.stage==='incoming')bits.push(`受到的傷害降低 ${delta}%`);else if(m.stage==='accuracy')bits.push(`命中率降低 ${delta}%`);else if(m.stage==='dodgeChance')bits.push(`閃避率提高 ${pct(v)} 個百分點`);else if(m.stage==='critChance')bits.push(`爆擊率提高 ${pct(v)} 個百分點`);else if(m.stage==='damage')bits.push(`${m.conditions?.element?elementName[m.conditions.element]+'屬性':m.conditions?.damageType==='physical'?'物理':''}傷害提高 ${delta}%`);else if(m.stage==='healing')bits.push(`治療量提高 ${delta}%`);}
  return `${status.target==='self'?'自身獲得':'使敵人陷入'}「${status.name}」${status.duration?` ${status.duration} 秒`:''}${bits.length?`（${bits.join('、')}）`:''}`;
 }
 function effectText(effect){if(effect.type==='interrupt')return `中斷敵人讀條${effect.chance&&effect.chance<1?`（成功率 ${pct(effect.chance)}%）`:''}`;if(effect.type==='heal')return `恢復最大 HP 的 ${pct(effect.ratio)}%`;if(effect.type==='shield')return `獲得相當於最大 HP ${pct(effect.ratio)}% 的護盾`;if(effect.type==='restore')return `恢復 ${effect.amount||pct(effect.ratio)+'%'} ${effect.resource==='stamina'?'SP':'MP'}`;if(effect.type==='cleanse')return'移除自身全部負面狀態';if(effect.type==='status')return statusText(effect.status);return'';}
 function damageDescription(move){
  const element=(move.elements||[]).map(x=>elementName[x]).filter(Boolean).join('、');
  const damageType=move.damageType==='physical'?'物理':'魔法';
  const lead=flavor[move.id]||`對敵人施放「${move.subtitle||move.localizedName||move.name}」`;
  const hits=move.hits>1?`，分為 ${move.hits} 段獨立命中` : '';
  const effects=(move.effects||[]).map(effectText).filter(Boolean);
  return `${lead}，造成${element?element+'屬性':''}${damageType}傷害（威力倍率 ×${Number(move.multiplier||0).toFixed(2)}${hits}）。消耗：${costText(move)}；讀條值：${move.attackTime}。${effects.length?`附加效果：${effects.join('；')}。`:''}`;
 }
 function polishMove(move){
  if(moveNames[move.id])move.name=moveNames[move.id];
  if(subtitles[move.id]){move.subtitle=subtitles[move.id];move.localizedName=subtitles[move.id];}
  if((move.multiplier||0)>0)move.description=damageDescription(move);
  else move.description=String(move.description||`${move.subtitle||move.name}。`).replace(/\s*·\s*(?:WARRIOR|MAGE|RANGER|CLERIC|SPELLSWORD)\s*專屬招式/g,'').replace(/詳細數值與實際觸發效果會依招式資料顯示。?/g,'');
 }
 function polishSkill(skill){
  if(skillNames[skill.id])skill.name=skillNames[skill.id];
  let text=String(skill.description||'').replace(/^舊版/,'').replace(/原型機率/g,'成功率').replace(/\s*效果：配置後自動生效。?/g,' 裝備此技能後持續生效。').replace(/\s*觸發時機：InterruptReceived。?/g,' 每場戰鬥第一次遭到中斷時觸發。').replace(/\s*·\s*(?:WARRIOR|MAGE|RANGER|CLERIC|SPELLSWORD)\s*專屬被動/g,'');
  if(!text)text=`${className[skill.allowedClassIds?.[0]]||'冒險者'}的專精技能。`;
  skill.description=text.trim();
 }
 function apply(D){
  unique(D.moves).forEach(polishMove);unique(D.skills).forEach(polishSkill);
  for(const book of Object.values(D.books||{})){const move=D.moves[book.moveId],req=D.moves[book.requirement?.moveId];if(move&&req)book.description=`將「${req.subtitle||req.name}」永久提升至 Lv.${book.requirement.level} 後即可理解，並學會「${move.subtitle||move.name}」。`;}
  D.contentCopyVersion=1;return D;
 }
 if(typeof module!=='undefined')module.exports=apply;else root.ContentCopy=apply;
})(globalThis);
