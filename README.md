# AFTERLIGHT · 網頁版 v0.23.0

9:16 手機直式 Roguelite RPG，使用原生 JavaScript 與 Canvas。

## 遊玩與上傳

- 手動上傳包：上一層的 `AFTERLIGHT-web.zip`。解壓後將內容上傳到網站目錄。
- `index.html` 為網頁入口，依賴同目錄的程式與樣式；`PLAY.html` 是同一份遊戲的單檔版本。
- 區域網路測試：執行 `START-LAN.cmd` 或 `node server.cjs`，手機與電腦連同一網路。
- 手機離線與安裝需要 HTTPS；首次完整下載成功後可離線遊玩。詳見 [OFFLINE.md](OFFLINE.md)。

## 新手教學

首次開啟可直接開始教學或跳過。實際移動一小段後介紹互動鍵，首次战鬥前依序說明招式、資源、讀條與必殺。戰後介紹升級、新手 Boss 及局外收藏。教學視窗會暫停遊戲，進度可跨重整保存。

設定 → 新手教學 → 重看，可瀏覽所有教學頁。已有進度的玩家更新時不強制教學。

## 現行內容

- 七大區各五張正式地圖，另有七種隨機新手地圖。通行規則與配置見 `world-maps.js`。
- 當前內容表：[完整品級與取得來源](CONTENT-GRADES-DETAILED-0.23.0.html)。
- 最新更新：[v0.23.0 說明](UPDATE-0.23.0.md)。
- 角色設定支援能力、配置、裝備與搭配預設；冒險中角色頁可調整本局已取得的招式和技能。
- 升級自動提升五項能力，數字快速累加；整局结算列出成果、收穫與可展開的搭配戰績。

## 開發檔案

- `data.js`、`combat-content.js`、`world-content.js`、`content-v1.js`：資料與內容。`content-v1.js` 仍是現行遊戲依賴。
- `engine.js`、`skill-runtime.js`：時間軸戰鬥與技能效果。
- `progression.js`、`level-progression.js`、`encounters.js`：成長、獎勵與冒險者階級。
- `world.js`、`world-maps.js`、`run-exploration.js`：探索、地圖與局內事件。
- `app.js`、`screens.js`、`meta-screens.js`、`ui.js`、`style.css`：流程與介面。
- `run-save.js`、`meta.js`、`offline.js`、`sw.js`：存檔、局外進度與離線快取。
- `build-journey.js`：仍提供真實戰鬥統計，不能隨收藏規劃入口一起移除。
- `*.test.js`、`models.d.ts`、報表產生器及伺服器工具：開發與驗證用途，保留。

修改遊戲後執行 `node build.cjs`，同步產生 `PLAY.html` 與版本化 Service Worker。
測試檔請分別執行，例如 `node --test --test-isolation=none offline.test.js`。
實際戰鬥公式與平衡以程式及現行測試為準。

## 整理與存檔

旧版本说明、報表、套件和暫存檔存於專案根目錄的 `archive-unused-2026-09-30`。
每次新版完成後，將被取代且不再使用的檔案移到此備份目錄。
遊戲資源與玩家存檔分開保存；整理檔案和更新快取不可清除 LocalStorage 或 IndexedDB。

這次整理沒有修改遊戲行為，版本維持 v0.23.0。
