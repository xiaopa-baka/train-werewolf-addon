[简体中文](./README.md) ｜ **繁體中文** ｜ [English](./README.en.md) ｜ [日本語](./README.ja_JP.md)

# 列車狼人殺 · Train Werewolf

> 一列飛馳的火車，一場暗藏殺機的旅途。你能否活著到站？

一個基於 **Minecraft 基岩版（Bedrock Edition）** 的多人線上推理對抗玩法 Addon。玩家同乘一列車，其中混入了**殺手**——做任務、賺金幣、買道具、找兇手，直到一方獲勝。

> 支援 **5 ~ 15 人**，一局約 **10 分鐘**；配套獨立列車地圖。

---

## 目錄

- [玩法簡介](#玩法簡介)
- [特色](#特色)
- [快速開始](#快速開始)
- [兩條分支：國際版 / 網易版](#兩條分支國際版--網易版)
- [環境要求](#環境要求)
- [管理員上手](#管理員上手)
- [可選功能：語音聊天（VoiceCraft）](#可選功能語音聊天voicecraft)
- [常用指令](#常用指令)
- [專案結構](#專案結構)
- [開發指南](#開發指南)
- [文件](#文件)
- [鳴謝](#鳴謝)
- [授權條款](#授權條款)

---

## 玩法簡介

登上列車後，系統隨機分配三種身份之一：

| 身份 | 人數 | 目標 |
|------|:--:|------|
| 🩸 **殺手** | 1 人 | 幹掉所有乘客，隱藏自己 |
| 🔫 **警員** | 1 人 | 保護乘客，找出並擊殺殺手 |
| 🧑 **平民** | 其餘 | 活下去，協助警員找出殺手 |

**勝負條件**

- 殺手死亡 → **乘客獲勝**
- 所有乘客死亡 → **殺手獲勝**
- 時間耗盡仍有乘客存活 → **乘客獲勝**

**一局流程**：登車 → 隨機分配身份 → 系統派發限時任務（逾時會死）→ 完成任務賺金幣、在商店購買道具 → 分出勝負 → 回月台準備下一局。

玩家向的詳細說明見倉庫內的 [PLAYER_GUIDE.zh_TW.md](./docs/PLAYER_GUIDE.zh_TW.md)。

---

## 特色

- **完整的三方對抗**：殺手 / 警員 / 平民，各有專屬機制與勝利條件
- **任務系統**：6 類任務（通風 / 蹲坑 / 睡覺 / 進食 / 補水 / 社交），限時倒數計時，逾時即死
- **經濟與商店**：金幣自然成長 + 擊殺獎勵；**殺手隨身商店** + 地圖上的**自動販賣機**
- **豐富的道具**：匕首、左輪 / 德林傑手槍與子彈、球棒狂暴、毒藥與**食物托盤下毒**、手榴彈、斷電裝置、神奇的海螺（查身份）、父親的懷錶（免死一次）等
- **自訂方塊**：**鑰匙門**（鑰匙 / 開鎖器 / 撬棍連動）、**自動販賣機**（多方塊結構）、**食物托盤**（隨機掉落食物）
- **屍體與名牌系統**：死亡後留下帶名字的屍體，便條內容也會留在屍體上
- **全量多語言**：內建簡體中文 / 繁體中文 / English (US) / English (UK) / 日本語（`zh_CN`、`zh_TW`、`en_US`、`en_GB`、`ja_JP`）
- **視覺化設定面板**：管理員持木棍右鍵即可設定地圖座標、任務參數、商店商品等
- **雙分支維護**：同一套玩法程式碼同時支援國際版與網易版（僅腳本 API 版本不同）
- **可選語音連動**：裝配 [VoiceCraft](https://gitlab.avion.team/voicecraft/VoiceCraft) 後自動啟用近距離語音（活人 32 格、旁觀者互通且與活人徹底隔離）；不裝配則**零影響**，且 VoiceCraft 側一行程式碼都不用改

---

## 快速開始

### 玩家 / 伺服器主

1. 取得 Addon。倉庫目前以**原始碼目錄**形式維護（`BP/` 行為包 + `RP/` 資源包），尚未附帶打包腳本。
2. 安裝方式任選其一：
   - **匯入**：將 `BP/`、`RP/` 分別打包為 `.mcpack`（或合併為 `.mcaddon`）後在遊戲中匯入；
   - **開發目錄裝載**：把 `BP/`、`RP/` 複製到 Minecraft 的 `development_behavior_packs` / `development_resource_packs` 目錄（見下方「本機偵錯裝載」）。
3. 在世界設定中啟用該行為包（資源包會自動連帶）。
4. 使用配套**列車地圖**，或自行搭建並按下文完成設定。

### 開發者

```bash
git clone https://github.com/xiaopa-baka/train-werewolf-addon.git
cd train-werewolf-addon

# 1) 選擇分支：main = 國際版；netease = 網易版
git checkout main

# 2) 安裝與目前分支符合的腳本型別（切分支後務必重裝）
npm install

# 3) 型別檢查（本專案僅用 tsc 做型別驗證，不編譯）
npx tsc --noEmit
```

### 本機偵錯裝載

把 `BP/`、`RP/` 分別複製到 Minecraft 的 `development_behavior_packs` / `development_resource_packs` 目錄（位於遊戲 `com.mojang` 資料目錄下），即可在實機上直接載入；改完腳本後重進世界即可生效。

> **網易版**：把 `BP/`、`RP/` 複製到 MC Studio 的 AddOn 工作目錄。
> 建議自行寫一個「先清空、再複製」的本機腳本來加快迭代——本倉庫不附帶此類腳本（未納入版本管理）。

---

## 兩條分支：國際版 / 網易版

同一套腳本與文案，僅腳本 API 版本不同：

| 專案 | `main`（國際版） | `netease`（網易版） |
|---|---|---|
| `min_engine_version` | `[1, 26, 50]` | `[1, 21, 120]` |
| `@minecraft/server` | `2.10.0` | `2.3.0` |
| `@minecraft/server-ui` | `2.2.0` | `2.0.0` |
| BP `capabilities` | `["script_eval"]` | 無 |
| `package.json` 開發相依套件 | 2.10.0 / 2.2.0 | 2.3.0 / 2.0.0 |

**約定**

- `main` 為**國際版長期維護主線**；功能與 Bug 修正應在兩條分支間同步（版本號差異除外），建議用 `cherry-pick` 保持腳本一致。
- 切換分支後 `node_modules` 與分支不符合，**必須重新 `npm install`**。
- **網易版已知限制**：自訂方塊互動（鑰匙門、自動販賣機多方塊）**尚未在網易端專項適配與實測**，該部分程式碼暫與國際版一致。

---

## 環境要求

- **Minecraft Bedrock Edition**：國際版 ≥ 1.26.50，或網易版 ≥ 1.21.120
- 開發環境：
  - Node.js（用於 `npm install` 與 `tsc`）
  - TypeScript `^5.5.0`（作為 devDependency 安裝，僅用於型別檢查）

---

## 管理員上手

### 1. 設定地圖與規則

進入遊戲後，取得設定木棍，持木棍**右鍵**開啟設定面板，依次設定：

1. **全域遊戲設定**：自動開始、開局延遲、最低人數、遊戲時長、任務參數、金幣成長速度、局內體力 / 跳躍開關、天氣開關
2. **地圖區域設定**：月台、車頭座標、列車區域、透氣區、蹲坑點、隨機傳送點
3. **食物 & 飲品設定**：任務合法的食物與飲品清單
4. **商店設定**：殺手商店與自動販賣機的商品與價格
5. **可選：語音設定**（僅當世界裝配了 VoiceCraft 且已連上伺服器端時，主選單才會多出這個按鈕）：調整活人語音半徑，預設 32 格（4–128，間隔 4）

### 2. 開局

- **自動**：全員在列車內且人數達標後自動倒數計時發車
- **手動**：管理員執行 `/lw_p1:start`

---

## 可選功能：語音聊天（VoiceCraft）

本玩法支援接入 [VoiceCraft](https://gitlab.avion.team/voicecraft/VoiceCraft) 近距離語音，並依狼人殺的玩法需求實作了三條規則：

| 場合 | 效果 |
|---|---|
| 活人 ↔ 活人 | 半徑內互相聽得見（預設 **32 格**，管理員可在設定面板的「語音設定」裡調） |
| 旁觀者 ↔ 旁觀者 | **不受距離限制**，跨維度也能互相聽見 |
| 活人 ↔ 旁觀者 | **雙向徹底靜音**（連音訊封包都不發） |

- **完全可選**：不裝配 VoiceCraft 時本專案**不產生任何行為** —— 不註冊計時器、不傳送任何資料、不改動任何玩法與狀態，設定選單裡也不會出現「語音設定」。
- **零改動接入**：全部適配只寫在本專案腳本裡（`BP/scripts/integration/voiceCraft.js`），VoiceCraft 的附加包與其伺服器端設定**一行都不需要改**，因此不受上游 addon 版本更迭影響。
- **使用前提**（缺一不可）：① 每名玩家安裝 VoiceCraft 用戶端 App；② 有人執行 VoiceCraft 伺服器端且玩家與 MC 世界都能存取到它（公網 IP / UDP 連接埠對應 / 官方託管）；③ 世界端裝載 VoiceCraft 附加包（`Basic` + 對應傳輸的 `Core.McWss` 或 `Core.McHttp`）。首次進入需依 VoiceCraft 流程執行 `/voicecraft:vcbind <綁定碼>` 綁定一次，此後**重進世界、甚至重新啟動 VoiceCraft 用戶端 App 都無需再綁**（綁定記錄存在世界的動態屬性裡；用戶端重新啟動後是靠 VoiceCraft 用戶端持續儲存的 UserGuid 把你認回來；只有執行過 `/lw_p1:voice_forget` 的玩家才需要重新綁）。
- **僅國際版**：網易版沒有 `/connect` 隧道，此功能不適用（見「兩條分支」）。

---

## 常用指令

| 指令 | 效果 |
|---|---|
| `/lw_p1:start` | 手動開局 |
| `/lw_p1:end` | 強制結束目前對局（任何時刻執行結束流程） |
| `/lw_p1:clear_corpses` | 清除所有屍體與名牌 |
| `/lw_p1:voice_status` | 檢視語音連動狀態：是否已連線、目前聲道遮罩與語音半徑、綁定記錄 |
| `/lw_p1:voice_resync [目標]` | 重新傳送聲道與語音半徑，並把目標目前的綁定寫回世界屬性（重進世界會自動恢復綁定）。目標是**玩家選擇器**（Tab 有補全）：**省略目標 = 把所有綁定記錄寫回（含離線玩家）**、`@a`=全部線上玩家、`@s`/`@p`/`@r`/線上玩家名=指定玩家 |
| `/lw_p1:voice_forget [目標]` | 解除語音綁定：只從世界屬性裡刪掉目標的 id，**不做任何靜音**；本場次語音照常，重進世界（或重新啟動用戶端 App）都會需要重新 `/vcbind`。目標寫法同上，**省略目標 = 清掉所有綁定記錄（含離線玩家）**，清自己請寫 `@s` |

> `voice_*` 四條指令只在裝配了 VoiceCraft 時才有實際作用；未裝配時它們只回報「未偵測到 VoiceCraft」，不會報錯。

---

## 專案結構

```
demo/
├── BP/                         # 行為包
│   ├── manifest.json
│   ├── blocks/                 # 自訂方塊（鑰匙門 / 自動販賣機 / 食物托盤）
│   ├── entities/               # 子彈 / 屍體 / 爆竹 / 手榴彈 / 手槍 / 名牌
│   ├── items/                  # 自訂物品
│   ├── loot_tables/            # 空掉落表
│   ├── texts/                  # BP 包名多語言
│   └── scripts/                # 全部邏輯腳本（ES Module）
│       ├── main.js             # 入口：僅 import 各模組
│       ├── core/               # hud / state / i18n / itemIcons
│       ├── game/               # lobby / gameFlow / gameEnd / environment / corpse
│       ├── gameplay/           # tasks / props / shop / inGame / guideBook
│       ├── blocks/             # keydoor
│       ├── config/             # worldConfig（資料）/ configUI（介面）/ configExtensions（可選模組入口）
│       └── integration/        # 可選功能模組（voiceCraft：VoiceCraft 語音連動）
├── RP/                         # 資源包（模型 / 動畫 / 材質 / 音效 / 文案）
├── package.json                # 僅 devDependencies（型別定義 + tsc）
├── tsconfig.json               # 型別檢查設定（noEmit）
└── docs/                       # 玩家向文件
│   ├── PLAYER_GUIDE.zh_CN.md   # 玩家指南（简体中文）
│   ├── PLAYER_GUIDE.zh_TW.md   # 玩家指南（繁體中文）
│   ├── PLAYER_GUIDE.ja_JP.md   # 玩家指南（日本語）
│   └── PLAYER_GUIDE.en.md      # Player Guide (English)
```

> 腳本按領域分層，入口 `BP/scripts/main.js` 只做 import，便於定位功能模組。
> `config/` 與 `integration/` 之間是**反向註冊**：可選模組把自己的設定入口註冊到 `configExtensions.js`，設定介面不認識任何具體模組 —— 刪掉 `integration/` 也不會影響設定介面與其它功能。

---

## 開發指南

### 型別檢查

```bash
npx tsc --noEmit   # 0 error 即通過
```

所有腳本檔案頭部帶 `// @ts-check`，配合 `tsconfig.json` 的 `allowJs + checkJs` 做靜態驗證。

### 注意事項

- **相對匯入必須帶 `.js` 副檔名**（如 `import "./config/worldConfig.js"`），否則執行時報 `ERR_MODULE_NOT_FOUND`。
- 使用 **ScriptAPI 2.x** 寫法：`world.afterEvents.worldLoad`、`world.getPlayers()`、`entity.isValid`（屬性）、`runCommand` 等，避免舊介面。
- `beforeEvents` 中不能可靠地修改世界（發物品 / 刪實體等），需用 `mc.system.run()` 延後到下一幀執行。
- 面向玩家的文案一律透過 `core/i18n.js` 的 `t()` 輸出，並在 `RP/texts/` 的 5 個語言檔案（`zh_CN`、`zh_TW`、`en_US`、`en_GB`、`ja_JP`）中補齊對應鍵（五個檔案需嚴格鏡像：鍵集合、`%s`、`§` 格式碼與 `\n` 位置一致）。

---

## 文件

- **玩家指南**：[繁體中文](./docs/PLAYER_GUIDE.zh_TW.md) ｜ [简体中文](./docs/PLAYER_GUIDE.zh_CN.md) ｜ [日本語](./docs/PLAYER_GUIDE.ja_JP.md) ｜ [English](./docs/PLAYER_GUIDE.en.md)
- **README 語言版本**：[简体中文](./README.md) ｜ [日本語](./README.ja_JP.md) ｜ [English](./README.en.md)
- **開發者資料**：每個腳本檔案頭部都有一行職責註解，閱讀入口為 `BP/scripts/main.js`
- **設定說明**：進入遊戲後用木棍開啟設定面板，各項均有說明

---

## 鳴謝

**作者 / 製作**

- 小怕（Xiaopa baka）
- LW.狮狼传奇工作室（LW Realm Studio）

**聯絡信箱**：xiaopa1214@163.com

**技術**

- Minecraft Bedrock ScriptAPI（`@minecraft/server`、`@minecraft/server-ui`）
- [TypeScript](https://www.typescriptlang.org/)（型別檢查）

---

## 授權條款

本倉庫目前**未附帶開源授權條款**。如需轉載、二次開發或商用，請先透過 **xiaopa1214@163.com** 聯絡作者取得授權。

---

> 祝你好運——在這列車上，最不該相信的，往往就是笑得最自然的那個人。