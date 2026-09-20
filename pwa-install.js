/* Mobile installation is progressive: Android exposes a prompt; iOS shows Safari instructions. */
(function () {
  const button = document.getElementById('pwa-install');
  const status = document.getElementById('offline-status');
  if (!button || !status || typeof window === 'undefined') return;
  const installableOrigin = window.isSecureContext && location.protocol !== 'file:';
  if (!installableOrigin) return;

  let installPrompt = null;
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '') && !window.MSStream;
  const setStatus = message => { status.textContent = message; };

  async function lockPortrait() {
    if (standalone() && screen.orientation?.lock) {
      try { await screen.orientation.lock('portrait'); } catch (_) {}
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
    button.textContent = '加入手機桌面';
    setStatus('離線遊戲已備妥 · 可加入手機桌面');
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    button.hidden = true;
    setStatus('已加入手機桌面 · 直式 App 模式已啟用');
  });

  if (standalone()) {
    button.hidden = true;
    setStatus('App 模式 · 直式遊玩 · 自動存檔');
    lockPortrait();
  } else if (isIOS()) {
    button.hidden = false;
    button.textContent = '加入手機桌面方式';
  }

  button.addEventListener('click', async () => {
    await lockPortrait();
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'dismissed') setStatus('尚未加入桌面；可稍後再試。');
      installPrompt = null;
      button.hidden = true;
    } else if (isIOS()) {
      setStatus('Safari 點「分享」→「加入主畫面」→「加入」');
    }
  });

  document.addEventListener('pointerdown', lockPortrait, { once: true, passive: true });
})();
