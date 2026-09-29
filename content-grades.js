/* Unified C–SS content grades. Grades describe power/rarity; they do not add hidden stats. */
(function(root){
 const grades=['C','B','A','S','SS'],rarityGrade={common:'C',uncommon:'B',rare:'A',epic:'S',legendary:'SS'};
 const rank=g=>Math.max(0,grades.indexOf(g));
 function moveGrade(m,bookMoves){
  if(m.powerGrade)return m.powerGrade;
  let score=0,floor=rarityGrade[m.rarity]||'C';
  if(m.shopTier)score+=(m.shopTier-1)*2;
  if(m.shopEligible===false){const resourceCost=m.baseCost||Object.values(m.cost||{}).reduce((sum,value)=>sum+value,0);score+=2.5+resourceCost/9;if(resourceCost>=14)score=Math.max(score,5.5);if(resourceCost>=16&&((m.elements||[]).length>=2||(m.multiplier||0)>=1.8))score=Math.max(score,8);}
  score+=Math.max(0,(m.multiplier||0)-1)*1.5;
  score+=Math.max(0,(m.hits||1)-1)*.35;
  score+=(m.effects||[]).length*.45;
  score+=Math.max(0,(m.elements||[]).length-1)*1.2;
  if(['heal','defense','control'].includes(m.specKind))score+=.8;
  if(m.kind==='ultimate')score+=2;
  if(m.contentScope==='classExclusive')score=Math.max(score,4);
  if(bookMoves.has(m.id))score=Math.max(score,(m.elements||[]).length>=2||(m.multiplier||0)>=2?8:5.5);
  const calculated=score>=8?'SS':score>=5.5?'S':score>=3.3?'A':score>=1.6?'B':'C';
  return rank(calculated)>rank(floor)?calculated:floor;
 }
 function multis(m){return (m.elements||[]).length+(m.multiplier||0)/3;}
 function skillGrade(s){
  if(s.powerGrade)return s.powerGrade;
  if(/^(metal|wood|water|fire|earth|light|dark)_affinity$/.test(s.id))return 'B';
  if(/^element_(metal|wood|water|fire|earth|light|dark)_blessing$/.test(s.id))return 'A';
  if(/^element_(metal|wood|water|fire|earth|light|dark)_grace$/.test(s.id))return 'S';
  if(/^element_(metal|wood|water|fire|earth|light|dark)_authority$/.test(s.id))return 'SS';
  if(/^element_(metal|wood|water|fire|earth|light|dark)_resistance$/.test(s.id))return 'B';
  if(/^element_(metal|wood|water|fire|earth|light|dark)_immunity$/.test(s.id))return 'A';
  if(/^element_(metal|wood|water|fire|earth|light|dark)_absorb$/.test(s.id))return 'S';
  const floor=rarityGrade[s.rarity]||'C';
  let score=(s.combatModifiers||[]).length*.8+(s.hooks||[]).length*1.2+Object.keys(s.modifiers||{}).length*.6+Object.keys(s.statRates||{}).length*.9+Object.keys(s.growthRates||{}).length*.8;
  score+=(s.elementDamageBonusPct||0)*6+(s.incomingElementDamageReductionPct||0)*5+(s.damageToMpAbsorbPct||0)*8;
  if(s.contentScope==='classExclusive')score=Math.max(score,3.5);
  let calculated=score>=6.5?'SS':score>=4.5?'S':score>=2.8?'A':score>=1.4?'B':'C';
  if(floor==='A'&&(s.damageToMpAbsorbPct||score>=3.2))calculated='S';
  return rank(calculated)>rank(floor)?calculated:floor;
 }
 function equipmentGrade(e){
  if(e.powerGrade)return e.powerGrade;
  const fixed=rarityGrade[e.rarity];if(fixed&&fixed!=='C')return fixed;
  let score=Object.values(e.modifiers||{}).reduce((n,v)=>n+Math.abs(v),0)/12+(e.physicalMultiplier?2:0)+(e.hooks||[]).length*1.5+(e.onDodgeShorten?1.5:0);
  if(e.acquisitionTier==='easy')return 'C';
  return score>=2.6?'A':'B';
 }
 function apply(D){
  const bookMoves=new Set(Object.values(D.books||{}).map(b=>b.moveId));
  for(const m of new Set(Object.values(D.moves||{})))m.powerGrade=moveGrade(m,bookMoves);
  for(const s of new Set(Object.values(D.skills||{})))s.powerGrade=skillGrade(s);
  for(const e of Object.values(D.equipment||{}))e.powerGrade=equipmentGrade(e);
  D.contentGrades=grades;D.contentGradeRank=rank;return D;
 }
 if(typeof module!=='undefined')module.exports=apply;else root.ContentGrades=apply;
})(globalThis);
