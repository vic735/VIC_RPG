/* Factual combat contributions and permanent collection goals. */
(function(root){
 const D=typeof module!=='undefined'?require('./data'):root.GameData;
 const fresh=()=>({version:1,battles:0,damage:0,healing:0,shieldAbsorbed:0,manaSpent:0,staminaSpent:0,manaDelta:0,staminaDelta:0,byMove:{},sources:{}});
 function add(report,source,key,value=1){if(!Number.isFinite(value)||!value)return;if(source){const s=report.sources[source]||=( {} );s[key]=(s[key]||0)+value;}else report[key]=(report[key]||0)+value;}
 function commit(run,battle){if(battle.reportCommitted)return false;const report=run.buildReport||=fresh(),part=battle.buildReport;if(!part)return false;for(const k of ['damage','healing','shieldAbsorbed','manaSpent','staminaSpent','manaDelta','staminaDelta'])report[k]+=part[k]||0;for(const [id,v]of Object.entries(part.byMove))report.byMove[id]=(report.byMove[id]||0)+v;for(const [id,values]of Object.entries(part.sources))for(const [key,v]of Object.entries(values))add(report,id,key,v);report.battles++;battle.reportCommitted=true;return true;}
 const registry=kind=>({moves:D.moves,skills:D.skills,equipment:D.equipment,books:D.books})[kind];
 function owned(p,kind,id){const d=registry(kind)?.[id];if(!d)return false;return kind==='moves'?Object.keys(p.moves).some(k=>D.moves[k]===d):kind==='skills'?p.skills.some(k=>D.skills[k]===d):p[kind]?.includes(id);}
 function setTarget(p,kind,id){if(!registry(kind)?.[id])return false;p.meta||={};p.meta.collectionTarget={kind,id:registry(kind)[id].id};p.meta.revision=(p.meta.revision||0)+1;return true;}
 function target(p){const t=p.meta?.collectionTarget;return t&&registry(t.kind)?.[t.id]?{...t,data:registry(t.kind)[t.id],owned:owned(p,t.kind,t.id)}:null;}
 function remember(p,run){if(run.buildReviewSaved)return;p.meta||={};p.meta.lastJourney={items:Object.values(run.loot||{}).filter(x=>['moves','talents','equipment','books'].includes(x.kind)).map(x=>({kind:x.kind==='talents'?'skills':x.kind,id:x.id})),classId:run.activeClassId};p.meta.revision=(p.meta.revision||0)+1;run.buildReviewSaved=true;}
 function candidates(p){const t=target(p),items=[...(p.meta?.lastJourney?.items||[]),...(t?.owned?[t]:[])],seen=new Set();return items.filter(x=>{const key=x.kind+':'+x.id;if(seen.has(key)||!owned(p,x.kind,x.id))return false;seen.add(key);return x.kind!=='books';});}
 const api={fresh,add,commit,registry,owned,setTarget,target,remember,candidates};if(typeof module!=='undefined')module.exports=api;else root.BuildJourney=api;
})(globalThis);
