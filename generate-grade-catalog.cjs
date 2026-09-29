const fs=require('node:fs'),D=require('./data');require('./content-v1');require('./classes');
const grades=D.contentGrades,unique=o=>[...new Set(Object.values(o))],slot={head:'頭部',chest:'身體',arms:'手部',feet:'腳部',weapon:'武器'};
const sections=[['招式',unique(D.moves).filter(x=>!['enemy'].includes(x.contentScope))],['技能',unique(D.skills)],['裝備',Object.values(D.equipment)]];
let out='# AFTERLIGHT v0.19.1 品級與取得來源完整清單\n\n品級僅代表內容強度與稀有度分類，不會額外提供隱藏倍率。\n\n';
for(const [title,items]of sections){out+=`# ${title}（${items.length}）\n\n`;for(const grade of grades){const rows=items.filter(x=>x.powerGrade===grade).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));out+=`## ${grade} 級（${rows.length}）\n\n`;for(const x of rows){const subtitle=x.subtitle&&x.subtitle!==x.name?`／${x.subtitle}`:'',extra=title==='裝備'?` · ${slot[x.slot]||x.slot}${x.weaponType?'／'+({sword:'劍',bow:'弓',blunt:'鈍器',staff:'法杖'}[x.weaponType]||x.weaponType):''}`:title==='招式'?` · ${x.damageType==='physical'?'物理':x.damageType==='magic'?'魔法':'特殊'}`:` · ${x.category||'技能'}`;out+=`- **${x.name}${subtitle}**${extra}\n`;}out+='\n';}}
fs.writeFileSync('CONTENT-GRADES-0.19.1.md',out,'utf8');
console.log('Wrote CONTENT-GRADES-0.19.1.md');




