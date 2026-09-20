/* Cosmetic counters only. Progression grants all stats before this panel opens. */
(function(root){
 const labels={hp:'生命 HP',mana:'魔力 MP',stamina:'體力 SP',agility:'敏捷',luck:'運氣'};
 const format=n=>Number(n.toFixed(1)).toLocaleString('zh-TW');
 function value(from,to,time,delay=0,reduced=false){if(reduced)return to;const t=Math.max(0,Math.min(1,(time-delay)/1.25));return from+(to-from)*(1-Math.pow(1-t,3));}
 function html(exp){if(!exp.beforeStats||!exp.afterStats)return '';return `<section class="growth-celebration" aria-label="本次升級提升"><div class="growth-level"><small>Lv.${exp.beforeLevel} →</small><strong id="growth-level-number" aria-hidden="true">${exp.beforeLevel}</strong><span>LEVEL</span><b>＋${exp.levels} 級</b></div><p class="growth-caption">全能力成長</p><div class="growth-stats">${Object.entries(labels).map(([key,label],i)=>`<div class="growth-row" style="--row:${i}"><span>${label}</span><small>${format(exp.beforeStats[key])} →</small><strong id="growth-${key}" aria-hidden="true">${format(exp.beforeStats[key])}</strong><b>＋${format(exp.afterStats[key]-exp.beforeStats[key])}</b><span class="sr-only">提升至 ${format(exp.afterStats[key])}</span></div>`).join('')}</div></section>`;}
 function update(exp,time,reduced=false){if(!exp.beforeStats||!exp.afterStats)return;document.getElementById('growth-level-number').textContent=String(Math.round(value(exp.beforeLevel,exp.afterLevel,time,0,reduced)));Object.keys(labels).forEach((key,i)=>{document.getElementById('growth-'+key).textContent=format(value(exp.beforeStats[key],exp.afterStats[key],time,.15+i*.09,reduced));});}
 const api={value,html,update};if(typeof module!=='undefined')module.exports=api;else root.LevelUp=api;
})(globalThis);
