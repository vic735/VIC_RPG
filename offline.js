/* Progressive enhancement: file:// and ordinary LAN HTTP remain playable online. */
(function(){
 const label=document.getElementById('offline-status');
 const say=text=>{globalThis.GameOffline={status:text};if(label)label.textContent=text;const detail=document.querySelector('#offline-detail');if(detail)detail.textContent=text;};
 if(typeof navigator==='undefined'||typeof location==='undefined')return;
 if(!isSecureContext||!('serviceWorker' in navigator)||location.protocol==='file:'){say('離線下載需以 HTTPS 網址開啟；目前仍可自動存檔。');return;}
 say('正在下載離線遊戲，請保持連線…');
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{
  const check=()=>{if(reg.active)say('離線遊戲已備妥 · 可斷網重開；可加入主畫面');if(reg.waiting)say('新版已下載 · 關閉所有遊戲分頁再開啟即可更新');};
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='redundant'&&!reg.active)say('離線下載未完成，請連網重新整理後重試。');else check();});});
  check();await navigator.serviceWorker.ready;check();
 }).catch(()=>say('離線下載失敗，請保持連網並重新整理重試。'));
})();
