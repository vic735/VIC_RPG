(function (root) {
  const data = {
    version: 1,
    player: { hp: 240, stamina: 100, mana: 80, agility: 40, luck: 10 },
    growth: { hp: 2, stamina: 2, mana: 2, agility: 1, luck: 1 },
    enemy: { hp: 360, stamina: 80, mana: 0, agility: 10, luck: 0 },
    moves: {
      quick: { id: 'quick', name: '快速斬擊', kind: 'normal', damageType: 'physical', multiplier: 0.8, cost: { stamina: 10 }, attackTime: 80, effects: [] },
      heavy: { id: 'heavy', name: '重擊', kind: 'normal', damageType: 'physical', multiplier: 2.5, cost: { stamina: 30 }, attackTime: 200, effects: [] },
      fire: { id: 'fire', name: '火球術', kind: 'normal', damageType: 'magic', multiplier: 1.2, cost: { mana: 15 }, attackTime: 100, effects: [] },
      interrupt: { id: 'interrupt', name: '震盪打擊', kind: 'normal', damageType: 'physical', multiplier: 0.3, cost: { stamina: 15 }, attackTime: 70, effects: [{ type: 'interrupt' }] },
      slime: { id: 'slime', name: '黏液撞擊', kind: 'normal', damageType: 'physical', multiplier: 0.55, cost: {}, attackTime: 120, effects: [] }
    },
    debuffs: [
      { id: 'frail', name: '體弱：最大血量 −8%', stat: 'hp', factor: 0.92 },
      { id: 'fatigue', name: '疲憊：最大體力 −8%', stat: 'stamina', factor: 0.92 },
      { id: 'faded', name: '衰退：最大魔力 −8%', stat: 'mana', factor: 0.92 },
      { id: 'stiff', name: '僵硬：敏捷 −8%', stat: 'agility', factor: 0.92 }
    ],
    defaultBuild: { talents: [], moves: ['quick', 'heavy', 'fire', 'interrupt'], ultimate: null, equipment: { head: null, chest: null, arms: null, feet: null, weapon: null } }
  };
  // Vertical-slice content. All provisional balance values live here, not in the UI.
  // Adventure tuning is separate from the combat engine's fixed sandbox defaults.
  data.adventure = { version: 2, baseStats: { hp: 120, stamina: 45, mana: 40, agility: 22, luck: 5 }, growth: { hp: 12, stamina: 4, mana: 4, agility: 1.2, luck: .6 } };
  data.adventure.balance50 = { resourceDamage: .7, castAgilityScale: 100, chargePerSecond: 1,
    growth: [
      { through: 10, hp: 12, stamina: 3, mana: 3, agility: .6, luck: .3 },
      { through: 25, hp: 14, stamina: 3.5, mana: 3.5, agility: .7, luck: .35 },
      { through: 40, hp: 16, stamina: 4, mana: 4, agility: .8, luck: .4 },
      { through: 50, hp: 18, stamina: 4.5, mana: 4.5, agility: .9, luck: .45 }
    ], mastery: [[1,1],[3,1.16],[10,1.45],[20,1.65],[50,1.9]] };
  data.balance = {
    critBase: .05, critPerLuck: .006, critCap: .55, critDamageBase: 1.4, critDamagePerLuck: .008,
    dodgePerAgility: .0015, dodgeCap: .3, expPerLuck: .008,
    expBase: 18, expPerLevel: 8, levelCost: 90, levelCostGrowth: 30,
    expGap: [[-15, .05], [-10, .3], [-5, .7], [0, 1], [5, 1.2], [10, 1.5]],
    moveGrowth: [.18, .09, .035, .012], ultimateCharge: 12,
    pointValues: { hp: 15, stamina: 6, mana: 6, agility: 3, luck: 3 },
    enemyGrowth: .15, playerSpeed: 190, discoveryRadius: 370, respawnSeconds: 65
  };
  Object.assign(data.moves, {
    spark: { id: 'spark', name: '雷電術', description: '從觀星所學會的雷電，命中時擊碎敵人的讀條。', icon: 'bolt', kind: 'normal', damageType: 'magic', multiplier: 1.5, cost: { mana: 25 }, attackTime: 120, effects: [{ type: 'interrupt' }] },
    nova: { id: 'nova', name: '星隕迴響', description: '星光撕裂敵人讀條，並回復 20 體力。', icon: 'star', kind: 'ultimate', damageType: 'magic', multiplier: 2.1, cost: { mana: 25 }, attackTime: 65, chargeSeconds: 12, effects: [{ type: 'interrupt' }, { type: 'restore', resource: 'stamina', amount: 20 }] },
    inferno: { id: 'inferno', name: '爆炎', description: '從魔法書習得的強力火焰，震碎敵方讀條。', icon: 'flame', kind: 'normal', damageType: 'magic', multiplier: 1.65, cost: { mana: 22 }, attackTime: 115, effects: [{ type: 'interrupt' }] },
    goblin: { id: 'goblin', name: '鏽刃突刺', kind: 'normal', damageType: 'physical', multiplier: .65, cost: {}, attackTime: 95, effects: [] },
    wolf: { id: 'wolf', name: '撲咬', kind: 'normal', damageType: 'physical', multiplier: .6, cost: {}, attackTime: 85, effects: [] },
    crush: { id: 'crush', name: '崩落重錘', kind: 'normal', damageType: 'physical', multiplier: 1.8, cost: {}, attackTime: 180, effects: [{ type: 'interrupt' }] },
    pulse: { id: 'pulse', name: '遺跡脈衝', kind: 'normal', damageType: 'magic', multiplier: .65, cost: {}, attackTime: 100, effects: [] }
  });
  Object.assign(data.moves.quick, { icon: 'sword', description: '迅速揮劍。低消耗，適合連續出手。' });
  Object.assign(data.moves.heavy, { icon: 'axe', description: '長時間蓄力，造成大量物理傷害。' });
  Object.assign(data.moves.fire, { icon: 'flame', description: '凝聚火焰，威力取決於最大魔力。' });
  Object.assign(data.moves.interrupt, { icon: 'bolt', description: '命中會打斷敵人正在準備的招式。' });
  data.skills = {
    vigor: { id: 'vigor', name: '體能強化', icon: 'heart', description: '最大體力 +15', modifiers: { stamina: 15 } },
    control: { id: 'control', name: '魔力控制', icon: 'orb', description: '最大魔力 +15；魔力成長率 +20%', modifiers: { mana: 15 }, growthRates: { mana: .2 } },
    agility: { id: 'agility', name: '敏捷強化', icon: 'wind', description: '敏捷 +8', modifiers: { agility: 8 } },
    lucky: { id: 'lucky', name: '幸運', icon: 'star', description: '運氣 +8，影響爆擊與 EXP', modifiers: { luck: 8 } }
  };
  data.equipment = {
    hood: { id: 'hood', name: '旅人兜帽', slot: 'head', icon: 'hood', description: '最大血量 +12', modifiers: { hp: 12 } },
    coat: { id: 'coat', name: '旅人外衣', slot: 'chest', icon: 'armor', description: '最大血量 +18', modifiers: { hp: 18 } },
    wraps: { id: 'wraps', name: '纏手', slot: 'arms', icon: 'hand', description: '最大體力 +8', modifiers: { stamina: 8 } },
    boots: { id: 'boots', name: '旅人短靴', slot: 'feet', icon: 'boot', description: '敏捷 +3', modifiers: { agility: 3 } },
    windboots: { id: 'windboots', name: '疾風靴', slot: 'feet', icon: 'wind', description: '敏捷 +10；閃避成功縮短目前讀條 0.5 秒', modifiers: { agility: 10 }, onDodgeShorten: .5 },
    sword: { id: 'sword', name: '行旅長劍', slot: 'weapon', icon: 'sword', description: '最大體力 +6', modifiers: { stamina: 6 } },
    greatsword: { id: 'greatsword', name: '狂戰巨劍', slot: 'weapon', icon: 'axe', description: '物理威力 +35%，物理攻擊時間 +25', modifiers: {}, physicalMultiplier: 1.35, physicalAttackTime: 25 }
  };
  data.monsters = {
    slime: { id: 'slime', name: '苔原史萊姆', behavior: 'neutral', stats: { hp: 155, stamina: 48, mana: 0, agility: 8, luck: 1 }, moves: ['slime'], color: '#82c8a0', radius: 0, speed: 30 },
    timid: { id: 'timid', name: '幼年史萊姆', sprite: 'slime', behavior: 'timid', stats: { hp: 115, stamina: 40, mana: 0, agility: 8, luck: 1 }, moves: ['slime'], color: '#b1d79c', radius: 180, speed: 80 },
    goblin: { id: 'goblin', name: '林地哥布林', behavior: 'active', stats: { hp: 210, stamina: 55, mana: 0, agility: 19, luck: 4 }, moves: ['goblin'], color: '#aeae63', radius: 230, speed: 110 },
    wolf: { id: 'wolf', name: '灰脊狼', behavior: 'guard', stats: { hp: 180, stamina: 53, mana: 0, agility: 30, luck: 4 }, moves: ['wolf'], color: '#c2c8c9', radius: 125, speed: 125 },
    boss: { id: 'boss', name: '星骸守衛', behavior: 'guard', stats: { hp: 430, stamina: 65, mana: 65, agility: 12, luck: 5 }, moves: ['crush', 'pulse'], color: '#cab4ec', radius: 140, speed: 50 }
  };
  data.world = {
    width: 2400, height: 1800, camp: { x: 370, y: 1050 },
    regions: [
      { id: 'meadow', name: '微光原野', subtitle: 'THE GLIMMERING LOWLANDS', x: 550, y: 1050, radius: 820, min: 1, max: 3, color: '#364e3b' },
      { id: 'forest', name: '低語森林', subtitle: 'THE WHISPERING WOODS', x: 1660, y: 470, radius: 740, min: 2, max: 6, color: '#253e3e' },
      { id: 'ash', name: '灰燼荒地', subtitle: 'THE ASHEN REACH', x: 1870, y: 1430, radius: 650, min: 4, max: 9, color: '#52483d' }
    ],
    spawns: [[540, 1020, 'slime'], [600, 1250, 'slime'], [800, 1060, 'timid'], [380, 1370, 'slime'], [900, 800, 'wolf'], [1050, 540, 'goblin'], [1370, 840, 'goblin'], [1430, 370, 'wolf'], [1790, 740, 'goblin'], [1880, 380, 'wolf'], [2160, 970, 'goblin'], [1620, 1270, 'wolf'], [1880, 1530, 'goblin'], [2150, 1440, 'wolf'], [1160, 1360, 'timid']]
  };
  data.explorationObjects = [
    { id: 'traveller', kind: 'npc', name: '守火旅人', action: '交談', x: 320, y: 1030, text: '沿石道往東北走，就能找到失落觀星所。遺跡裡有四場試煉；出發前，記得整理自己的招式。' },
    { id: 'camp-chest', kind: 'chest', name: '旅人的木箱', action: '開啟', x: 450, y: 950, once: true, reward: '古老銅幣', text: '你在舊行囊裡找到一枚古老銅幣，已收入本局探索收藏。' },
    { id: 'road-marker', kind: 'investigate', name: '風化路碑', action: '調查', x: 690, y: 930, text: '碑面刻著一顆星。箭頭指向東北方的觀星所，下面還有一句話：「知識會留下。」' },
    { id: 'moon-herb', kind: 'gather', name: '月露草', action: '採集', x: 420, y: 1170, once: true, reward: '月露草', text: '你小心採下一株帶著微光的月露草，已收入本局探索收藏。' }
  ];
  data.dungeons = [{ id: 'observatory', name: '失落觀星所', x: 1620, y: 650, level: 3, description: '星光仍在空蕩的石室中呼吸。四場試煉，揭開封存的知識。', reward: '雷電術 · 火球熟練度 · 爆炎魔法書 · 疾風靴', encounters: ['slime', 'goblin', 'wolf', 'boss'] }];
  data.books = { inferno: { id: 'inferno', name: '爆炎魔法書', moveId: 'inferno', requirement: { moveId: 'fire', level: 3 }, description: '理解火焰的形狀，才能學會讓它綻放。' } };
  (typeof module !== 'undefined' ? require('./combat-content.js') : root.CombatContent)(data);
  (typeof module !== 'undefined' ? require('./world-content.js') : root.WorldContent)(data);
  // Opening pacing: cheap basic attacks sustain the first continuous dungeon.
  data.moves.quick.cost.stamina=3;data.moves.fire.cost.mana=5;data.moves.quick.ultimateChargeCost=65;data.moves.fire.ultimateChargeCost=90;
  data.balance.respawnSeconds=20;
  data.balance.quickBattleLevelGap=5;
  data.balance.quickBattleSeconds=.55;
  data.balance.openingExp={through:12,multiplier:3,minimumGapFactor:.7};
  for(const [x,y,level] of [[750,450,4],[700,650,6],[550,800,8],[1000,500,8]]){
    const spawn={id:'opening-route-'+level+'-'+x,regionId:'greywind',x,y,type:'greywind_0',level,openingRoute:true};
    data.enemySpawnData.push(spawn);data.world.spawns.push([x,y,spawn.type]);
  }
  data.monsters.greywind_0.stats.hp=85;data.monsters.greywind_3.stats.hp=60;
  const firstMine=data.dungeons.find(d=>d.id==='abandoned_mine');
  const mineRoles=[['normal',160,10],['normal',180,12],['elite',320,12],['boss',640,12]];
  firstMine.enemyWaves.forEach((wave,i)=>{const [role,hp,power]=mineRoles[i],id='opening_mine_'+role+'_'+i,source=data.monsters[wave.type];data.monsters[id]={...source,id,name:source.name,stats:{...source.stats,hp,stamina:power,mana:power,agility:12},growth:{hp:.035,stamina:.014,mana:.014,agility:.15,luck:.05}};wave.type=id;});
  firstMine.bossId=firstMine.enemyWaves.at(-1).type;firstMine.encounters=firstMine.enemyWaves.map(w=>w.type);
  // World content may contribute moves after the combat catalogue is enriched.
  for (const move of Object.values(data.moves)) { move.ultimateChargeCost ||= 100; move.minCastTime ??= move.id==='instant' ? .65 : 1.1; }
  if (typeof module !== 'undefined') module.exports = data;
  else root.GameData = data;
})(globalThis);
