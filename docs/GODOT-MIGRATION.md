# Godot Migration Reference（規劃，尚未實作）

2026-09-21；Web 0.7.1。參閱 ../GODOT-READINESS-AUDIT.md。Web 仍為可玩的 reference implementation；本次不建立 Godot 專案。

| Web 概念 | 未來 Godot 對應 |
|---|---|
| GameState 的 permanent/run/combat/settings | GameState / Autoload，展示狀態另管 |
| MoveData / SkillData / EquipmentData | 保留 ID 的 JSON 或 Resource |
| Battle + SkillRuntime | 可 headless 測試的規則物件；以 test vectors 核對 |
| command → state/result/events | 遊戲服務 → 結果/信號 → 畫面 |
| world 幾何、region/spawn/dungeon定義 | Scene / TileMap；保留邏輯 ID 與連接 |
| Canvas 玩家與怪物（目前不是 DOM 角色） | CharacterBody2D / Area2D |
| 程序 Canvas / CSS / 升級動畫 | AnimatedSprite2D / AnimationPlayer / Control |
| sprite/icon ID | visual/animation/icon registry → Texture / SpriteFrames |
| Audio.emit 合成音 | soundId registry → AudioStreamPlayer |
| localStorage adapter | FileAccess，user:// 存檔 |
| 可序列化快照、version、normalize | saveVersion、明確 migration；驗證後原子替換 |
| rng 函式與私有 seeded LCG | 可替換 RNG；移植相同算法或注入相同 roll 序列 |
| Date.now / 商店 epoch | Clock 接口 / Time；時間窗仍為12小時 |
| DOM input/HTML | Control Nodes / InputMap |
| PWA Cache / Service Worker | 平台發布機制；不混入遊戲存檔 |

跨引擎契約須記錄：資料版本、contentId/runtimeId/alias、時間單位、浮點取整、RNG消耗順序、事件欄位、生成 ID、重複領獎防護。保留既有 Web API facade 到每階段驗證完成，不以搬檔案取代行為測試。

Test vectors 尚待 Phase 7 建立；輸出完整存檔 JSON 尚待 Phase 8。不能把目前這份對照文件當作已完成跨引擎相容。
