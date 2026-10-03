/* First-visit guidance is independent of player progression and run saves. */
(function(root){
 const KEY='afterlight.tutorial.v1';
 const cards={
 welcome:{title:'歡迎來到餘光',icon:'star',text:'每一局都是一段新的旅途。探索地圖、擊敗敵人，將學會的能力留給下一次出發。',tip:'教學可以隨時跳過，之後也能在設定重看。'},
 moveIntro:{title:'先走出第一步',icon:'wind',text:'拖曳畫面下方中央的搖桿移動，放手就會停止。',tip:'電腦可使用 WASD 或方向鍵。先試著走一小段。'},
 interactIntro:{title:'靠近，才會發現',icon:'book',text:'靠近可互動的敵人、地下城或探索物件，搖桿上方才會出現互動鍵。點一下就能挑戰或調查。',tip:'會追擊的敵人接觸你時也會進入戰鬥；電腦可按 E 互動。'},
 battleActions:{title:'四個方向，四個招式',icon:'sword',text:'下半部的大型操作區對應 A／B／C／D 四個招式。點按已配置的招式即可施放，空欄位目前不能使用。',tip:'電腦使用 WASD／方向鍵或 1～4。手機長按、電腦停留一會可查看效果。'},
 battleTiming:{title:'看讀條，再出招',icon:'orb',text:'招式會先消耗 MP 或 SP，再開始讀條；讀條完成才發揮效果。敵人的讀條也會顯示在畫面上。',tip:'MP 是魔力、SP 是體力。留意剩餘資源；具中斷效果的招式才有機會打斷敵人。'},
 battleUltimate:{title:'中央是你的必殺',icon:'star',text:'中央圓形按鈕是必殺技。首次完整冒險結算後才會永久解鎖，之後可在角色設定指定招式。',tip:'能量在本局各場戰鬥間保留。充滿後仍需足夠 MP／SP；電腦按 Space 施放。'},
 journeyIntro:{title:'讓收穫陪你再出發',icon:'hood',text:'升級會自動提升五項能力，不需要配點。新手區升至 Lv.9 後會出現守關 Boss，擊敗後走到地圖邊緣，選擇七大區。',tip:'前兩次倒下會休養，第三次結束本局。收藏永久保留，結算的旅者徽記可到商店換取能力。'}
 };
 const order=Object.keys(cards),stages=[...order,'moving','awaitBattle','awaitResult','done'];
 function load(storage){try{const raw=storage.getItem(KEY);if(raw){const s=JSON.parse(raw);if(s.version===1&&stages.includes(s.stage))return s;}const veteran=!!(storage.getItem('afterlight.progress.v2')||storage.getItem('afterlight.session.v1'));return {version:1,stage:veteran?'done':'welcome'};}catch(_){return {version:1,stage:'welcome'};}}
 function save(storage,state){try{storage.setItem(KEY,JSON.stringify(state));return true;}catch(_){return false;}}
 const api={KEY,cards,order,load,save};if(typeof module!=='undefined')module.exports=api;else root.GameTutorial=api;
})(globalThis);
