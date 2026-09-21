# AFTERLIGHT：Godot 遷移準備稽核

日期：2026-09-21。受查 Web release：0.7.1。範圍：本目錄的正式原始碼、建置與服務程式、資料契約和全部測試；工作區 `work/` 為歷史備份、模擬報表與驗證工具，不能當作正式資料來源。

本次只做 Audit 與計畫，未修改遊戲、平衡、UI、ID、存檔或 PWA。文件修訂不冒充新的遊戲發布；正式實作每階段須更新 `data.release` 並重新建置。

## 1. 結論

已有可在 Node 執行的戰鬥、技能、成長與獎勵核心，無需重寫引擎。最大風險是資料模組依順序修改共享 GameData、內容 ID 與 runtime ID 並存、Web controller 負責實質結算、存檔驗證兼做隱含升級。應先固定現有結果與 ID 映射，再逐段抽離。

## 2. 現有目錄與四層歸屬

目前是平面目錄，尚無正式 data/core/platform 分層。

| 檔案 | 現有角色／混合責任 | 建議方向 |
|---|---|---|
| data.js | 基礎內容、裝備、魔法書、平衡、成長、世界覆寫、release | 保留入口，建立最終資料 registry |
| combat-content.js | 屬性、招式、技能定義及 enrich 程式 | 定義與組裝分開 |
| world-content.js | 五區、敵人、生成點、地下城、獎勵池及生成邏輯 | 定義可匯出，保留現有座標 |
| content-v1.js | 100/72 規格、名稱匹配、alias、共享資料修改 | 改為明確 ID 映射後再輸出 JSON |
| classes.js / achievements.js | 職業／專屬內容、解鎖條件與進度邏輯 | Data + Core，保留解鎖規則 |
| engine.js / skill-runtime.js | Battle、消耗、傷害、狀態、技能事件 | Core，已有 headless 基礎 |
| progression.js | 成長、敵人縮放、地下城、獎勵、收藏存讀 | Core + Storage 邊界需拆開 |
| world-rewards.js / encounters.js | 抽獎、壓制、戰績、領獎 | Core，RNG 可注入但預設依賴全域 |
| meta.js | 商店 catalog、12h 時間窗、徽記、圖鑑 | Data + Core + 系統時間 |
| run-save.js | 快照資料、JSON、驗證、補欄位、Battle 重建、儲存 | Save Model + Storage |
| world.js | 移動、鄰近判定、道路／生成與 seeded RNG | Core + Web 世界幾何 |
| app.js | DOM、input、主迴圈、game state、存檔、結算、全螢幕 | 最主要的 Core / Web / Storage 混合點 |
| screens.js / meta-screens.js / ui.js | HTML、圖示、tooltip、衍生資料 | Presentation；商店 render 會呼叫 stock 修改 state |
| renderer.js / level-up.js | Canvas、特效／動畫、升級 DOM | Presentation |
| audio.js | Web Audio、音效、設定及 localStorage | Platform + Settings |
| offline.js / pwa-install.js / sw.js | PWA、Cache、更新／安裝 UI | Web Platform |
| debug-lab.js / world-debug.js | 測試配置、HTML 與資料檢視 | 工具層，不作正式規則來源 |
| models.d.ts | 舊版與新版型別並存，部分契約落後 runtime | 對照实际 state 補齊 |
| index.html / style.css | Web shell / 排版 | Presentation |
| build.cjs / PLAY.html / server.cjs | inline 打包、衍生產物、白名單 server | 建置／部署；新增檔必須同步處理 |
| *.test.js / *.md | 回歸測試、歷史設計記錄 | 基線證據；文件有過時內容 |

## 3. 內容實際來源與穩定 ID

`data.js` 組裝 combat/world enrich，後面仍有第一區與礦坑的資料覆寫。`content-v1.js` 再追加規格與 alias；職業內容由 `classes.js` 加入。不能把初始 data 物件直接當成最終遊戲資料匯出。

Node 載入 data + content-v1 的檢查：moves registry 184 個鍵、skills 126 個鍵；唯一 Mxxx contentId 為 100、Sxxx 為 72。鍵數包含 alias／其他內容，**不等於有 184 種可收集招式**；也不能刪除超出 100/72 的項目。職業專屬招式另外存在。

`content-v1.js:6–7` 透過正規化顯示名稱尋找舊資料，再令 `D.moves[Mxxx]`／`D.skills[Sxxx]` 指向該物件，因此 dictionary key、物件 id、contentId 不必相同；部分條目則建立新物件，例如檢查 M062 的 runtime id 也是 M062。翻譯或改名可能改變匹配結果，是優先處理風險。

保留每一個現有 runtime id 與 M001–M100 / S001–S072；registry 增加明確 canonical/alias 對照，讀舊存檔時接受原值，不能直接批次改成新命名。既有 region `greywind/verdant/redrift/froststorm/obsidian`、dungeon `abandoned_mine`、monster `greywind_0` 都已是 machine-readable ID，無需改名。

地下城 11 座、reward pool 38 組：主要於 world-content.js，data.js 與 content-v1.js 可能再修改內容。獎勵算法位於 world-rewards.js；發放與永久／局內更新在 progression.js，領取時機在 app.js。meta.js catalog 最終從有 contentId 且 shopEligible 的內容建立，不應匯出其前面的歷史 add 清單當作正式商品。

## 4. Web / 隨機 / 時間依賴盤點

正式 JS 搜尋結果（排除測試與生成的 PLAY.html）：

| API | 位置與用途 |
|---|---|
| document | app.js input/render/visibility/fullscreen；level-up.js 動畫；offline.js、pwa-install.js 狀態／安裝 |
| window | app.js 尺寸、事件、GameApp；pwa-install.js 平台判定 |
| localStorage | app.js:3 storage wrapper、:17 使用者明確重置；audio.js:5/:16 設定讀寫 |
| sessionStorage | 正式 JS 搜尋未發現直接使用 |
| Date.now | meta.js:23/:33 stock/buy；run-save.js:7 savedAt；meta-screens.js:5 倒數；app.js:477 刷新顯示；audio.js:12 hover 節流 |
| Math.random | engine.js:20；progression.js createRun/dungeonReward/battleFor；world-rewards.js pool/dungeon/enemy；encounters.js finishQuick；debug-lab.js、world-debug.js；renderer.js:179 視覺粒子 |
| navigator / serviceWorker | offline.js、pwa-install.js、app.js standalone 判定 |

大多數 core 亂數已有 rng 函式參數，這是可保留的接口；應用層尚未統一傳入且存檔未保存 RNG 狀態。world.js 有私有 seeded LCG；meta.js 商品亦有 epoch/tier 派生 seed。先保留各算法与呼叫順序，再包進統一 abstraction，避免重構改變掉落。特效 RNG 必須與遊戲 RNG 分離。

## 5. 戰鬥規則分布與 UI 越界

- engine.js：Battle.choose/advance、消耗、讀條、傷害、爆擊、效果、護盾、治療、中斷、必殺充能、勝負與傷勢；events 陣列輸出，沒有直接 DOM 動畫。
- skill-runtime.js：技能 hook、狀態、屬性、裝備修正等。combat-content.js / data.js 提供參數與效果定義。
- progression.js：角色成長、敵人等級／防禦／抗性、battleFor 規則組裝、EXP、波間資源、獎勵與 Build。
- encounters.js：壓制資格、正常擊敗記錄、壓制獎勵與战績；achievements.js / classes.js 消費戰鬥／地下城結果。
- app.js:185 chooseMove 已委派 Battle.choose，沒有在此直接扣 MP 算傷害，應保留。
- app.js:195 finishEncounter 實際複製死亡／傷勢、保留波間資源、解鎖必殺、算 EXP、重置野怪、更新成就與發掉落；continueResult 推進地下城與領獎；showResult 會結算徽記。這些應移入 application command，而不是只改 HTML 檔名。
- app.js:454 combatEvent 將事件轉成音效／Canvas／讀條動畫，方向正確。將現有 actorId/targetId/moveId/time/damage 等欄位正式化，別直接改名而破壞 renderer。

## 6. GameState 與存檔現況

| 分層 | 現有資料 |
|---|---|
| PermanentState | game.permanent：schemaVersion 2、moves 等級、skills、books、equipment、ultimates、ultimateUnlocked、dungeonCompletions、meta 徽記/商店/圖鑑、職業與成就 |
| RunState | game.run：schemaVersion 2、level/exp、allocated 舊欄位、injury/debuffIds、build、moveLevels、world/position、dungeon、ultimateCharge、loot、battleStats、defeatedEnemyTypesThisRun |
| CombatState | game.battle：Battle instance、雙方資源/狀態/護盾/cast、time/phase/charge、once Set、rules/rng/runtime |
| SettingsState | Audio.settings：sound/volume/reducedMotion/contrast/autoQuickBattle，與音效模組綁定 |
| PresentationState | screen/modal、keys/touch、toast、transition、特效、動畫計時；不可全部塞進可搬移存檔 |

四個儲存鍵：afterlight.progress.v2、afterlight.session.v1、afterlight.loadout.v1、afterlight.settings.v1。

run-save.pack 產生 `{version:1, worldVersion, savedAt, ...}`，JSON 複製本局／永久資料與領獎中間狀態；Battle runtime 被排除，once Set 轉陣列，load 重新建立 Battle。已有 storage 注入，尚未獨立 serializeSave/deserializeSave，也未打包 settings 作跨平台匯出。

相容目前依 load 內補欄位／normalize 完成，並無命名 migration chain。session version != 1 或 worldVersion 不符會拒絕接續；progress schema 不符會回傳初始收藏，後續儲存有覆寫風險。要先保留原文備份，實作明確遷移與拒絕覆寫未知新版本；不要把拒絕相容當成 migration。

永久與 session 用 meta.revision 判斷新舊，但其他欄位更新未必代表 meta revision 同步增加，須用存檔 fixture 覆蓋。JSON 不保存函式、rng、事件游標與完整 runtime；未來重建規則需明確區分 definitions/state。存檔改版與 release 版本、worldVersion 為不同概念。

## 7. 地圖、角色、視覺與音效

世界資料已有 region ID、推薦級、enemyPools、dungeonIds、spawn definitions、道路與入口座標。仍是單一 world 幾何，缺獨立 MapData / 明確 connections；不能只靠 bounds 推導 Godot 場景拓樸。

monster 有 sprite、moves、elements、behavior、growth、dropPool 等可搬移資訊；Character 起始數值分散於 data.adventure、defaultBuild 與 classes。新增 visualId/animationSetId/aiProfileId 應先提供對照，不改現有 sprite 或 AI 行為。裝備/icon 與招式 icon 已是符號 ID，但 registry 尚未統一。

renderer 是程序 Canvas，音效是合成音；未來不一定對應 PNG 或 wav。Web adapter 可把 asset ID 映射到繪製／合成函式。Core 事件由 app 轉 Audio.emit，無須將瀏覽器音訊 API 引入 Core。

## 8. 基線驗證與已知問題

2026-09-21 執行全部 14 個 *.test.js（PowerShell 展開檔案），命令 `node --test --test-isolation=none <所有測試檔>`：146 項，145 通過、1 失敗。

失敗：run-summary.test.js:9 必殺蓄能範圍檢查。單獨執行同檔仍為 5 pass / 1 fail。資料檢查發現 WARRIOR_MOVE_001 與 WARRIOR_MOVE_002 的 ultimateChargeCost 為 undefined；data.js 的補值先於 classes.js 新增內容。引擎 ultimateChargeCost helper 有預設 100，因此不能直接認定所有實際施放都失效，但 registry 本身不完整。此次只記錄，不擅自修平衡或刪測試；Phase 1 須以目前運行 fallback 建立相容補值並驗證。

現有存讀、領獎不重發、UI 模擬、世界、內容、戰鬥測試均有基線價值。尚未建立跨引擎 JSON test vectors；本次未做真實手機、GitHub Pages、Godot 或瀏覽器視覺驗收，不把 headless 結果冒充實機證據。

## 9. 建議分階段計畫與預計修改檔案

以下全部待架構確認，不在本次實作。新目錄採漸進入口／相容 facade；不一次搬移全部檔案。

| 階段 | 邊界與預計檔案 | 專項驗證 |
|---|---|---|
| 1 穩定 ID / Registry | 新 data/registry.js、data/id-aliases.json、data/schema.md；調整 data.js、content-v1.js、classes.js 的初始化契約；按最終內容輸出 moves/skills/equipment/monsters/dungeons/regions/spellbooks/reward-pools/meta-shop/progression/balance JSON | 唯一 contentId、所有引用、alias 等價、前後有效數值快照；不可由 displayName 動態決定 ID |
| 2 Combat / Progression | engine.js、skill-runtime.js、progression.js；新 core/combat/events.js、core/progression/encounter-result.js；app.js 僅改對應委派 | 同 rng 序列及 dt 的 damage/cast/status/EXP/傷勢結果，事件順序不變 |
| 3 State / Save | models.d.ts、run-save.js、progression.js；新 core/save-model/schema.js、migrations.js、fixtures | 命名 V1→V2（保留舊 version 判讀）、未知版本不覆寫；探索/戰鬥/地下城/領獎快照 |
| 4 Platform | 新 platform/storage.js、clock.js、rng.js；修改 meta.js、world.js、world-rewards.js、encounters.js、run-save.js、app.js、audio.js | FakeClock 0/11/12h、回撥保護、相同 seed、儲存拒絕；不換掉現有 seed 演算法 |
| 5 Web / Core | 新 core/commands.js；app.js、screens.js、meta-screens.js、ui.js、audio.js；隔離 fullscreen/PWA adapter | useMove/settleEncounter/claimReward/buyOffer；render 無獎勵副作用，魔法名稱排版不變 |
| 6 世界與角色 | 新 data/characters.json、maps.json、assets.json；world-content.js、classes.js、world.js、renderer.js | 現有 ID/位置/連通性/中立石頭人/生成結果不變；缺動畫只用 nullable metadata |
| 7 固定案例 | 新 test-vectors/combat-basic.json、combat-critical.json、element-advantage.json、ultimate.json、level-up.json、dungeon-reward.json 及獨立 runner | 固定資料版本、ID/alias、seed或roll序列、commands/dt、期望值、精度與事件顺序；期望值經核對後凍結，測試時不可重算覆寫 |
| 8 Save JSON | 新 core/save-model/codec.js；run-save.js、platform/storage.js；匯出／匯入 UI 僅最小入口 | serialize/deserialize 與 migration 共用；先完整驗證再替換、失敗保留原文、round-trip含settings/永久/局內/戰鬥 |

各階段共同修改：data.release 版本與日期、建置資產清單/腳本順序（build.cjs、index.html）、server.cjs 白名單、PWA 對應測試；由 build 產生 PLAY.html/sw.js，不手改生成檔。JSON 採 build 時嵌入亦可，避免無意破壞 file:// 與首次完整離線下載。

每階段結束須：全部測試通過（先處理已知基線失敗）、旧存檔 fixture 比對、Web 冒險/商店/戰鬥/地下城/重整驗證、PWA 離線驗證、明確修改紀錄或有 repo 時 commit，再開始下一階段。不得以改期望值掩蓋玩法差異。

## 10. 風險與暫不動項目

高風險：名稱匹配 alias、載入順序/shared mutation、雙份永久快照、UI 領獎副作用、RNG 消耗次序、浮點取整/事件先後、生成 spawn 的索引 ID。開始 registry 前保留最終資料快照與代表性舊存檔（測試 fixture，非玩家真實隱私資料）。

暫不動：傷害/防禦/等級抗性/掉落數值；100/72內容；四方向半屏戰鬥布局、魔法文字、中央搖桿；手動完全重置既有功能；既有可用 PWA 策略；Lv60+平衡；Godot工程、動畫素材、TileMap/碰撞重做；大型框架與依賴。

存檔永遠不納入 Cache 清理。若後續需要修 PWA 一致性問題，另列變更與測試，不能借架構重構偷偷改發布機制。

## 11. 待確認的架構決策

建議接受：保留現有模組做相容入口；Phase 1 先建立 alias registry／最終資料驗證，保持所有運行值；Core 以普通 JS 函式与 command/result 為界；資料可導出 JSON，Godot 日後重寫規則並比對 test vectors。確認後僅開始 Phase 1，不一次跨八階段。
