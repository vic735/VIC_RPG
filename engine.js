(function (root) {
  const D = typeof module !== 'undefined' ? require('./data.js') : root.GameData;
  const R = typeof module !== 'undefined' ? require('./skill-runtime.js') : root.SkillRuntime;
  const copy = value => JSON.parse(JSON.stringify(value));
  const grow = (base, level, growth, rate = 0) => base + (level - 1) * growth * (1 + rate);
  const castSeconds = (attackTime, agility) => Math.max(0.5, ((attackTime - agility) / 100) * 5);
  const ultimateChargeCost = id => D.moves[id]?.ultimateChargeCost || 100;
  function validateBuild(build, unlocked = Object.keys(D.moves)) {
    if (build.talents.length > 4 || build.moves.length > 4) throw Error('天賦與普通招式各最多四個');
    if (new Set(build.moves).size !== build.moves.length || new Set(build.talents).size !== build.talents.length) throw Error('Build 不可重複配置');
    for (const id of build.moves) if (!D.moves[id] || D.moves[id].kind !== 'normal' || !unlocked.includes(id)) throw Error('招式不存在或尚未解鎖');
    if (build.ultimate !== null && typeof build.ultimate !== 'string') throw Error('必殺技最多一個 ID');
    const slots = ['head', 'chest', 'arms', 'feet', 'weapon'];
    if (Object.keys(build.equipment).some(k => !slots.includes(k))) throw Error('未知裝備欄位');
  }
  // Sandbox probabilities deliberately do not infer unspecified agility/luck formulas.
  const sandboxRules = { critChance: 0.15, dodgeChance: 0.1, critMultiplier: 1.5 };
  class Battle {
    constructor(options = {}) {
      this.rng = options.rng || Math.random;
      this.rules = { ...sandboxRules, ...options.rules };
      this.enemyDefinition = options.enemy || { name: '史萊姆', stats: D.enemy, moves: ['slime'] };
      this.moveLevels = options.moveLevels || {};
      this.moveScale = options.moveScale || (() => 1);
      this.equipmentEffects = options.equipmentEffects || {};
      this.options = options;
      this.charge = 0; this.enemyTurn = 0;
      this.base = { ...D.player, ...options.stats };
      for (const [key, value] of Object.entries(this.base)) if (!Number.isFinite(value) || value < (key === 'hp' ? 1 : 0)) throw Error('能力值必須是有效非負數，HP 至少 1');
      this.build = copy(options.build || D.defaultBuild);
      validateBuild(this.build);
      this.run = { schemaVersion: 1, level: 1, exp: 0, deaths: 0, debuffIds: [], status: 'active' };
      this.time = 0; this.events = []; this.phase = 'ready'; this.resetActors();
    }
    log(type, text, detail = {}) { this.events.push({ time: this.time, type, text, ...detail }); }
    resetActors() {
      const stats = { ...this.base };
      for (const id of this.run.debuffIds) { const d = D.debuffs.find(d => d.id === id); stats[d.stat] *= d.factor; }
      const actor = (id, stats) => ({ id, stats, hp: stats.hp, stamina: stats.stamina, mana: stats.mana, cast: null, statuses: {}, shield: 0, elements: [], weaponType: null });
      this.player = actor('player', stats); this.enemy = actor('enemy', { ...this.enemyDefinition.stats });
      this.player.elements = this.options.elements || []; this.enemy.elements = this.enemyDefinition.elements || [];
      this.player.weaponType = D.equipment[this.build.equipment.weapon]?.weaponType;
      this.player.runtime = new R.Runtime(this,this.player,[...this.build.talents.map(id=>D.skills[id]).filter(Boolean),...Object.values(this.build.equipment).map(id=>D.equipment[id]).filter(Boolean)]);
      this.enemy.runtime = new R.Runtime(this,this.enemy,(this.enemyDefinition.skills||[]).map(id=>D.skills[id]).filter(Boolean));
    }
    start() {
      if (!['ready', 'victory', 'revived'].includes(this.phase)) return false;
      this.resetActors(); this.charge = 0; this.enemyTurn = 0; this.phase = 'fighting'; this.log('start', '戰鬥開始，無法逃跑。'); this.player.runtime.emit('OnBattleStart'); this.enemy.runtime.emit('OnBattleStart'); this.begin(this.enemy, this.nextEnemyMove()); return true;
    }
    nextEnemyMove() { const list = this.enemyDefinition.moves; return list[this.enemyTurn++ % list.length]; }
    getMove(id, actor = this.player) {
      const original = D.moves[id]; if (!original) return null;
      const physical=original.damageType==='physical', trace=new Set(), player=actor===this.player;
      const move={...original,cost:{...original.cost},multiplier:original.multiplier*(player?this.moveScale(this.moveLevels[id]||1):1)*(player&&physical?this.equipmentEffects.physicalMultiplier||1:1),attackTime:original.attackTime+(player&&physical?this.equipmentEffects.physicalAttackTime||0:0)};
      if(player&&physical&&(this.equipmentEffects.physicalMultiplier||this.equipmentEffects.physicalAttackTime))trace.add(D.equipment[this.build.equipment.weapon]?.name||'裝備');
      const ctx={move};move.attackTime=actor.runtime.modify('attackTime',move.attackTime,ctx,trace);
      for(const [resource,value]of Object.entries(move.cost))move.cost[resource]=Math.max(0,Math.round(actor.runtime.modify('cost:'+resource,value,ctx,trace)*100)/100);
      // Consumed next-cast modifiers must survive for the whole selected move, not future moves.
      move.reservedModifiers=Object.values(actor.statuses).filter(s=>s.consume===move.damageType&&s.expiresAt>this.time).flatMap(s=>s.modifiers.filter(m=>m.stage==='damage'));
      move.modifications=[...trace]; return move;
    }
    effectiveStat(actor,key){return actor.runtime.modify(key,actor.stats[key]);}
    rule(key,actor,ctx={}) { const value=this.rules[key], stats={...actor.stats,agility:this.effectiveStat(actor,'agility')};const base=typeof value==='function'?value(stats):value;return actor.runtime.modify(key,base,ctx); }
    castDuration(move,actor){return this.options.balance50 ? Math.max(move.minCastTime??1.1,move.attackTime*.05/(1+this.effectiveStat(actor,'agility')/D.adventure.balance50.castAgilityScale)) : castSeconds(move.attackTime,this.effectiveStat(actor,'agility'));}
    preview(id){const move=this.getMove(id);if(!move)return null;const trace=new Set(move.modifications);const damage=this.damageValue(this.player,this.enemy,move,false,trace);return {...move,estimatedDamage:damage,castTime:this.castDuration(move,this.player),modifications:[...trace]};}
    damageValue(actor,target,move,critical=false,trace){
      const maximum=actor.stats[move.damageType==='physical'?'stamina':'mana'];const ctx={actor,target,move,critical};
      let gapFactor=1;if(this.options.balance50&&this.options.levelGap&&actor!==this.player){const gap=this.options.levelGap,rules=D.balance.levelGapCombat||{};gapFactor=Math.min(rules.enemyDamageCap??1.75,1+Math.max(0,gap)*(rules.enemyDamagePerLevel??.015));}let damage=actor.runtime.modify('damage',maximum*move.multiplier*(actor===this.player&&this.options.balance50?D.adventure.balance50.resourceDamage:1)*gapFactor,ctx,trace);
      for(const m of move.reservedModifiers||[])if(move.consumeReserved&&R.matches(m.conditions,{...ctx,battle:this}))damage=m.op==='add'?damage+m.value:damage*m.value;
      damage*=R.elementMultiplier(move.elements,target.elements);if(actor===this.player&&target===this.enemy&&this.options.balance50){const rules=D.balance.enemyDefense||{},gap=Math.max(0,this.options.levelGap||0),base=move.damageType==='physical'?this.enemyDefinition.physicalDefense||0:this.enemyDefinition.magicResistance||0,defense=base+gap*(rules.levelGapPerLevel||0),constant=rules.formulaConstant||100,reduction=Math.min(rules.maximumReduction??.8,defense/(constant+defense));damage*=1-reduction;}if(critical)damage*=this.rule('critMultiplier',actor,ctx);
      return Math.max(0,target.runtime.modify('incoming',damage,{move,target:actor,critical},trace));
    }
    recover(actor,resource,amount,ctx={}){const before=actor[resource];actor[resource]=Math.min(actor.stats[resource],actor[resource]+Math.max(0,amount));const recovered=actor[resource]-before;if(recovered>0){actor.runtime.emit('OnResourceRecovered',{...ctx,resource,recovered});if(resource==='hp')actor.runtime.emit('OnHPChanged',{...ctx});}return recovered;}
    receiveDamage(actor,target,amount,move,critical=false,secondary=false){
      const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;amount-=absorbed;
      if(amount>=target.hp){const lethal=target.runtime.emit('OnLethalDamage',{move,target:actor,secondary});if(lethal.prevented)amount=Math.max(0,target.hp-1);}
      const actual=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);
      const ctx={move,damage:actual,critical,secondary,target:actor};target.runtime.emit('OnDamageTaken',ctx);target.runtime.emit('OnHPChanged',ctx);return actual;
    }
    elapse(time) {
      const maximum = ultimateChargeCost(this.build.ultimate);
      const accumulated = this.charge + (time - this.time);
      this.charge = accumulated >= maximum - 1e-9 ? maximum : accumulated;
      this.time = time;
    }
    begin(actor, id, asUltimate = false) {
      if (this.phase !== 'fighting') return { ok: false, reason: '目前不在戰鬥中' };
      if (actor.cast) return { ok: false, reason: '正在讀條中' };
      const move = this.getMove(id, actor);
      if (!move || (actor === this.player && !this.build.moves.includes(id) && this.build.ultimate !== id)) return { ok: false, reason: '未配置此招式' };
      const isUltimate = actor === this.player && this.build.ultimate === id && asUltimate;
      if (isUltimate && this.charge < ultimateChargeCost(id)) return { ok: false, reason: '必殺技尚未充能完成' };
      for (const [resource, cost] of Object.entries(move.cost)) if (actor[resource] < cost) return { ok: false, reason: '資源不足' };
      for (const [resource, cost] of Object.entries(move.cost)) actor[resource] -= cost;
      if (isUltimate) this.charge = 0;
      const duration = this.castDuration(move,actor);
      actor.cast = { moveId: id, move, spent: {...move.cost}, startedAt: this.time, endAt: this.time + duration, duration };
      for(const [key,status]of Object.entries(actor.statuses))if(status.consume===move.damageType)delete actor.statuses[key];
      move.consumeReserved=true;
      actor.runtime.emit('OnResourceSpent',{move,spent:{...move.cost}});actor.runtime.emit('OnSkillCastStart',{move,spent:{...move.cost}});
      this.log('cast', `${actor.id === 'player' ? '你' : this.enemyDefinition.name}開始${move.name}（${duration.toFixed(2)} 秒）`, { actorId: actor.id, moveId: id });
      return { ok: true };
    }
    choose(id, asUltimate = this.build.ultimate === id && !this.build.moves.includes(id)) { return this.begin(this.player, id, asUltimate); }
    resolve(actor) {
      const cast=actor.cast,move=cast.move||this.getMove(cast.moveId,actor);actor.cast=null;
      const target=actor===this.player?this.enemy:this.player,ctx={actor,target,move,spent:cast.spent||move.cost,totalDamage:0,successfulSupport:false,healing:false};
      const hostile=move.multiplier>0||move.effects.some(e=>e.type==='interrupt'||e.status?.target==='enemy');let connected=!hostile;
      for(let hit=0;hit<(move.hits||1)&&hostile&&target.hp>0;hit++){
        if(actor.runtime.modify('accuracy',1,{move})<1&&this.rng()>actor.runtime.modify('accuracy',1,{move})){this.log('miss','MISS',{actorId:actor.id,targetId:target.id,moveId:move.id});continue;}
        if(this.rng()<this.rule('dodgeChance',target,{move})){if(target===this.player&&target.cast&&this.equipmentEffects.onDodgeShorten)target.cast.endAt=Math.max(this.time+.05,target.cast.endAt-this.equipmentEffects.onDodgeShorten);target.runtime.emit('OnDodge',{move,target:actor});this.log('dodge','閃避',{actorId:actor.id,targetId:target.id,moveId:move.id});continue;}
        connected=true;
        if(move.multiplier>0){const critical=this.rng()<this.rule('critChance',actor,{move});const damage=this.receiveDamage(actor,target,this.damageValue(actor,target,move,critical)/(move.hits||1),move,critical);
          ctx.totalDamage+=damage;this.log('damage',move.name+'造成 '+damage.toFixed(1)+' 傷害',{actorId:actor.id,targetId:target.id,moveId:move.id,damage,critical,hit:hit+1});
          if(damage>0)actor.runtime.emit('OnDamageDealt',{...ctx,damage,critical});if(critical)actor.runtime.emit('OnCriticalHit',{...ctx,damage,critical});
        }
      }
      if(connected)for(const effect of move.effects){const handler=R.effects[effect.type];if(!handler)throw Error('Unknown move effect '+effect.type);handler(this,ctx,effect);}
      actor.runtime.emit('OnSkillCastFinished',ctx);actor.runtime.emit(move.damageType==='physical'?'OnPhysicalSkillFinished':move.damageType==='magic'?'OnMagicSkillFinished':'OnSpellFinished',ctx);
      if(target.hp<=0)this.finish(target===this.enemy);else if(actor.hp<=0)this.finish(actor!==this.player);
    }
    statusDeadline(){let next=Infinity;for(const a of [this.player,this.enemy])for(const s of Object.values(a.statuses))next=Math.min(next,s.expiresAt,s.tick?s.nextTick:Infinity);return next;}
    processStatuses(){for(const actor of [this.player,this.enemy])for(const [id,s]of Object.entries(actor.statuses)){
      if(s.tick&&s.nextTick<=this.time&&s.nextTick<=s.expiresAt){const source=this[s.sourceId],move={id:'status:'+id,name:s.name,damageType:'magic',elements:[],tags:[],effects:[]};const damage=this.receiveDamage(source,actor,s.tickDamage||0,move,false,true);this.log('damage',s.name,{actorId:source.id,targetId:actor.id,moveId:move.id,damage,critical:false,secondary:true});s.nextTick+=s.tick.interval;if(actor.hp<=0){this.finish(actor===this.enemy);return;}}
      if(s.expiresAt<=this.time)delete actor.statuses[id];
    }}
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw Error('時間步長必須是非負有限數');
      if (this.phase !== 'fighting') return;
      const until = this.time + seconds;
      while (this.phase === 'fighting') {
        if (!this.enemy.cast) this.begin(this.enemy, this.nextEnemyMove());
        // Explicit sandbox tie-break: player first; an interrupt can cancel the enemy's same-time action.
        const next = [this.player, this.enemy].filter(a => a.cast).sort((a, b) => a.cast.endAt - b.cast.endAt)[0];
        const deadline=this.statusDeadline(),castAt=next?.cast.endAt??Infinity;
        if(Math.min(deadline,castAt)>until)break;
        if(deadline<=castAt){this.elapse(deadline);this.processStatuses();}else {this.elapse(castAt);this.resolve(next);}
      }
      if (this.phase === 'fighting') this.elapse(until);
    }
    finish(won) {
      this.lastOutcome={won,enemyHP:this.enemy.hp,enemyMaxHP:this.enemy.stats.hp};
      this.player.runtime.emit('OnBattleEnd',{won}); this.enemy.runtime.emit('OnBattleEnd',{won:!won});
      this.player.cast = null; this.enemy.cast = null;
      if (won) { this.phase = 'victory'; if(!this.options.preserveResources)this.restore(); this.log('victory', this.options.preserveResources?'勝利！保留目前資源前往下一戰。':'勝利！血量、體力、魔力完全恢復。'); return; }
      this.run.deaths++;
      if (this.run.deaths >= 3) { this.phase = 'gameover'; this.run.status = 'failed'; this.log('death', '第三次死亡，本局結束。'); return; }
      const pool = D.debuffs.filter(d => !this.run.debuffIds.includes(d.id));
      const debuff = pool[Math.floor(this.rng() * pool.length)]; this.run.debuffIds.push(debuff.id);
      this.phase = 'revived'; this.resetActors();
      this.log('revive', `第 ${this.run.deaths} 次倒下後休養，留下 ${debuff.name}。`);
    }
    restore() { for (const key of ['hp', 'stamina', 'mana']) this.player[key] = this.player.stats[key]; }
  }
  const api = { Battle, grow, castSeconds, validateBuild, sandboxRules };
  if (typeof module !== 'undefined') module.exports = api; else root.BattleCore = api;
})(globalThis);
