# AFTERLIGHT v0.25.1 驗證

70項相關測試通過（含13項UI流程）；未做真實手機視覺驗收。

- spawn-encounters.log: 6 passed
- spawn-map-access.log: 4 passed
- spawn-map-compact.log: 3 passed
- spawn-map-routes.log: 10 passed
- spawn-offline.log: 8 passed
- spawn-run-exploration.log: 6 passed
- spawn-starter-zone.log: 6 passed
- spawn-training-map.log: 4 passed
- spawn-ui.log: 13 passed
- spawn-wild-abundance.log: 3 passed
- spawn-world-maps.log: 7 passed

35張正式地圖均驗證：生成點60～72內（本版實際61～70）；相距≥360；離道路≥260；離目的地≥280；至少75%位於離路440以外；四象限各有一深入菁英。舊版180生成點可安全縮減，保留玩家資料與剩餘點冷卻。
