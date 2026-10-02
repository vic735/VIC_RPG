/* World v1 content. Stable IDs, spatial regions, encounters and typed reward tables. */
(function(root){function enrich(D){
 const clone=x=>JSON.parse(JSON.stringify(x));
 const regions=[
 ['greywind','灰風原野',1,20,[0,0,2400,2100],[[1,7],[6,13],[12,18],[18,24]],'meadow','#46513e','灰綠草原與裸露礦岩。'],
 ['verdant','翠蝕濕地',30,50,[0,2100,2400,2100],[[28,35],[34,42],[40,48],[46,55]],'wetland','#244c43','木與水生物、束縛與持續傷害。'],
 ['redrift','赤岩裂谷',60,85,[2400,2100,2400,2100],[[58,66],[65,74],[73,83],[82,90]],'volcanic','#684339','火土生物、爆發與重擊。'],
 ['froststorm','霜雷高地',100,130,[2400,0,2400,2100],[[96,106],[105,116],[115,128],[126,138]],'frost','#52656b','水金生物、高敏捷與中斷。'],
 ['obsidian','黑曜禁域',150,190,[4800,0,2400,4200],[[145,158],[156,172],[169,186],[183,200]],'obsidian','#363247','光闇與雙屬性生物的高難度區域。']
 ];
 D.world={width:7200,height:4200,camp:{x:350,y:350},regions:regions.map(([id,name,min,max,bounds,ranges,theme,color,description])=>({id,name,min,max,recommendedLevelMin:min,recommendedLevelMax:max,bounds,x:bounds[0]+bounds[2]/2,y:bounds[1]+bounds[3]/2,radius:Math.max(bounds[2],bounds[3])/2,subAreaLevelRanges:ranges.map(([min,max],i)=>({id:['edge','middle','deep','core'][i],name:['外圍','中段','深處','核心'][i],min,max})),visualTheme:theme,color,description,enemyPools:[],elitePools:[],dungeonIds:[]})),roads:[[{x:350,y:350},{x:700,y:900},{x:700,y:2900},{x:1500,y:3200},{x:3500,y:3200},{x:3600,y:950},{x:6000,y:950},{x:6000,y:3250}]]};
 D.explorationObjects=[];
 const poison={type:'status',status:{id:'poison',name:'毒',duration:5,polarity:'debuff',target:'enemy',modifiers:[],tick:{interval:1,ratio:.025,stat:'mana'}}};
 D.moves.bog_spore={id:'bog_spore',name:'腐蝕孢子',kind:'normal',damageType:'magic',elements:['wood'],tags:['magic'],hits:1,multiplier:.45,cost:{},attackTime:110,originalAttackTime:110,effects:[poison],icon:'orb',description:'施加持續毒，重複只刷新。'};
 const designs=[
 [['slime','灰風史萊姆',[],['slime']],['goblin','礦道掠奪者',['earth'],['goblin','crush']],['wolf','原野灰狼',[],['wolf']],['timid','幼角獸',['wood'],['slime']]],
 [['slime','腐水凝膠',['water'],['water_0','slime']],['goblin','孢霧獵手',['wood'],['bog_spore','root_trap','goblin']],['wolf','沼澤伏獸',['wood','water'],['freeze','wolf']],['timid','浮葉精',['wood'],['bog_spore','slime']]],
 [['slime','熔殼怪',['fire','earth'],['fireball','crush','slime']],['goblin','赤岩破陣者',['earth'],['crush','goblin']],['wolf','燼牙獵獸',['fire'],['flame_bolt','wolf']],['timid','岩背幼獸',['earth'],['slime']]],
 [['slime','霜晶凝膠',['water'],['freeze','ice_rain','slime']],['goblin','雷鳴巡獵者',['metal'],['lightning_whip','spark','goblin']],['wolf','霜雷獵獸',['water','metal'],['ice_lightning','wolf']],['timid','銀羽精',['metal'],['metal_0','slime']]],
 [['slime','黑光凝聚體',['light','dark'],['black_light','slime']],['goblin','禁域行刑者',['dark','fire'],['black_flame','dark_beam','goblin']],['wolf','黯光巡衛',['light','dark'],['light_arrow','protect','wolf']],['timid','虛光漂流體',['light'],['light_arrow','slime']]]
 ];
 D.enemySpawnData=[];
 for(const [ri,r]of D.world.regions.entries()){
  const archetypeTune=[{hp:1,stamina:1,exp:.8},{hp:.9,stamina:.94,exp:1.35},{hp:.92,stamina:.96,exp:1.5},{hp:.8,stamina:.88,exp:1.15}];
  designs[ri].forEach(([sprite,name,elements,moves],i)=>{const id=r.id+'_'+i,base=clone(D.monsters[sprite]),tune=archetypeTune[i];D.monsters[id]={...base,id,name,sprite,elements,moves,behavior:['neutral','active','guard','timid'][i],radius:[0,250,165,210][i],speed:[30,100,75,80][i],stats:{...base.stats,hp:Math.round(base.stats.hp*tune.hp),stamina:Math.round(base.stats.stamina*tune.stamina),mana:Math.max(base.stats.mana,45+ri*8),agility:base.stats.agility+(ri===3?38:ri*4)},skills:ri===0?[]:ri===1?['chill']:ri===2?['heavy_master']:ri===3?['fast_cast']:['night_erosion'],expFactor:tune.exp*(1+ri*.08),dropChance:ri===0?D.balance.wildRewards.openingDropChance:D.balance.wildRewards.ordinaryDropChance,dropPool:r.id+'_field',growth:{hp:.04,stamina:.014,mana:.016,agility:.16,luck:.07},color:['#a3b481','#70b1a0','#d89966','#a0cede','#b3a0d1'][ri]};r.enemyPools.push(id);});
  const elite=r.id+'_elite';D.monsters[elite]={...clone(D.monsters[r.enemyPools[1]]),id:elite,name:r.name+'菁英',sprite:'boss',elite:true,behavior:'guard',radius:200,stats:{hp:290,stamina:68,mana:58,agility:32+(ri===3?28:0),luck:9},moves:[...designs[ri][1][3],'crush'],skills:['unyielding'],expFactor:2.3,dropChance:D.balance.wildRewards.eliteDropChance};r.elitePools.push(elite);
  for(let i=0;i<20;i++){const depth=[.09,.35,.6,.9][Math.floor(i/5)],angle=i*2.399,rx=r.bounds[2]/2*(1-depth),ry=r.bounds[3]/2*(1-depth),x=Math.round(r.x+Math.cos(angle)*rx),y=Math.round(r.y+Math.sin(angle)*ry),isElite=i===3||i===18;D.enemySpawnData.push({id:r.id+'-spawn-'+i,regionId:r.id,x,y,type:isElite?elite:r.enemyPools[i%4],elite:isElite,levelBonus:isElite?8:0});}
 }
 // Accessible opening encounters, away from the safe camp.
 D.enemySpawnData.unshift({id:'opening-slime',regionId:'greywind',x:590,y:350,type:'greywind_0',level:2},{id:'opening-beast',regionId:'greywind',x:350,y:650,type:'greywind_3',level:3});
 D.monsters.camp_golem={id:'camp_golem',name:'沉眠石頭人',sprite:'golem',worldScale:1.55,labelHeight:180,behavior:'neutral',stats:{hp:420,stamina:82,mana:35,agility:12,luck:4},elements:['earth'],moves:['crush','goblin'],skills:['unyielding'],radius:0,speed:0,color:'#a2ad92',expFactor:1.8,dropChance:D.balance.wildRewards.golemDropChance,dropPool:'greywind_field',growth:{hp:.035,stamina:.016,mana:.016,agility:.12,luck:.05}};
 D.enemySpawnData.push({id:'camp-golem',regionId:'greywind',x:190,y:510,type:'camp_golem',level:18});
 D.world.spawns=D.enemySpawnData.map(e=>[e.x,e.y,e.type]);
 const gear=[['mining_guard','礦工護腕','arms',{stamina:18}],['root_coat','腐根外衣','chest',{hp:55,mana:15}],['tide_hood','潮汐兜帽','head',{mana:35}],['rift_blade','裂谷巨劍','weapon',{stamina:45}],['titan_plate','巨人重甲','chest',{hp:150}],['frost_robe','霜紋法袍','chest',{mana:65}],['storm_boots','雷行靴','feet',{agility:30}],['blacklight_crown','黑光冠','head',{mana:90,luck:20}],['abyss_blade','深淵刃','weapon',{stamina:100}],['end_guard','終末護甲','chest',{hp:250,mana:60}],['end_blade','終末之刃','weapon',{stamina:130,agility:25}],
 ['hunter_cowl','灰原獵兜','head',{stamina:18,agility:5}],['ember_visor','餘燼面罩','head',{mana:22,luck:4}],['stone_mask','古岩面具','head',{hp:60}],
 ['trail_cap','巡路皮帽','head',{hp:18,agility:4}],['novice_circlet','見習導環','head',{mana:16,luck:3}],['phoenix_diadem','不熄凰冠','head',{mana:72,luck:14}],['voidglass_helm','虛璃戰盔','head',{hp:120,stamina:40}],
 ['scout_leathers','裂谷斥候衣','chest',{hp:38,agility:7}],['thunder_mail','引雷鎖甲','chest',{hp:75,mana:22}],['twilight_mantle','暮光披肩','chest',{mana:55,luck:10}],['apprentice_robe','見習術衣','chest',{hp:24,mana:20}],
 ['duelist_gloves','決鬥者手套','arms',{stamina:18,agility:4}],['channeler_bracers','導魔護腕','arms',{mana:28}],['frost_grips','凝霜手甲','arms',{mana:32}],['leather_bracers','硬皮護腕','arms',{hp:18,stamina:12}],['focus_bands','凝神手環','arms',{mana:18,luck:3}],['ember_claws','熔火爪套','arms',{stamina:34,agility:7}],['storm_gauntlet','轟雷拳甲','arms',{stamina:58,agility:14}],['starforged_bracer','星鑄臂鎧','arms',{hp:95,mana:55}],
 ['mire_boots','踏泥短靴','feet',{hp:25,agility:7}],['ember_greaves','熾行脛甲','feet',{stamina:28,agility:10}],['shadow_treads','影行靴','feet',{agility:20,luck:7}],['field_shoes','原野便鞋','feet',{hp:12,agility:5}],['stone_sandals','礦岩戰履','feet',{stamina:16,agility:4}],['comet_steps','彗星步履','feet',{agility:32,luck:12}],['abyss_walkers','深淵行者','feet',{hp:80,agility:28}],
 ['ash_staff','灰燼法杖','weapon',{mana:38}],['tide_mace','潮鳴戰鎚','weapon',{hp:35,mana:22}],['starfall_staff','星落法杖','weapon',{mana:65,luck:10}],['yew_longbow','紫杉長弓','weapon',{stamina:30,agility:6}],['stormbow','雷弦戰弓','weapon',{stamina:55,agility:14}],['iron_maul','礦鐵重鎚','weapon',{hp:25,stamina:32}],['runic_staff','刻紋法杖','weapon',{mana:32,luck:5}]];
 for(const [id,name,slot,modifiers]of gear)D.equipment[id]={id,name,slot,modifiers,icon:slot==='weapon'?'sword':slot==='feet'?'boot':'armor',description:Object.entries(modifiers).map(([k,v])=>({hp:'HP',stamina:'SP',mana:'MP',agility:'敏捷',luck:'運氣'})[k]+' +'+v).join('；'),...(slot==='weapon'?{weaponType:'sword'}:{})};
 D.equipment.storm_boots.onDodgeShorten=.8;D.equipment.storm_boots.description+='；閃避縮短讀條 0.8 秒';
 D.equipment.rift_blade.physicalMultiplier=1.25;D.equipment.rift_blade.physicalAttackTime=15;D.equipment.rift_blade.description+='；物理威力 +25%，攻擊時間 +15';
 D.equipment.end_blade.combatModifiers=[{stage:'damage',op:'multiply',value:1.15,conditions:{targetDebuff:true}}];D.equipment.end_blade.description+='；對有 Debuff 的目標傷害 +15%';
 D.equipment.frost_robe.combatModifiers=[{stage:'cost:mana',op:'multiply',value:.9,conditions:{element:'water'}}];D.equipment.frost_robe.description+='；水屬性 MP 消耗 -10%';
 Object.assign(D.equipment.ember_visor,{targetElements:['fire'],elementCostReductionPct:.08});D.equipment.ember_visor.description+='；火屬性 MP／SP 消耗 -8%';
 Object.assign(D.equipment.stone_mask,{targetElements:['earth'],incomingElementDamageReductionPct:.1});D.equipment.stone_mask.description+='；受到的土屬性傷害 -10%';
 D.equipment.duelist_gloves.combatModifiers=[{stage:'damage',op:'multiply',value:1.06,conditions:{damageType:'physical'}}];D.equipment.duelist_gloves.description+='；物理傷害 +6%';
 D.equipment.channeler_bracers.combatModifiers=[{stage:'cost:mana',op:'multiply',value:.94,conditions:{damageType:'magic'}}];D.equipment.channeler_bracers.description+='；攻擊魔法 MP 消耗 -6%';
 Object.assign(D.equipment.frost_grips,{targetElements:['water'],elementDamageBonusPct:.08});D.equipment.frost_grips.description+='；水屬性傷害 +8%';
 Object.assign(D.equipment.thunder_mail,{targetElements:['metal'],incomingElementDamageReductionPct:.1});D.equipment.thunder_mail.description+='；受到的金屬性傷害 -10%';
 Object.assign(D.equipment.twilight_mantle,{targetElements:['light','dark'],elementDamageBonusPct:.06});D.equipment.twilight_mantle.description+='；光與闇屬性傷害 +6%';
 Object.assign(D.equipment.ember_greaves,{targetElements:['fire'],elementCostReductionPct:.07});D.equipment.ember_greaves.description+='；火屬性 MP／SP 消耗 -7%';
 D.equipment.shadow_treads.onDodgeShorten=.6;D.equipment.shadow_treads.description+='；閃避時縮短目前讀條 0.6 秒';
 Object.assign(D.equipment.ash_staff,{weaponType:'staff',targetElements:['fire'],elementDamageBonusPct:.08});D.equipment.ash_staff.description+='；火屬性傷害 +8%';
 Object.assign(D.equipment.tide_mace,{weaponType:'blunt',physicalMultiplier:1.08});D.equipment.tide_mace.description+='；物理威力 +8%';
 D.equipment.starfall_staff.weaponType='staff';D.equipment.starfall_staff.combatModifiers=[{stage:'damage',op:'multiply',value:1.09,conditions:{damageType:'magic'}}];D.equipment.starfall_staff.description+='；魔法傷害 +9%';
 D.equipment.yew_longbow.weaponType='bow';D.equipment.yew_longbow.combatModifiers=[{stage:'damage',op:'multiply',value:1.05,conditions:{damageType:'physical',weapon:'bow'}}];D.equipment.yew_longbow.description+='；使用弓時物理傷害 +5%';
 Object.assign(D.equipment.stormbow,{weaponType:'bow',targetElements:['metal'],elementDamageBonusPct:.08});D.equipment.stormbow.description+='；金屬性傷害 +8%';
 Object.assign(D.equipment.iron_maul,{weaponType:'blunt',physicalMultiplier:1.1,physicalAttackTime:8});D.equipment.iron_maul.description+='；物理威力 +10%，攻擊時間 +8';
 D.equipment.runic_staff.weaponType='staff';D.equipment.runic_staff.combatModifiers=[{stage:'cost:mana',op:'multiply',value:.94,conditions:{damageType:'magic'}}];D.equipment.runic_staff.description+='；攻擊魔法 MP 消耗 -6%';
 D.equipment.ember_claws.combatModifiers=[{stage:'damage',op:'multiply',value:1.07,conditions:{element:'fire'}}];D.equipment.ember_claws.description+='；火屬性傷害 +7%';
 Object.assign(D.equipment.storm_gauntlet,{targetElements:['metal'],elementDamageBonusPct:.12});D.equipment.storm_gauntlet.description+='；金屬性傷害 +12%';
 D.equipment.starforged_bracer.combatModifiers=[{stage:'cost:mana',op:'multiply',value:.88,conditions:{damageType:'magic'}}];D.equipment.starforged_bracer.description+='；攻擊魔法 MP 消耗 -12%';
 D.equipment.comet_steps.onDodgeShorten=.85;D.equipment.comet_steps.description+='；閃避時縮短目前讀條 0.85 秒';
 Object.assign(D.equipment.abyss_walkers,{targetElements:['dark'],incomingElementDamageReductionPct:.14});D.equipment.abyss_walkers.description+='；受到的闇屬性傷害 -14%';
 const bookRows=[['tide_book','潮汐魔法書','lesser_heal','water_0'],['frost_book','冰錐魔法書','ice_rain','water_0'],['lightning_book','冰凍雷光書','ice_lightning','metal_0'],['blacklight_book','黑光魔法書','black_light','dark_bolt'],['abyss_book','冥王爆炎書','hades_flare','black_flame'],['end_book','終末煉金書','alchemy','metal_0']];
 for(const [id,name,moveId,req]of bookRows)D.books[id]={id,name,moveId,requirement:{moveId:req,level:3},description:'永久 '+D.moves[req].name+' Lv.3 後可理解，學會 '+D.moves[moveId].name+'。',icon:'book'};
 const definitions=[
 ['abandoned_mine','廢棄礦坑',0,12,'standard',920,760,['物理','土','重擊','防禦'],['heavy_slash','break_stance'],['heavy_master','swordsmanship'],['mining_guard','mace','hunter_cowl','duelist_gloves','trail_cap','leather_bracers','field_shoes','stone_sandals','iron_maul','bow'],'inferno'],
 ['old_lab','舊魔法研究室',0,20,'short',1720,1240,['基礎魔法','屬性攻擊'],['fireball','metal_0'],['economy','fire_affinity'],['flame_robe','hood','ember_visor','ash_staff','novice_circlet','apprentice_robe','focus_bands','runic_staff'],'inferno'],
 ['root_cave','腐根洞窟',1,38,'standard',620,2760,['木','束縛','毒','持續效果'],['root_trap','wood_0'],['flourish','wood_affinity'],['root_coat','wraps','mire_boots','yew_longbow'],'tide_book'],
 ['sunken_temple','沉沒神殿',1,50,'deep',1560,3380,['水','控制','治療','防護'],['water_0','lesser_heal'],['holy_echo','mana_guard'],['tide_hood','root_coat','channeler_bracers','tide_mace'],'tide_book'],
 ['lava_vein','熔岩礦脈',2,70,'standard',2900,2680,['火','土','爆發'],['blast_bolt','earth_0'],['fire_affinity','earth_body'],['rift_blade','flame_robe','scout_leathers','ember_greaves','ember_claws'],'inferno'],
 ['giant_ruins','巨人遺跡',2,85,'short',3970,3260,['重擊','霸體','高 HP'],['heavy_slash','charge_up'],['unyielding','afterimage'],['titan_plate','rift_blade','stone_mask'],'frost_book'],
 ['frozen_tower','凍結塔',3,110,'deep',2990,750,['水','減速','高威力魔法'],['freeze','ice_rain'],['chill','water_affinity'],['frost_robe','tide_hood','frost_grips'],'frost_book'],
 ['thunder_workshop','雷鳴工房',3,130,'standard',4050,1360,['金','中斷','高敏捷'],['lightning_whip','metal_3'],['lightning_refund','mana_reclaim'],['storm_boots','windboots','thunder_mail','stormbow'],'lightning_book'],
 ['blacklight_chapel','黑光聖堂',4,160,'standard',5520,950,['光','闇','Buff','Debuff'],['black_light','dark_beam','dark_bolt','black_flame'],['light_affinity','night_erosion'],['blacklight_crown','frost_robe','twilight_mantle'],'blacklight_book'],
 ['element_abyss','元素深淵',4,175,'deep',6370,2190,['五行混合','雙屬性','屬性相剋'],['black_lightning','ice_lightning'],['adapt','overcast'],['abyss_blade','blacklight_crown','shadow_treads'],'abyss_book'],
 ['terminal_structure','終末遺構',4,190,'deep',6020,3340,['複合 Build','高階招式','高難度 Boss'],['hades_flare','alchemy'],['miracle','veteran'],['end_guard','end_blade','starfall_staff','abyss_blade','shadow_treads'],'end_book']
 ];
 D.dungeonTemplates={standard:['normal','normal','elite','boss'],short:['elite','boss'],deep:['normal','normal','elite','normal','boss']};D.rewardPools={};D.dungeons=[];
 const pool=(id,entries)=>D.rewardPools[id]={id,entries:entries.map(([rewardType,rewardIds,weight=1,rarity='common'])=>({rewardType,rewardIds,weight,rarity,requirements:{}}))};
 for(const [index,row]of definitions.entries()){
  const [id,name,ri,level,kind,x,y,features,moves,skills,equipment,book]=row,r=D.world.regions[ri],bossId=id+'_boss';
  const bossMoves=[['crush','heavy_slash','goblin'],['fireball','metal_0','pulse'],['root_trap','bog_spore','wood_0','slime'],['water_0','lesser_heal','protect','slime'],['blast_bolt','earth_0','crush'],['heavy_slash','charge_up','crush'],['freeze','ice_rain','water_0','slime'],['lightning_whip','metal_3','spark','goblin'],['black_light','dark_beam','protect','pulse'],['ice_lightning','black_flame','wood_0','crush'],['hades_flare','alchemy','protect','crush']][index];

  D.monsters[bossId]={id:bossId,name:name+'守衛',sprite:'boss',behavior:'guard',boss:true,stats:{hp:480+ri*30,stamina:75+ri*5,mana:80+ri*5,agility:ri===3?52:22+ri*4,luck:10},elements:ri===0?['earth']:ri===1?['wood','water']:ri===2?['fire','earth']:ri===3?['water','metal']:['light','dark'],moves:bossMoves,skills:ri<2?['unyielding']:ri===2?['unyielding','earth_body']:ri===3?['chill','fast_cast']:['mana_guard','night_erosion'],radius:150,speed:50,color:r.color,expFactor:2.5,dropChance:0,growth:{hp:.035,stamina:.014,mana:.014,agility:.15,luck:.05}};
  if(id==='giant_ruins'){D.monsters[bossId].stats.hp*=1.5;D.monsters[bossId].skills=['unyielding','heavy_master'];}
  if(id==='old_lab')D.monsters[bossId].elements=['fire','metal'];
  if(id==='sunken_temple')D.monsters[bossId].elements=['water','light'];
  if(id==='element_abyss')D.monsters[bossId].elements=['fire','earth'];
  const primary=id+'_primary',secondary=id+'_secondary',rare=id+'_rare';pool(primary,[['moves',moves,3],['talents',skills,2]]);pool(secondary,[['equipment',equipment,3],['books',[book],1]]);pool(rare,[['moves',[moves.at(-1)],1,'rare'],['talents',[skills.at(-1)],1,'rare'],['equipment',[equipment[0]],2,'rare'],['books',[book],1,'rare']]);
  const rules=[{id:'move_gear',weight:35,draws:[{pool:primary,type:'moves'},{pool:secondary,type:'equipment'}]},{id:'skill_gear',weight:30,draws:[{pool:primary,type:'talents'},{pool:secondary,type:'equipment'}]},{id:'move_skill',weight:25,draws:[{pool:primary,type:'moves'},{pool:primary,type:'talents'}]},{id:'rare',weight:10,draws:[{pool:primary,type:'moves'},{pool:primary,type:'talents'},{pool:rare}]}];
  if(id==='abandoned_mine'){rules[0].weight=10;rules[1].weight=45;rules[2].weight=35;rules[3].weight=10;}
  const waves=D.dungeonTemplates[kind].map((role,i)=>({role,type:role==='boss'?bossId:role==='elite'?r.elitePools[0]:r.enemyPools[i%r.enemyPools.length],level:Math.max(1,Math.round(level*(role==='boss'?1.05:role==='elite'?1: .8+i*.04)))}));
  if(id==='element_abyss')for(const [i,type]of ['verdant_2','froststorm_2','redrift_elite','greywind_1'].entries())waves[i].type=type;
 const d={id,name,regionId:r.id,recommendedLevel:level,level,dungeonType:kind,x,y,features,description:features.join(' / '),enemyWaves:waves,encounters:waves.map(w=>w.type),bossId,primaryRewardPool:primary,secondaryRewardPool:secondary,rareRewardPool:rare,rewardCombinationRules:rules,rewardTypes:['招式','技能','裝備','魔法書']};D.dungeons.push(d);r.dungeonIds.push(id);
 }
 D.equipmentRarityLabels={common:'普通',uncommon:'精良',rare:'稀有',epic:'史詩',legendary:'傳說'};
 for(const item of Object.values(D.equipment)){item.rarity||='common';item.acquisitionTier||='standard';}
 const easyEquipment=['hood','hunter_cowl','novice_circlet','coat','flame_robe','apprentice_robe','wraps','mining_guard','leather_bracers','boots','field_shoes','stone_sandals','sword','bow','ash_staff'];
 for(const id of easyEquipment)if(D.equipment[id])Object.assign(D.equipment[id],{rarity:'common',acquisitionTier:'easy'});
 const highRarityEquipment=[
  ['phoenix_diadem','epic','lava_vein'],['voidglass_helm','legendary','terminal_structure'],
  ['twilight_mantle','epic','blacklight_chapel'],['end_guard','legendary','terminal_structure'],
  ['storm_gauntlet','epic','thunder_workshop'],['starforged_bracer','legendary','terminal_structure'],
  ['comet_steps','epic','frozen_tower'],['abyss_walkers','legendary','element_abyss'],
  ['starfall_staff','epic','blacklight_chapel'],['end_blade','legendary','terminal_structure']
 ];
 const highIds=new Set(highRarityEquipment.map(row=>row[0]));
 for(const d of D.dungeons){const entry=D.rewardPools[d.secondaryRewardPool].entries.find(e=>e.rewardType==='equipment');entry.rewardIds=entry.rewardIds.filter(id=>!highIds.has(id));}
 for(const [id,rarity,dungeonId]of highRarityEquipment){const item=D.equipment[id];Object.assign(item,{rarity,acquisitionTier:'rare-only'});const dungeon=D.dungeons.find(d=>d.id===dungeonId),entry=D.rewardPools[dungeon.rareRewardPool].entries.find(e=>e.rewardType==='equipment');if(!entry.rewardIds.includes(id))entry.rewardIds.push(id);}
 for(const item of Object.values(D.equipment)){item.sourceDungeons=[];for(const d of D.dungeons)for(const poolId of [d.secondaryRewardPool,d.rareRewardPool])if(D.rewardPools[poolId].entries.some(e=>e.rewardType==='equipment'&&e.rewardIds.includes(item.id)))item.sourceDungeons.push(d.id);}
 for(const r of D.world.regions){const first=D.dungeons.find(d=>d.regionId===r.id);pool(r.id+'_field',D.rewardPools[first.primaryRewardPool].entries.map(e=>[e.rewardType,e.rewardIds,e.weight]));}
 const fieldSkills=[['vigor','control','agility','lucky','vitality','endurance','mana_boost','swift','fortunate','life_growth','training','mana_talent','speed_growth','destiny','diligence','archery','quick_master'],['mana_cycle','stamina_cycle','mana_guard','mana_reclaim','body_cycle'],['tenacity','last_burst','gambler','counter','pursuit','opening','blunt_master','wildfire','earth_affinity'],['fast_cast','lightning_refund','metal_affinity','emergency'],['dark_affinity','light_affinity','adapt']];
 for(const [i,r]of D.world.regions.entries())D.rewardPools[r.id+'_field'].entries.push({rewardType:'talents',rewardIds:fieldSkills[i],weight:i===0?4:2,rarity:'common',requirements:{}});
 // Short branches keep every dungeon entrance reachable from the main road.
 const trunk=D.world.roads[0];for(const d of D.dungeons){let best=null,dist=Infinity;for(let i=1;i<trunk.length;i++){const a=trunk[i-1],b=trunk[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((d.x-a.x)*dx+(d.y-a.y)*dy)/(dx*dx+dy*dy))),q={x:a.x+dx*t,y:a.y+dy*t},n=Math.hypot(q.x-d.x,q.y-d.y);if(n<dist){dist=n;best=q;}}D.world.roads.push([best,{x:d.x,y:d.y+65}]);}
 const firstRegionMoves=['quick','fire','heavy','interrupt','double_slash','heavy_slash','break_stance','charge_up','counter_stance','focus','spark','inferno','fireball','flame_bolt','water_0','earth_0','metal_0','light_0','dark_0','wind_slash'].filter(id=>D.moves[id]);
 const firstRegionSkills=['vigor','control','agility','lucky','vitality','endurance','mana_boost','swift','fortunate','life_growth','training','mana_talent','speed_growth','destiny','afterimage','opening','quick_master','heavy_master','swordsmanship','economy'].filter(id=>D.skills[id]);
 D.rewardPools.greywind_field.entries=D.rewardPools.greywind_field.entries.filter(e=>!['moves','talents'].includes(e.rewardType));
 D.rewardPools.greywind_field.entries.push({rewardType:'moves',rewardIds:firstRegionMoves,weight:3,rarity:'common',requirements:{}});
 D.rewardPools.greywind_field.entries.push({rewardType:'talents',rewardIds:firstRegionSkills,weight:3,rarity:'common',requirements:{}});
 D.rewardPools.abandoned_mine_rare.entries.find(e=>e.rewardType==='equipment').rewardIds.push('greatsword','bow');
 D.worldContentVersion=1;
 D.balance.rewardSourceTargets={dungeonSkillShare:.82,wildSkillShare:.18,ordinaryAbilityDropChance:[.025,.035],eliteAbilityDropChance:.35};

 D.equipment.mercy_mantle={id:'mercy_mantle',name:'餘光聖衣',slot:'chest',icon:'armor',modifiers:{hp:30,mana:18},rarity:'rare',powerGrade:'A',specialEquipment:true,preferredDungeon:'sunken_temple',acquisitionTier:'rare-only',overhealShield:{ratio:.5,cap:.12},description:'HP +30；MP +18。招式治療的溢出量有 50% 轉為護盾，護盾最多為最大 HP 的 12%；每場重置，其他被動回復與戰後補滿不觸發。'};
 D.equipment.echo_bracers={id:'echo_bracers',name:'追響護腕',slot:'arms',icon:'armor',modifiers:{stamina:20},rarity:'rare',powerGrade:'A',specialEquipment:true,preferredDungeon:'giant_ruins',acquisitionTier:'rare-only',finisherEcho:.15,description:'SP +20。多段攻擊最後一擊命中且敵人仍存活時，追加該擊實際傷害 15% 的追響；不爆擊、不再觸發殘影或其他追擊。'};
 D.equipment.breaker_boots={id:'breaker_boots',name:'斷詠戰靴',slot:'feet',icon:'boot',modifiers:{agility:8},rarity:'rare',powerGrade:'A',specialEquipment:true,preferredDungeon:'frozen_tower',acquisitionTier:'rare-only',hooks:[{event:'OnInterruptSuccess',effects:[{type:'recover',resource:'stamina',ratio:.03}]}],description:'敏捷 +8。成功中斷敵人讀條後恢復最大 SP 的 3%；沒有實際中斷時不觸發。'};
 D.startingSkills=[];
 D.startingMoves=['quick','fire'];
}
if(typeof module!=='undefined')module.exports=enrich;else root.WorldContent=enrich;
})(globalThis);
