/* Progressive enhancement: file:// and ordinary LAN HTTP remain playable online. */
(function(){
 const label=document.getElementById('offline-status');
 const say=text=>{globalThis.GameOffline={status:text};if(label)label.textContent=text;const detail=document.querySelector('#offline-detail');if(detail)detail.textContent=text;};
 if(typeof navigator==='undefined'||typeof location==='undefined')return;
 if(!isSecureContext||!('serviceWorker' in navigator)||location.protocol==='file:'){say('離線下載需以 HTTPS 網址開啟；目前仍可自動存檔。');return;}
 say('正在下載離線遊戲，請保持連線…');
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{
  let controllerChanged=false;
  const check=()=>{if(reg.active)say('離線遊戲已備妥 · 可斷網重開；可加入主畫面');if(reg.waiting)say('新版正在完整下載，完成後會自動套用。');};
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controllerChanged)return;controllerChanged=true;say('新版離線資源已更新；重新整理後載入最新畫面。');});
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='redundant'&&!reg.active)say('離線下載未完成，請連網重新整理後重試。');else check();});});
  check();
  try{await reg.update();}catch(_){/* Existing complete cache remains available while offline. */}
  await navigator.serviceWorker.ready;check();
 }).catch(()=>say('離線下載失敗，請保持連網並重新整理重試。'));
})();
