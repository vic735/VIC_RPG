/* Fixed first-visit course. Practice uses the same course with an isolated player. */
(function(root){
 const D=typeof module!=='undefined'?require('./data'):root.GameData;
 const map={id:'tutorial_court',name:'餘光試煉庭',regionId:'north_plains',starter:true,training:true,width:2200,height:1800,entry:{x:1100,y:900},recommendedLevelMin:1,recommendedLevelMax:9,sortOrder:0,color:'#344c3e',environmentId:'meadow',dungeonIds:['tutorial_vault'],spawnPoints:[],isAvailable:true,enemyPoolIds:[],elitePoolIds:[],bossType:'starter_tutorial_guardian'};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const base=D.monsters.greywind_0;for(const [id,name,hp,moves]of [['training_slime','溫順史萊姆',90,['goblin']],['training_caster','詠唱石偶',120,['fire']],['training_vault_slime','遺跡史萊姆',100,['goblin']],['training_vault_guard','遺跡守衛',140,['goblin','fire']],['starter_tutorial_guardian','試煉庭守關者',260,['goblin','crush']]])D.monsters[id]={...clone(base),id,name,training:true,trainingHP:hp,sprite:id.includes('slime')?'slime':'golem',moves,skills:[],behavior:'neutral',radius:0,dropChance:0,boss:id==='starter_tutorial_guardian',worldScale:id==='starter_tutorial_guardian'?1.6:1};
 D.maps[map.id]=map;
 const dungeon={...clone(D.dungeons.find(d=>d.id==='abandoned_mine')),id:'tutorial_vault',name:'初光遺跡',mapId:map.id,x:1320,y:1360,level:6,recommendedLevel:6,training:true,dungeonType:'training',features:['兩場短連戰','波間資源保留'],rewardTypes:[],enemyWaves:[{type:'training_vault_slime',role:'normal',level:5,trainingTargetLevel:7},{type:'training_vault_guard',role:'normal',level:7,trainingTargetLevel:9}]};
 D.trainingDungeon=dungeon;D.findDungeon=id=>D.dungeons.find(d=>d.id===id)||(id===dungeon.id?dungeon:null);
 const rewards=[{kind:'talents',id:'vitality'},{kind:'talents',id:'mana_boost'},{kind:'moves',id:'interrupt'}];
 const tasks=[
 {name:'中央營地',action:'移動到金色標記',x:820,y:900,text:'拖曳下方搖桿移動，放手停止。右上角可查看角色，左上角開啟設定。'},
 {name:'外側練習場',action:'靠近並挑戰史萊姆',x:700,y:600,text:'靠近後點互動鍵。普通招式消耗 MP／SP，讀條完成後發揮效果。長按招式可查看介紹。'},
 {name:'傳承石碑',action:'領取兩個技能與一個招式',x:1100,y:420,text:'生命強化與魔力強化是配置後自動生效的技能；震盪打擊是需要主動施放的招式。'},
 {name:'配置練習',action:'裝備生命強化、魔力強化、震盪打擊',x:1100,y:420,text:'從角色頁的調整招式技能進入，將三項能力放入欄位。普通招式和技能各最多四個。'},
 {name:'詠唱試煉場',action:'中斷石偶一次，再擊敗它',x:1550,y:620,text:'等石偶開始讀條，再使用震盪打擊。普通攻擊不一定能中斷。若未完成中斷，可重新挑戰。'},
 {name:'探索庭園',action:'調查祭壇並選擇契約',x:1580,y:1040,text:'探索事件可能給予本局效果。此契約會增加最大 MP、降低最大 SP，可以接受或拒絕。'},
 {name:'初光遺跡',action:'完成地下城兩場連戰',x:1320,y:1360,text:'兩場之間 HP／MP／SP 保留，通關離開後回復。完成課程會取得教學經驗，升至 Lv.9。'},
 {name:'中央守關者',action:'擊敗守關者',x:1100,y:690,text:'運用招式、被動技能與讀條判斷。擊敗後由 E 升至 D−，走到地圖邊緣可選擇七大區。'},
 {name:'旅途啟程',action:'前往邊緣傳送點',x:2140,y:900,text:'收藏會留下。前兩次倒下會休養，第三次結算本局；旅者徽記可到商店換取能力。圖鑑可查效果與取得來源，魔法書需要前置條件。必殺仍於首次完整冒險結算後解鎖。'}
 ];
 function start(run,practice=false){run.training={version:1,stage:0,practice,interrupted:false};run.starter={version:1,mapId:map.id,phase:'training',bossId:'tutorial-guardian'};run.currentMapId=map.id;run.position={...map.entry};run.mapPositions={};run.world.enemies=[];run.adventurerRank.index=-1;ensure(run);return map;}
 function ensure(run){const t=run.training;if(!t||run.currentMapId!==map.id)return;const specs=[{stage:1,id:'tutorial-first',type:'training_slime',x:700,y:600,level:1,trainingTargetLevel:3},{stage:4,id:'tutorial-caster',type:'training_caster',x:1550,y:620,level:3,trainingTargetLevel:5}];for(const e of specs)if(t.stage===e.stage&&!run.world.enemies.some(x=>x.id===e.id))run.world.enemies.push({...e,mapId:map.id,regionId:map.regionId,homeX:e.x,homeY:e.y,defeatedUntil:0,discovered:true,quickBattleAllowed:false});run.world.enemies=run.world.enemies.filter(e=>e.boss||e.stage===t.stage);}
 function task(run){return run?.training&&run.currentMapId===map.id?tasks[run.training.stage]:null;}
 function advance(run){run.training.stage=Math.min(8,run.training.stage+1);ensure(run);}
 function update(run){if(!task(run))return false;const t=run.training;if(t.stage===0&&Math.hypot(run.position.x-820,run.position.y-900)<85){advance(run);return true;}if(t.stage===3&&rewards.every(r=>run.build[r.kind].includes(r.id))){advance(run);return true;}return false;}
 function objects(run){const q=task(run);if(!q||![0,2,3,5].includes(run.training.stage))return [];return [{id:'tutorial-station-'+run.training.stage,kind:'training-station',visual:run.training.stage===5?'altar':'clue',name:q.name,action:'查看',x:q.x,y:q.y}];}
 function victory(run,e){if(!run.training||run.currentMapId!==map.id)return;if(e.id==='tutorial-first'&&run.training.stage===1)advance(run);else if(e.id==='tutorial-caster'&&run.training.stage===4){if(run.training.interrupted)advance(run);else{const target=run.world.enemies.find(x=>x.id===e.id);if(target)target.defeatedUntil=0;}}else if(e.id===run.starter.bossId)run.training.stage=8;}

 const combatSteps={
  overview:{card:true,title:'先認識戰鬥畫面',text:'上半部只顯示敵人：HP 歸零就能擊敗它，讀條完成時它會出招。中間是你的 HP／MP／SP 和讀條。下半部四個方向是普通招式，中央圓形是必殺；必殺於首次完整冒險結算後解鎖。接下來實際試用物理和魔法招式。',next:'physical'},
  physical:{target:'quick',paused:true,title:'第一招：快速斬擊',text:'點亮起的快速斬擊。這是物理招式，施放時先消耗 SP。'},
  physicalCast:{paused:false,title:'等待你的讀條',text:'SP 已扣除。讀條完成才會命中，讀條期間不能連續出招。'},
  physicalDone:{card:true,title:'物理招式已命中',text:'敵人的 HP 已減少。剛才消耗的是 SP（體力），不是你的 HP。現在換一招魔法，觀察 MP 的變化。',next:'magic'},
  magic:{target:'fire',paused:true,title:'第二招：火球術',text:'點亮起的魔法招式。上排大字是魔法名稱，下排小字是中文名稱；這次會消耗 MP。'},
  magicCast:{paused:false,title:'魔法正在詠唱',text:'MP 已扣除。看你的讀條走完，再確認敵人的 HP 下降。'},
  completeCard:{card:true,title:'現在由你完成戰鬥',text:'HP 是生命、MP 供魔法使用、SP 供物理招式使用。招式按鈕會顯示消耗和可施放狀態；長按可查效果。接下來交替使用兩種招式，擊敗史萊姆。',next:'free'},
  interruptOverview:{card:true,title:'這次練習中斷',text:'石偶已開始詠唱。點震盪打擊，等待你的招式完成；它的中斷效果會打斷敵人讀條。普通傷害不代表一定能中斷。',next:'interruptReady'},
  interruptReady:{target:'interrupt',paused:true,title:'打斷石偶的詠唱',text:'敵人正在讀條。點亮起的震盪打擊，現在不必趕時間。'},
  interruptCast:{paused:false,title:'等待震盪打擊命中',text:'留意敵人讀條：中斷成功會重啟它的施放。'},
  interruptDone:{card:true,title:'中斷成功',text:'震盪打擊已真正打斷敵人讀條。它需要重新詠唱，讓你多一段出手時間。接下來自由選招，擊敗石偶。',next:'free'}
 };
 function combatStart(run,e){if(!task(run))return;const t=run.training;if(e.id==='tutorial-first'){if(!t.combatLesson)t.combatLesson='overview';if(t.combatLesson==='physicalCast')t.combatLesson='physical';if(t.combatLesson==='magicCast')t.combatLesson='magic';}if(e.id==='tutorial-caster'){if(!t.interruptLesson)t.interruptLesson='interruptOverview';if(t.interruptLesson==='interruptCast')t.interruptLesson='interruptReady';}}
 function combatLesson(run,e){if(!task(run)||!e)return null;const key=e.id==='tutorial-first'?'combatLesson':e.id==='tutorial-caster'?'interruptLesson':null;if(!key)return null;const state=run.training[key],step=combatSteps[state];return step?{...step,key,state}:null;}
 function lessonNext(run,e){const q=combatLesson(run,e);if(!q?.card)return false;run.training[q.key]=q.next;return true;}
 function lessonSelected(run,e,id){const q=combatLesson(run,e);if(q?.target===id)run.training[q.key]={physical:'physicalCast',magic:'magicCast',interruptReady:'interruptCast'}[q.state];}
 function lessonEvent(run,e,event){const q=combatLesson(run,e);if(!q||event.actorId!=='player')return;if(event.type==='damage'&&event.targetId==='enemy'&&event.damage>0){if(q.state==='physicalCast'&&event.moveId==='quick')run.training.combatLesson='physicalDone';if(q.state==='magicCast'&&event.moveId==='fire')run.training.combatLesson='completeCard';}if(event.type==='dodge'&&event.targetId==='enemy'){if(q.state==='physicalCast')run.training.combatLesson='physical';if(q.state==='magicCast')run.training.combatLesson='magic';}if(event.type==='interrupt'&&q.state==='interruptCast'){run.training.interrupted=true;run.training.interruptLesson='interruptDone';}}
 function configTask(run){if(!task(run)||run.training.stage!==3)return null;const i=rewards.findIndex(r=>!run.build[r.kind].includes(r.id));if(i<0)return null;const r=rewards[i],list=run.build[r.kind];return {...r,step:i+1,index:list.length<4?list.length:3,name:(r.kind==='moves'?D.moves:D.skills)[r.id].name,text:r.kind==='moves'?'招式要放入 A／B／C／D 欄位，戰鬥時才能主動施放。':'技能要放入技能欄位，配置後會自動生效，不需要在戰鬥中按技能。'};}
 function giftClaimed(p){return !!p.meta?.tutorialGiftClaimed;}
 const api={map,dungeon,rewards,tasks,start,ensure,task,advance,update,objects,victory,giftClaimed,combatStart,combatLesson,lessonNext,lessonSelected,lessonEvent,configTask};D.training=api;if(typeof module!=='undefined')module.exports=api;else root.TrainingMap=api;
})(globalThis);
