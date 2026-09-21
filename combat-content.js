/* Declarative combat catalogue. Unspecified balance numbers are prototype parameters. */
(function(root){
function enrich(D){
 D.elements={metal:'金',wood:'木',water:'水',fire:'火',earth:'土',light:'光',dark:'闇'};
 D.elementEdges={metal:['wood'],wood:['water'],water:['fire'],fire:['earth'],earth:['metal'],light:['dark'],dark:['light']};
 D.magicRoots={真:['Zhen','金'],艾:['Ai','木'],雅:['Ya','水'],伯:['Bo','火'],卓:['Zhuo','土'],麗:['Li','光'],布:['Bu','闇'],帕:['Pa','小／低級'],卡:['Ka','中等'],森:['Sen','大／高級'],烏:['Wu','球'],希:['Xi','冰（水的現象）'],拉:['La','發射'],迪:['Di','箭'],尤:['You','快'],陸:['Lu','光束'],阿:['A','大／強'],可:['Ke','創造'],巴:['Ba','瞬'],法:['Fa','轉化'],德:['De','彈']};
 const status=(id,name,duration,modifiers=[],extra={})=>({type:'status',status:{id,name,duration,modifiers,...extra}});
 const mod=(stage,value,conditions={},op='multiply')=>({stage,value,conditions,op});
 const physical={damageType:'physical'}, magic={damageType:'magic'};
 const buff=(id,name,mods,duration=4)=>status(id,name,duration,mods,{target:'self',polarity:'buff'});
 const debuff=(id,name,mods,duration=4)=>status(id,name,duration,mods,{target:'enemy',polarity:'debuff'});
 const burn=status('burn','燃燒',4,[],{target:'enemy',polarity:'debuff',tick:{interval:1,ratio:.035,stat:'mana'}});
 const slow=debuff('chill','寒氣',[mod('agility',.9)]);
 const rows=[
 ['dark_beam','布帕陸拉・尤陸','暗黑光束','magic',['dark'],1.8,26,135],
 ['black_light','卡希帕陸拉・尤陸','黑光','magic',['dark','light'],1.9,28,140],
 ['hades_flare','布帕陸拉・拉亞艾尤・博拉可卡・德','暗黑冥王爆炎彈','magic',['dark','fire'],2.8,42,180,[burn]],
 ['alchemy','可利德・施乏','虛擬煉金','magic',['metal'],3.1,40,175],
 ['ice_lightning','希卡拉卡・參倫','冰凍雷光','magic',['water','metal'],1.5,25,120,[{type:'interrupt'},slow]],
 ['root_trap','德魯・西斯','樹根陷阱','spell',['wood'],.3,15,85,[{type:'interrupt'},debuff('root','束縛',[mod('agility',.8)])]],
 ['flame_bolt','博阿露巫・德','火焰彈','magic',['fire'],1.2,18,100],
 ['blast_bolt','博拉可卡・德','爆焰彈','magic',['fire'],1.8,26,130,[burn]],
 ['freeze','希卡拉卡・利雅參','冰凍魔法','spell',['water'],0,18,90,[{type:'interrupt'},slow]],
 ['dark_bolt','布帕陸拉・德','闇黑彈','magic',['dark'],1.25,18,100],
 ['haste','帕卡參・利雅參','加速魔法','spell',[],0,15,70,[buff('haste','加速',[mod('agility',1.25)],6)]],
 ['protect','倫司吧・利雅參','防護魔法','spell',[],0,18,85,[buff('guard','防護',[mod('incoming',.8)],6)]],
 ['fireball','博阿露巫・爾拉','火球術','magic',['fire'],1.4,20,110],
 ['smoke','咖佈・利雅森','煙霧魔法','spell',[],0,14,75,[debuff('smoke','煙霧',[mod('accuracy',.75)],5)]],
 ['wind_slash','帕咔申・希啊','風斬','physical',['wood'],1.1,16,85],
 ['black_flame','咔希陸拉・博阿露巫','黑色烈火','magic',['dark','fire'],1.7,26,120,[burn]],
 ['black_lightning','咔希陸拉・參倫','黑色閃電','magic',['dark','metal'],1.6,25,115,[{type:'interrupt'}]],
 ['ice_rain','希卡拉卡・希迪・利巴','冰錐箭雨','magic',['water'],1.8,27,130,[],3],
 ['instant','巴・尤陸','瞬擊','physical',[],.6,12,35],
 ['flame_enchant','博阿露巫・利雅參','火焰魔法','spell',['fire'],0,16,80,[buff('flame_enchant','火焰強化',[mod('damage',1.2,{element:'fire'})],6)]],
 ['lesser_heal','艾妮司・帕','低級治癒術','magic',['light'],0,18,90,[{type:'heal',ratio:.22}]],
 ['lightning_whip','參倫・卡阿','雷電之鞭','magic',['metal'],.9,17,90,[{type:'interrupt',chance:.8}]],
 ['light_arrow','尤陸・希迪','光之箭','magic',['light'],1.1,16,85]
 ];
 function add(row){const [id,name,subtitle,damageType,elements,multiplier,cost,attackTime,effects=[],hits=1]=row;D.moves[id]={id,name,subtitle,description:subtitle+'；數值為原型平衡設定。',kind:'normal',damageType,elements,multiplier,cost:{[damageType==='physical'?'stamina':'mana']:cost},attackTime,effects,hits,icon:elements.includes('fire')?'flame':damageType==='physical'?'sword':'orb',tags:[damageType==='physical'?'slash':'magic',...(subtitle.includes('箭')?['arrow']:[])]};}
 rows.forEach(add);
 const neutral=[['double_slash','二連斬',1.3,18,95,[],2],['heavy_slash','重斬',2.2,24,160],['break_stance','破勢',.5,16,85,[{type:'interrupt'}]],['charge_up','蓄力',0,12,60,[buff('charged','蓄力',[mod('damage',1.35,physical)],60)]],['counter_stance','反擊架勢',0,15,70,[buff('counter_guard','反擊架勢',[mod('incoming',.75)],4)]],['focus','專注',0,10,65,[buff('focus','專注',[mod('critChance',.15,{},'add')],6)]]];
 neutral.forEach(([id,name,m,c,t,e,h])=>add([id,name,name,'physical',[],m,c,t,e,h]));
 const ni=D.balance.nonElementIdentity,neutralMagic=[
  ['mana_bolt','魔力彈','純粹魔力凝成的低階飛彈',ni.moves.manaBoltRatio,ni.moves.manaBoltCost,ni.moves.manaBoltAttackTime,1,100,'old_lab'],
  ['pure_mana_cannon','純粹魔力砲','捨棄屬性與附加效果的長詠唱砲擊',ni.moves.manaCannonRatio,ni.moves.manaCannonCost,ni.moves.manaCannonAttackTime,2,190,'frozen_tower']
 ];
 neutralMagic.forEach(([id,name,subtitle,ratio,cost,time,tier,shopCost,preferredDungeon])=>{add([id,name,subtitle,'magic',[],ratio,cost,time]);Object.assign(D.moves[id],{contentId:id,shopEligible:true,shopTier:tier,shopCost,rarity:tier===1?'common':'uncommon',tags:['magic','non-element'],preferredDungeon});});
 const sets={metal:['真・德','真・迪','參倫・德','參倫・陸','真・法','真・倫司吧'],wood:['艾・德','艾・迪','德魯・卡阿','帕咔申・尤','艾・法','德魯・倫司吧'],water:['雅・德','雅・烏','希・德','希・迪','雅・法','希・倫司吧'],fire:['伯・德','伯・烏','伯・迪','伯・陸','阿・伯・德','伯・法'],earth:['卓・德','卓・烏','卓・迪','卓・倫司吧','阿・卓・德','卓・法'],light:['麗・德','麗・烏','麗・陸','麗・倫司吧','麗・法','麗・艾妮司'],dark:['布・德','布・烏','布・迪','布・陸','布・法','布・倫司吧']};
 for(const [element,names] of Object.entries(sets)) names.forEach((name,i)=>{const support=name.includes('法')||name.includes('倫司吧')||name.includes('艾妮司');const effects=support?[name.includes('艾妮司')?{type:'heal',ratio:.25}:buff(element+'_ward',D.elements[element]+'之庇護',[mod('incoming',.88)],4)]:element==='fire'?[burn]:element==='water'?[slow]:[];add([element+'_'+i,name,D.elements[element]+(support?'屬性咒術':'屬性攻擊'),support?'spell':'magic',[element],support?0:1.05+i*.18,14+i*3,85+i*13,effects]);});
 for(const m of Object.values(D.moves)){m.elements ||= ({fire:['fire'],inferno:['fire'],spark:['metal'],nova:['light']}[m.id]||[]);m.tags ||= [m.damageType==='physical'?'slash':'magic'];m.hits ||=1;m.originalAttackTime=m.attackTime;}
 for(const [id,skill] of Object.entries(D.skills)){skill.category='legacy';skill.name='舊版'+skill.name;skill.triggerType='Passive';skill.conditions={};skill.effects=[];skill.parameters={};skill.tags=['legacy'];skill.rarity='common';}
 const skill=(id,name,description,modifiers=[],hooks=[],extra={})=>D.skills[id]={id,name,description,category:hooks.length?'條件觸發':'被動',rarity:'common',triggerType:hooks.map(h=>h.event).join('/')||'Passive',conditions:{},effects:hooks.flatMap(h=>h.effects),parameters:{},icon:hooks.length?'star':'orb',tags:[],modifiers:{},combatModifiers:modifiers,hooks,...extra};
 const hook=(event,conditions,effects,extra={})=>({event,conditions,effects,...extra});
 const restore=(resource,ratio)=>({type:'recover',resource,ratio});
 const statSkills=[['vitality','生命強化','hp',.15],['endurance','體能強化','stamina',.15],['mana_boost','魔力強化','mana',.15],['swift','迅捷','agility',.12],['fortunate','幸運兒','luck',.12]];
 statSkills.forEach(([id,name,stat,value])=>skill(id,name,(stat==='agility'||stat==='luck'?'基礎值':'最大值')+' +'+value*100+'%',[],[],{statRates:{[stat]:value},baseOnly:['agility','luck'].includes(stat)}));
 [['life_growth','生命成長','hp',.35],['training','鍛體','stamina',.35],['mana_talent','魔力天賦','mana',.35],['speed_growth','疾速成長','agility',.3],['destiny','天運','luck',.3]].forEach(([id,name,stat,v])=>skill(id,name,'升級成長率 +'+v*100+'%',[],[],{growthRates:{[stat]:v}}));
 skill('afterimage','殘影','物理招式結束後追加實際總傷害 25%；多段只觸發一次，不爆擊、不遞迴。',[],[hook('OnPhysicalSkillFinished',{totalDamagePositive:true},[{type:'echo',ratio:.25}])]);
 skill('opening','破綻洞察','敵人讀條時物理傷害 +25%。',[mod('damage',1.25,{...physical,targetCasting:true})]);
 skill('pursuit','乘勝追擊','物理爆擊後下一個物理招式攻擊時間 -20%，用完消失。',[],[hook('OnCriticalHit',physical,[{type:'status',status:{id:'pursuit',name:'乘勝追擊',duration:60,target:'self',polarity:'buff',consume:'physical',modifiers:[mod('attackTime',.8,physical)]}}])]);
 skill('quick_master','迅擊','原始攻擊時間 <100 的物理招式傷害 +15%。',[mod('damage',1.15,{...physical,originalTimeLt:100})]);
 skill('heavy_master','重擊精通','原始攻擊時間 ≥150 的物理招式傷害 +25%。',[mod('damage',1.25,{...physical,originalTimeGte:150})]);
 skill('unyielding','霸體','每場第一次中斷無效，不阻擋傷害。',[],[hook('OnInterruptReceived',{},[{type:'preventInterrupt'}],{once:true})]);
 skill('counter','反擊本能','受到物理攻擊後，下一個物理招式傷害 +20%。',[],[hook('OnDamageTaken',{...physical,primary:true},[{type:'status',status:{id:'counter',name:'反擊本能',duration:60,target:'self',polarity:'buff',consume:'physical',modifiers:[mod('damage',1.2,physical)]}}])]);
 skill('swordsmanship','劍術','裝備劍時物理傷害 +12%，斬擊攻擊時間 -5。',[mod('damage',1.12,{...physical,weapon:'sword'}),mod('attackTime',-5,{weapon:'sword',tag:'slash'},'add')]);
 skill('archery','弓術','裝備弓時爆擊率 +8 百分點；箭／射擊傷害 +10%。',[mod('critChance',.08,{weapon:'bow'},'add'),mod('damage',1.1,{weapon:'bow',anyTag:['arrow','shot']})]);
 skill('blunt_master','鈍器精通','裝備鈍器時中斷成功率 +20 百分點。',[mod('interruptChance',.2,{weapon:'blunt'},'add')]);
 skill('mana_cycle','魔力循環','魔法爆擊恢復最大 MP 5%。',[],[hook('OnCriticalHit',magic,[restore('mana',.05)])]);
 skill('stamina_cycle','體力循環','閃避成功恢復最大 SP 6%。',[],[hook('OnDodge',{},[restore('stamina',.06)])]);
 skill('economy','節能施法','魔法 MP 消耗 -15%，魔法傷害 -5%。',[mod('cost:mana',.85,magic),mod('damage',.95,magic)]);
 skill('overcast','全力施法','魔法 MP 消耗 +20%，魔法傷害 +18%。',[mod('cost:mana',1.2,magic),mod('damage',1.18,magic)]);
 skill('fast_cast','快速詠唱','所有魔法攻擊時間 -10，最低讀條仍為 0.5 秒。',[mod('attackTime',-10,magic,'add')]);
 skill('mana_guard','魔力護體','目前 MP >50% 時受到傷害 -10%。',[mod('incoming',.9,{resource:'mana',ratioGt:.5})]);
 skill('mana_reclaim','魔力回收','成功中斷敵人時恢復最大 MP 8%。',[],[hook('OnInterruptSuccess',{},[restore('mana',.08)])]);
 skill('body_cycle','身心循環','SP 招式完整結束後回 MP 3%；MP 招式結束後回 SP 3%。',[],[hook('OnSkillCastFinished',{spent:'stamina'},[restore('mana',.03)]),hook('OnSkillCastFinished',{spent:'mana'},[restore('stamina',.03)])]);
 for(const e of ['metal','wood','water','fire','earth','light','dark'])skill(e+'_affinity',D.elements[e]+'之適性',D.elements[e]+'傷害 +'+(e==='light'?12:15)+'%'+(e==='light'?'，光治療 +12%。':'。'),[mod('damage',e==='light'?1.12:1.15,{element:e}),...(e==='light'?[mod('healing',1.12,{element:e})]:[])]);
 skill('lightning_refund','雷擊反應','金屬性成功中斷時返還該招實際支付資源 25%。',[],[hook('OnInterruptSuccess',{element:'metal'},[{type:'refund',ratio:.25}])]);
 skill('flourish','生命繁盛','木屬性 Buff／控制招式成功後恢復 HP 5%，每招一次。',[],[hook('OnSkillCastFinished',{element:'wood',successfulSupport:true},[restore('hp',.05)])]);
 skill('chill','寒氣','水傷害命中使敏捷 -10%，4 秒；只刷新、不疊加。',[],[hook('OnDamageDealt',{element:'water',primary:true},[slow])]);
 skill('wildfire','烈火蔓延','命中燃燒敵人時刷新完整燃燒時間。',[],[hook('OnDamageDealt',{targetStatus:'burn',primary:true},[{type:'refresh',id:'burn'}])]);
 skill('earth_body','大地之軀','土招式結束後減傷 12%，4 秒；只刷新。',[],[hook('OnSkillCastFinished',{element:'earth'},[buff('earth_body','大地之軀',[mod('incoming',.88)])])]);
 skill('holy_echo','聖光回響','光屬性治療後恢復 MP 5%。',[],[hook('OnSkillCastFinished',{element:'light',healing:true},[restore('mana',.05)])]);
 skill('night_erosion','暗夜侵蝕','敵人有任一 Debuff 時闇傷害 +20%。',[mod('damage',1.2,{element:'dark',targetDebuff:true})]);
 skill('tenacity','不屈','HP <30% 時受到傷害 -20%。',[mod('incoming',.8,{resource:'hp',ratioLt:.3})]);
 skill('last_burst','瀕死爆發','HP <25% 時傷害 +25%。',[mod('damage',1.25,{resource:'hp',ratioLt:.25})]);
 skill('emergency','緊急防護','每場首次 HP 低於 20%，獲得最大 HP 20% 護盾。',[],[hook('OnHPChanged',{resource:'hp',ratioLt:.2,alive:true},[{type:'shield',ratio:.2}],{once:true})]);
 skill('veteran','老兵','依本局傷勢 0／1／2 個，傷害 +0／7／14%。',[{stage:'damage',op:'multiply',perInjury:.07,conditions:{}}]);
 skill('miracle','奇蹟','每場首次致命傷判定一次，成功保留 1 HP。原型機率：運氣 ×1%，最高 50%。',[],[hook('OnLethalDamage',{},[{type:'survive',luckRate:.01,cap:.5}],{once:true})]);
 skill('gambler','賭徒','爆擊倍率 +35%，非爆擊傷害 -8%。',[mod('critMultiplier',1.35),mod('damage',.92,{critical:false})]);
 skill('diligence','勤奮','戰鬥 EXP +12%。',[mod('exp',1.12)]);
 skill('adapt','臨機應變','MP <20% 時 SP 消耗 -15%；SP <20% 時 MP 消耗 -15%。',[mod('cost:stamina',.85,{resource:'mana',ratioLt:.2}),mod('cost:mana',.85,{resource:'stamina',ratioLt:.2})]);
 const playerSkill=(id,name,description,modifiers,tier=1,cost=120,preferredDungeon=null,distributionCategory='')=>skill(id,name,description,modifiers,[],{contentId:id,shopEligible:true,shopTier:tier,shopCost:cost,rarity:tier===1?'common':tier===2?'uncommon':'rare',tags:['non-element-specialization'],combatStacking:'forbidden',preferredDungeon,distributionCategory});
 const np=ni.physical,nm=ni.magic;
 playerSkill('pure_weapon','純武',`無屬性物理傷害 +${np.pureDamageBonus*100}%。`,[mod('damage',1+np.pureDamageBonus,{nonElementPhysical:true})],1,120,'abandoned_mine','physical weapon');
 playerSkill('plain_strike','樸實一擊',`無屬性物理招式的爆擊傷害 +${np.criticalDamageBonus*100}%。`,[mod('critMultiplier',np.criticalDamageBonus,{nonElementPhysical:true},'add')],2,180,'giant_ruins','physical weapon');
 playerSkill('tempered_body','千錘百鍊',`無屬性物理招式 SP 消耗 -${np.staminaCostReduction*100}%。`,[mod('cost:stamina',1-np.staminaCostReduction,{nonElementPhysical:true})],1,120,'thunder_workshop','physical weapon resource');
 playerSkill('soul_strike','一擊入魂',`原始攻擊時間 ≥${np.heavyCastThreshold} 的無屬性物理傷害 +${np.heavyDamageBonus*100}%。`,[mod('damage',1+np.heavyDamageBonus,{nonElementPhysical:true,originalTimeGte:np.heavyCastThreshold})],2,190,'giant_ruins','physical weapon');
 playerSkill('pure_arcana','純魔導',`無屬性魔法傷害 +${nm.pureDamageBonus*100}%。`,[mod('damage',1+nm.pureDamageBonus,{nonElementMagic:true})],1,120,'old_lab','magic resource');
 playerSkill('mana_concentration','魔力凝聚',`原始攻擊時間 ≥${nm.focusCastThreshold} 的無屬性魔法傷害 +${nm.focusDamageBonus*100}%。`,[mod('damage',1+nm.focusDamageBonus,{nonElementMagic:true,originalTimeGte:nm.focusCastThreshold})],2,180,'frozen_tower','magic resource');
 playerSkill('mana_purification','魔力純化',`無屬性魔法傷害 +${nm.purificationDamageBonus*100}%，MP 消耗 -${nm.purificationCostReduction*100}%。`,[mod('damage',1+nm.purificationDamageBonus,{nonElementMagic:true}),mod('cost:mana',1-nm.purificationCostReduction,{nonElementMagic:true})],2,185,'sunken_temple','magic resource');
 playerSkill('overflowing_mana','滿溢魔力',`施放前 MP ≥${nm.overflowManaRatio*100}% 時，無屬性魔法傷害 +${nm.overflowDamageBonus*100}%。`,[mod('damage',1+nm.overflowDamageBonus,{nonElementMagic:true,resource:'mana',ratioGte:nm.overflowManaRatio})],2,190,'lava_vein','magic resource');
 playerSkill('depleted_casting','枯竭施法',`施放前 MP ≤${nm.depletedManaRatio*100}% 時，無屬性魔法 MP 消耗 -${nm.depletedCostReduction*100}%。`,[mod('cost:mana',1-nm.depletedCostReduction,{nonElementMagic:true,resource:'mana',ratioLte:nm.depletedManaRatio})],2,190,'thunder_workshop','magic resource');
 playerSkill('archmage','大魔導',`無屬性魔法傷害 +${nm.archmageDamageBonus*100}%；原始攻擊時間 ≥${nm.focusCastThreshold} 時合計 +${(nm.archmageDamageBonus+nm.archmageLongCastBonus)*100}%。`,[mod('damage',1+nm.archmageDamageBonus,{nonElementMagic:true,originalTimeLt:nm.focusCastThreshold}),mod('damage',1+nm.archmageDamageBonus+nm.archmageLongCastBonus,{nonElementMagic:true,originalTimeGte:nm.focusCastThreshold})],3,280,'terminal_structure','magic special');
 D.catalogMoveIds=[...rows.map(r=>r[0]),...neutral.map(r=>r[0]),...neutralMagic.map(r=>r[0]),...Object.keys(sets).flatMap(e=>sets[e].map((_,i)=>e+'_'+i))];
 D.equipment.sword.weaponType='sword';D.equipment.greatsword.weaponType='sword';
 D.equipment.bow={id:'bow',name:'獵人短弓',slot:'weapon',weaponType:'bow',icon:'sword',description:'弓術配套武器；最大體力 +8。',modifiers:{stamina:8}};
 D.equipment.mace={id:'mace',name:'青銅戰鎚',slot:'weapon',weaponType:'blunt',icon:'axe',description:'鈍器精通配套武器；物理威力 +10%。',modifiers:{},physicalMultiplier:1.1};
 D.equipment.flame_robe={id:'flame_robe',name:'餘燼法袍',slot:'chest',icon:'armor',description:'火屬性命中施加 4 秒燃燒，重複命中只刷新。',modifiers:{mana:8},hooks:[hook('OnDamageDealt',{element:'fire',primary:true},[burn])]};
 D.monsters.slime.elements=['wood'];D.monsters.timid.elements=['water'];D.monsters.goblin.elements=['metal'];D.monsters.wolf.elements=['wood'];D.monsters.boss.elements=['earth','dark'];
 // Every existing MoveData can occupy the ultimate slot. Costs reflect overall
 // battle impact (damage, hits, control, healing and protection), not rarity.
 const explicitUltimateCosts={quick:60,instant:60,fire:90,fireball:90,heavy:100,heavy_slash:100,lesser_heal:110,blast_bolt:130,hades_flare:180,nova:125};
 for(const m of Object.values(D.moves)){
  let cost=90+(m.multiplier>=2.4?45:m.multiplier>=1.8?25:m.multiplier>=1.4?10:0)+(m.hits>1?(m.hits-1)*18:0);
  for(const effect of m.effects){if(effect.type==='interrupt')cost+=15;if(effect.type==='heal'||effect.type==='restore')cost+=20;if(effect.type==='status')cost+=18;}
  m.ultimateChargeCost=explicitUltimateCosts[m.id]||Math.max(60,Math.min(200,Math.round(cost/5)*5));
 }
 // Keep every ability description readable in the archive, loadout picker and
 // shop. The numeric fields remain data-driven; this only gives them a clear
 // human-facing explanation in one place.
 const eventName=e=>({OnPhysicalSkillFinished:'物理招式完成後',OnMagicSkillFinished:'魔法招式完成後',OnSpellFinished:'咒語完成後',OnCriticalHit:'造成爆擊時',OnDamageTaken:'受到傷害時',OnDodge:'成功閃避時',OnInterruptSuccess:'成功中斷時',OnSkillCastFinished:'招式完成後',OnHPChanged:'生命值變化時',OnLethalDamage:'受到致命傷害時'}[e]||e.replace(/^On/,''));
 const effectName=e=>e.type==='interrupt'?'命中時可中斷敵方讀條':e.type==='restore'?`命中後恢復 ${e.amount} ${e.resource==='mana'?'MP':'SP'}`:e.type==='heal'?'恢復生命':e.type==='status'&&e.status?`${e.status.name}（${e.status.duration} 秒）`:'';
 for(const m of Object.values(D.moves)){
  const base=(m.description||m.subtitle||m.name).replace(/；數值為原型平衡設定。?$/,'').replace(/[。；]+$/,'');
  const kind=m.damageType==='physical'?'物理':m.damageType==='magic'?'魔法':'咒語';
  const cost=Object.entries(m.cost||{}).map(([key,value])=>`${value} ${key==='mana'?'MP':'SP'}`).join('＋')||'無';
  const effects=(m.effects||[]).map(effectName).filter(Boolean);
  m.description=`${base}。類型：${kind}；消耗：${cost}；攻擊時間：${m.attackTime}。${effects.length?`附加效果：${effects.join('、')}。`:''}`;
 }
 for(const s of Object.values(D.skills)){
  if(!s.description)continue;
  const trigger=s.hooks?.length?`觸發時機：${s.hooks.map(h=>eventName(h.event)).join('、')}。`:'效果：配置後自動生效。';
  if(!s.description.includes('觸發時機')&&!s.description.includes('配置後'))s.description=`${s.description} ${trigger}`;
 }
 D.balance.recoverySeconds=3;
}
if(typeof module!=='undefined')module.exports=enrich;else root.CombatContent=enrich;
})(globalThis);
