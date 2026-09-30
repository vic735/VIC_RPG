/* Indexed Trigger → Condition → Effect / Modifier runtime. No per-frame skill scan. */
(function(root){
 const D=typeof module!=='undefined'?require('./data.js'):root.GameData;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const isNonElementPhysical=move=>move?.damageType==='physical'&&(move.elements?.length||0)===0;
 const isNonElementMagic=move=>move?.damageType==='magic'&&(move.elements?.length||0)===0;
 function elementMultiplier(attack=[],defend=[]){let advantage=false,disadvantage=false;for(const a of attack)for(const d of defend){if(D.elementEdges[a]?.includes(d))advantage=true;else if(D.elementEdges[d]?.includes(a))disadvantage=true;}return advantage===disadvantage?1:advantage?1.5:.75;}
 function matches(c={},ctx){const {actor,target,move={},battle}=ctx;
  const originalTime=move.attackTimeBase??move.originalAttackTime??move.attackTime;
  if(c.damageType&&move.damageType!==c.damageType)return false;
  if(c.nonElementPhysical&&!isNonElementPhysical(move))return false;
  if(c.nonElementMagic&&!isNonElementMagic(move))return false;
  if(c.element&&!move.elements?.includes(c.element))return false;
  if(c.tag&&!move.tags?.includes(c.tag))return false;
  if(c.anyTag&&!c.anyTag.some(t=>move.tags?.includes(t)))return false;
  if(c.weapon&&actor.weaponType!==c.weapon)return false;
  if(c.anyWeapon&&!c.anyWeapon.includes(actor.weaponType))return false;
  if(c.anyKind&&!c.anyKind.some(k=>move.specKind===k||move.kind===k||move.damageType===k))return false;
  if(c.kind&&move.specKind!==c.kind&&move.kind!==c.kind&&move.damageType!==c.kind)return false;
  if(c.moveCostMana&&!move.cost?.mana)return false;
  if(c.moveCostStamina&&!move.cost?.stamina)return false;
  if(c.isUltimate!=null&&!!move.isUltimate!==c.isUltimate)return false;
  if(c.hpRatioLt!=null&&!(actor.hp/actor.stats.hp<c.hpRatioLt))return false;
  if(c.hpRatioLte!=null&&!(actor.hp/actor.stats.hp<=c.hpRatioLte))return false;
  if(c.hpRatioGt!=null&&!(actor.hp/actor.stats.hp>c.hpRatioGt))return false;
  if(c.hpRatioGte!=null&&!(actor.hp/actor.stats.hp>=c.hpRatioGte))return false;
  if(c.chargeFull&&battle.charge<(D.moves[battle.build.ultimate]?.ultimateChargeCost||100))return false;
  if(c.originalTimeLt!=null&&!(originalTime<c.originalTimeLt))return false;
  if(c.originalTimeGte!=null&&!(originalTime>=c.originalTimeGte))return false;
  if(c.targetCasting&&!target?.cast)return false;
  if(c.targetStatus&&!target?.statuses[c.targetStatus])return false;
  if(c.targetAnyStatus&&!c.targetAnyStatus.some(id=>target?.statuses[id]?.expiresAt>battle.time))return false;
  if(c.targetDebuff&&!Object.values(target?.statuses||{}).some(s=>s.polarity==='debuff'&&s.expiresAt>battle.time))return false;
  if(c.resource){const ratio=(c.resourceTiming==='beforeCast'?(move.resourcesBeforeCast?.[c.resource]??actor[c.resource]):actor[c.resource])/Math.max(1,actor.stats[c.resource]);if(c.ratioLt!=null&&!(ratio<c.ratioLt))return false;if(c.ratioLte!=null&&!(ratio<=c.ratioLte))return false;if(c.ratioGt!=null&&!(ratio>c.ratioGt))return false;if(c.ratioGte!=null&&!(ratio>=c.ratioGte))return false;}
  if(c.critical!=null&&ctx.critical!==c.critical)return false;
  if(c.primary&&ctx.secondary)return false;
  if(c.alive&&actor.hp<=0)return false;
  if(c.totalDamagePositive&&!(ctx.totalDamage>0))return false;
  if(c.spent&&!(ctx.spent?.[c.spent]>0))return false;
  if(c.healing&&!ctx.healing)return false;
  if(c.successfulSupport&&!ctx.successfulSupport)return false;
  return true;
 }
 class Runtime{
  constructor(battle,actor,sources=[]){this.battle=battle;this.actor=actor;this.sources=sources;this.hooks=new Map();this.modifiers=new Map();this.once=new Set();
   for(const source of sources){for(const h of source.hooks||[]){const list=this.hooks.get(h.event)||[];list.push({...h,source:source.id,name:source.name});this.hooks.set(h.event,list);}for(const m of source.combatModifiers||[]){const list=this.modifiers.get(m.stage)||[];list.push({...m,source:source.id,name:source.name});this.modifiers.set(m.stage,list);}}
  }
  context(extra={}){return {battle:this.battle,actor:this.actor,target:this.actor===this.battle.player?this.battle.enemy:this.battle.player,...extra,actor:this.actor,battle:this.battle};}
  list(stage,ctx){const transient=Object.values(this.actor.statuses).filter(s=>s.expiresAt>this.battle.time).flatMap(s=>(s.modifiers||[]).map(m=>({...m,name:s.name,source:s.id})));return [...(this.modifiers.get(stage)||[]),...transient.filter(m=>m.stage===stage)].filter(m=>matches(m.conditions,this.context(ctx)));}
  elementTotals(elements=[],trace){const unique=[...new Set(elements||[])],totals={damageBonus:0,costReduction:0,incomingReduction:0,absorbToMp:0};if(!unique.length)return totals;for(const source of this.sources){if(!source.targetElements?.some(e=>unique.includes(e)))continue;totals.damageBonus+=source.elementDamageBonusPct||0;totals.costReduction+=source.elementCostReductionPct||0;totals.incomingReduction+=source.incomingElementDamageReductionPct||0;totals.absorbToMp+=source.damageToMpAbsorbPct||0;if(trace&&(source.elementDamageBonusPct||source.elementCostReductionPct||source.incomingElementDamageReductionPct||source.damageToMpAbsorbPct))trace.add(source.name);}return totals;}
  modify(stage,value,ctx={},trace){const mods=this.list(stage,ctx);let add=0,multiply=1;for(const m of mods){const v=m.perInjury!=null?1+Math.min(2,this.battle.run.debuffIds.length)*m.perInjury:m.value;if(m.op==='add')add+=v;else multiply*=v;if(trace)trace.add(m.name);}return (value+add)*multiply;}
  emit(event,extra={}){const ctx=this.context(extra);for(const h of this.hooks.get(event)||[]){const key=h.source+':'+event;if(h.once&&this.once.has(key)||!matches(h.conditions,ctx))continue;if(h.once)this.once.add(key);let triggered=false;for(const e of h.effects||[]){const handler=effects[e.type];if(!handler)throw Error('Unknown effect '+e.type);triggered=handler(this.battle,ctx,e)!==false||triggered;}if(triggered)this.battle.log('skill',h.name,{actorId:this.actor.id,skillId:h.source,duration:.8});}return ctx;}
 }
 function applyStatus(b,actor,s,source,ctx={}){
  if(!s.id||!Number.isFinite(s.duration)||s.duration<=0)throw Error('狀態必須具有正數持續時間');
  if(s.tick&&(!Number.isFinite(s.tick.interval)||s.tick.interval<=0||!Number.isFinite(s.tick.ratio)||s.tick.ratio<0||!Object.hasOwn(source.stats,s.tick.stat)))throw Error('狀態週期格式無效');
  for(const m of s.modifiers||[])if(!Number.isFinite(m.value))throw Error('狀態修正必須為有限數值');
  const incoming=clone(s),previous=actor.statuses[s.id];delete incoming.target;
  const strength=s.strength??(s.modifiers||[]).reduce((v,m)=>v+Math.abs(m.value-(m.op==='add'?0:1)),s.tick?.ratio||0);
  const previousStrength=previous?.strength||0;const chosen=previous&&previousStrength>strength?previous:incoming;
  actor.statuses[s.id]={...chosen,strength:Math.max(strength,previousStrength),expiresAt:b.time+s.duration,duration:s.duration,sourceId:source.id,nextTick:previous?.nextTick??b.time+(s.tick?.interval||1)};
  if(s.tick&&(!previous||strength>=previousStrength))actor.statuses[s.id].tickDamage=source.stats[s.tick.stat]*s.tick.ratio;
  actor.runtime.emit('OnStatusApplied',{...ctx,status:actor.statuses[s.id]});return true;
 }
 const effects={
  freeze(b,c,e){const target=c.target;if(target.hp<=0||(target.freezeImmuneUntil||0)>b.time)return false;const boss=target===b.enemy&&(b.enemyDefinition.boss||b.enemyDefinition.balanceRole==='boss'||b.enemyDefinition.balanceRole==='importantBoss'),duration=e.duration*(boss?.5:1);if(target.cast){target.cast.endAt+=duration;target.cast.duration+=duration;}if(target.sequence)target.sequence.nextAt+=duration;applyStatus(b,target,{id:'frozen',name:'凍結',duration,polarity:'debuff',modifiers:[],blocksAction:true},c.actor,c);target.freezeImmuneUntil=b.time+duration+3;c.successfulSupport=true;b.log('freeze','凍結：暫時無法行動',{actorId:c.actor.id,targetId:target.id,moveId:c.move.id,duration});return true;},
  drain(b,c,e){if(!(c.totalDamage>0)||c.actor.hp<=0)return false;const amount=c.totalDamage*e.ratio,healing=b.recover(c.actor,e.resource||'hp',amount,c);if(healing>0)b.log('heal','吸魂恢復 '+healing.toFixed(1)+' HP',{actorId:c.actor.id,targetId:c.actor.id,moveId:c.move.id,healing});return healing>0;},
  recover(b,c,e){b.recover(c.actor,e.resource,c.actor.stats[e.resource]*e.ratio,c);},
  heal(b,c,e){const amount=c.actor.runtime.modify('healing',c.actor.stats.hp*e.ratio,c),healing=b.recover(c.actor,'hp',amount,c);if(healing>0)b.log('heal',`恢復 ${healing.toFixed(1)} HP`,{actorId:c.actor.id,targetId:c.actor.id,moveId:c.move.id,healing});c.healing=true;c.successfulSupport=true;},
  restore(b,c,e){b.recover(c.actor,e.resource,e.amount,c);},
  status(b,c,e){const target=e.status.target==='self'?c.actor:c.target;applyStatus(b,target,{...e.status,elements:e.status.elements||c.move?.elements||[]},c.actor,c);c.successfulSupport=true;},
  refresh(b,c,e){const s=c.target.statuses[e.id];if(!s)return false;s.expiresAt=b.time+s.duration;},
  refund(b,c,e){for(const [key,value]of Object.entries(c.spent||{}))b.recover(c.actor,key,value*e.ratio,c);},
  preventInterrupt(b,c){c.prevented=true;},
  interrupt(b,c,e){if(!c.target.cast)return false;const baseChance=Math.min(1,c.actor.runtime.modify('interruptChance',e.chance??1,c)),chance=Math.max(0,Math.min(1,c.target.runtime.modify('incomingInterruptChance',baseChance,{move:c.move,target:c.actor})));if(chance<1&&b.rng()>=chance)return false;const received=c.target.runtime.emit('OnInterruptReceived',{move:c.move,target:c.actor});if(received.prevented)return false;c.target.cast=null;c.successfulSupport=true;b.log('interrupt','讀條遭到中斷。',{actorId:c.actor.id,targetId:c.target.id,moveId:c.move.id});c.actor.runtime.emit('OnInterruptSuccess',c);},
  echo(b,c,e){if(c.totalDamage<=0||c.target.hp<=0)return false;return b.queueEcho(c,e.ratio);},
  shield(b,c,e){c.actor.shield=Math.max(c.actor.shield,c.actor.stats.hp*e.ratio);},
  cleanse(b,c,e){const ids=Object.entries(c.actor.statuses).filter(([,s])=>s.polarity==='debuff').map(([id])=>id);for(const id of ids.slice(0,e.count||ids.length))delete c.actor.statuses[id];return ids.length>0;},
  charge(b,c,e){const maximum=D.moves[b.build.ultimate]?.ultimateChargeCost||100;b.charge=Math.min(maximum,b.charge+(e.amount||maximum*(e.ratio||0)));return true;},
  survive(b,c,e){const chance=Math.min(e.cap,c.actor.stats.luck*e.luckRate);if(b.rng()<chance)c.prevented=true;}
 };
 const api={Runtime,matches,elementMultiplier,isNonElementPhysical,isNonElementMagic,applyStatus,effects};if(typeof module!=='undefined')module.exports=api;else root.SkillRuntime=api;
})(globalThis);
