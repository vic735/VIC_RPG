# 離線遊玩與自動接續

## 目前已加入

- PWA manifest、主畫面圖示、直式獨立視窗。
- Service Worker 一次快取完整遊戲。只有全部下載成功才顯示「離線遊戲已備妥」。
- 首次下載完成後，同一網址可離線重新整理、關閉再開啟，不需電腦持續開機。
- 每秒及介面操作後自動儲存；切換到背景、pagehide 也嘗試立即儲存。強制終止前最多可能失去約一秒的變化。
- 保存本局位置、地圖敵人、等級、配置、地下城波次、戰鬥 HP/MP/SP、狀態、讀條、大絕充能、一次性技能與待領獎／待選能力。離開期間不推進時間。
- 重開自動接續並暫停等待操作；結果／領獎／新能力畫面恢復相應選擇，不重複發獎勵。
- 永久收藏與本局一起寫入單筆快照 `afterlight.session.v1`，舊收藏鍵保留相容。設定與開局配置維持原鍵。

## 手機首次使用

1. 將 AFTERLIGHT-web.zip 解壓後的內容完整放到支援 HTTPS 的靜態網站。index.html 與 sw.js 必須位於同一目錄；不要只上傳 PLAY.html。
2. 用手機瀏覽器開啟該固定 HTTPS 網址，保持連線，直到主選單底部或設定頁顯示「離線遊戲已備妥」。
3. Android Chrome 顯示「加入手機桌面」時點選它。iPhone/iPad Safari 則點「分享」→「加入主畫面」→「加入」。完成後由桌面圖示啟動。
4. 關閉網路後重新整理確認，再開始長時間遊玩。

加入桌面後，請從新出現的「餘光」圖示啟動，而不是從瀏覽器書籤開啟；它會以獨立 App 視窗執行。Android 可依 manifest 鎖定直式，iPhone/iPad 會維持直式版面並阻擋橫向操作。

完成安裝後，Android 的獨立視窗會依 manifest 鎖定直式。iPhone/iPad 的 Safari 不提供可靠的網頁方向鎖定 API；它仍以直式 App 版面開啟，若使用者旋轉裝置會顯示轉回直式的全畫面提示。

目前未部署公開網站，也沒有可提供給手機的新 HTTPS 網址。START-LAN.cmd 繼續提供區域網路 HTTP 試玩；它支援存檔，但手機不會啟用 Service Worker、安裝提示或離線 App。file:// 同樣不支援離線安裝。電腦 localhost 可用於開發驗證，手機 localhost 指的是手機自己，不是電腦。

此限制來自瀏覽器安全要求：[MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)。不建議用未受信任的自簽憑證或關閉瀏覽器安全檢查繞過。

## 更新與保存

每次執行 node build.cjs 會產生新的內容雜湊版本與 sw.js。網頁每次啟動都會主動檢查更新；有網路時資源優先從網站取得。新版 Service Worker 只有在完整下載所有離線資源後才會啟用並清理同一遊戲目錄的舊版 Cache；下載失敗時，舊版完整 Cache 會保留作為離線 fallback。新版套用後不會強制重整正在進行的遊戲，重新整理或下次開啟會載入最新畫面。Cache 清理絕不會清除 localStorage、IndexedDB 或玩家存檔。

離線可用不代表永久備份：清除網站資料、瀏覽器回收網站儲存空間、無痕模式資料消失，都可能移除快取或存檔。手機與電腦，以及不同網址／協定下的收藏不會同步。從 LAN HTTP 搬到 HTTPS 是不同網站來源，原收藏不會自動搬移。建議固定使用同一 HTTPS 網址、同一瀏覽器，避免多分頁同時玩同一存檔。

## 驗證

執行 node --test --test-isolation=none engine.test.js progression.test.js combat-v02.test.js ui-flow.test.js world-v1.test.js offline.test.js balance.test.js run-summary.test.js。

包含 Service Worker 安裝／失敗／斷網 fetch 測試、戰鬥快照結算一致、重新載入接續、獎勵不重發，以及既有世界／戰鬥回歸。Worker 使用模擬 Cache Storage，UI 使用 DOM 適配器；環境尚未完成真實手機瀏覽器離線重整、安裝與儲存回收測試。
