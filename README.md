**简体中文** ｜ [English](./README.en.md)

# 列车狼人杀 · Train Werewolf

> 一列飞驰的火车，一场暗藏杀机的旅途。你能否活着到站？

一个基于 **Minecraft 基岩版（Bedrock Edition）** 的多人在线推理对抗玩法 Addon。玩家同乘一列车，其中混入了**杀手**——做任务、赚金币、买道具、找凶手，直到一方获胜。

> 支持 **5 ~ 15 人**，一局约 **10 分钟**；配套独立列车地图。

---

## 目录

- [玩法简介](#玩法简介)
- [特色](#特色)
- [快速开始](#快速开始)
- [两条分支：国际版 / 网易版](#两条分支国际版--网易版)
- [环境要求](#环境要求)
- [管理员上手](#管理员上手)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [文档](#文档)
- [鸣谢](#鸣谢)
- [许可](#许可)

---

## 玩法简介

登上列车后，系统随机分配三种身份之一：

| 身份 | 人数 | 目标 |
|------|:--:|------|
| 🩸 **杀手** | 1 人 | 干掉所有乘客，隐藏自己 |
| 🔫 **警员** | 1 人 | 保护乘客，找出并击杀杀手 |
| 🧑 **平民** | 其余 | 活下去，协助警员找出杀手 |

**胜负条件**

- 杀手死亡 → **乘客获胜**
- 所有乘客死亡 → **杀手获胜**
- 时间耗尽仍有乘客存活 → **乘客获胜**

**一局流程**：登车 → 随机分配身份 → 系统派发限时任务（超时会死）→ 完成任务赚金币、在商店购买道具 → 分出胜负 → 回站台准备下一局。

玩家向的详细说明见仓库内的 [列车狼人杀游玩指南.md](./列车狼人杀游玩指南.md)。

---

## 特色

- **完整的三方对抗**：杀手 / 警员 / 平民，各有专属机制与胜利条件
- **任务系统**：6 类任务（通风 / 蹲坑 / 睡觉 / 进食 / 补水 / 社交），限时倒计时，超时即死
- **经济与商店**：金币自然增长 + 击杀奖励；**杀手便携商店** + 地图上的**贩卖机**
- **丰富的道具**：匕首、左轮 / 德林杰手枪与子弹、球棒狂暴、毒药与**餐盘下毒**、手雷、断电装置、神奇的海螺（查身份）、父亲的怀表（免死一次）等
- **自定义方块**：**钥匙门**（钥匙 / 开锁器 / 撬棍联动）、**贩卖机**（多方块结构）、**餐盘**（随机掉落食物）
- **尸体与名牌系统**：死亡后留下带名字的尸体，便条内容也会留在尸体上
- **全量多语言**：内置简体中文 / English（`zh_CN`、`en_US`）
- **可视化配置面板**：管理员持木棍右键即可配置地图坐标、任务参数、商店商品等
- **双分支维护**：同一套玩法代码同时支持国际版与网易版（仅脚本 API 版本不同）

---

## 快速开始

### 玩家 / 服务器主

1. 获取 Addon。仓库目前以**源码目录**形式维护（`BP/` 行为包 + `RP/` 资源包），尚未附带打包脚本。
2. 安装方式任选其一：
   - **导入**：将 `BP/`、`RP/` 分别打包为 `.mcpack`（或合并为 `.mcaddon`）后在游戏中导入；
   - **开发目录装载**：把 `BP/`、`RP/` 复制到 Minecraft 的 `development_behavior_packs` / `development_resource_packs` 目录（见下方「本地调试装载」）。
3. 在世界设置中启用该行为包（资源包会自动连带）。
4. 使用配套**列车地图**，或自行搭建并按下文完成配置。

### 开发者

```bash
git clone https://github.com/xiaopa-baka/train-werewolf-addon.git
cd train-werewolf-addon

# 1) 选择分支：main = 国际版；netease = 网易版
git checkout main

# 2) 安装与当前分支匹配的脚本类型（切分支后务必重装）
npm install

# 3) 类型检查（本项目仅用 tsc 做类型校验，不编译）
npx tsc --noEmit
```

### 本地调试装载

把 `BP/`、`RP/` 分别复制到 Minecraft 的 `development_behavior_packs` / `development_resource_packs` 目录（位于游戏 `com.mojang` 数据目录下），即可在真机上直接加载；改完脚本后重进世界即可生效。

> **网易版**：把 `BP/`、`RP/` 复制到 MC Studio 的 AddOn 工作目录。
> 建议自行写一个「先清空、再复制」的本地脚本来加快迭代——本仓库不附带此类脚本（未纳入版本管理）。

---

## 两条分支：国际版 / 网易版

同一套脚本与文案，仅脚本 API 版本不同：

| 项目 | `main`（国际版） | `netease`（网易版） |
|---|---|---|
| `min_engine_version` | `[1, 26, 50]` | `[1, 21, 120]` |
| `@minecraft/server` | `2.10.0` | `2.3.0` |
| `@minecraft/server-ui` | `2.2.0` | `2.0.0` |
| BP `capabilities` | `["script_eval"]` | 无 |
| `package.json` devDependencies | 2.10.0 / 2.2.0 | 2.3.0 / 2.0.0 |

**约定**

- `main` 为**国际版长期维护主线**；功能与 Bug 修复应在两条分支间同步（版本号差异除外），建议用 `cherry-pick` 保持脚本一致。
- 切换分支后 `node_modules` 与分支不匹配，**必须重新 `npm install`**。
- **网易版已知限制**：自定义方块交互（钥匙门、贩卖机多方块）**尚未在网易端专项适配与实测**，该部分代码暂与国际版一致。

---

## 环境要求

- **Minecraft Bedrock Edition**：国际版 ≥ 1.26.50，或网易版 ≥ 1.21.120
- 开发环境：
  - Node.js（用于 `npm install` 与 `tsc`）
  - TypeScript `^5.5.0`（作为 devDependency 安装，仅用于类型检查）

---

## 管理员上手

### 1. 配置地图与规则

进入游戏后，获取配置木棍，持木棍**右键**打开配置面板，依次设置：

1. **全局游戏配置**：自动开始、开局延迟、最少人数、游戏时长、任务参数、金币增速、局内体力 / 跳跃开关、天气开关
2. **地图区域配置**：站台、车头坐标、列车区域、通风区、蹲坑点、随机传送点
3. **食物 & 饮品配置**：任务合法的食物与饮品列表
4. **商店配置**：杀手商店与贩卖机的商品与价格

### 2. 开局

- **自动**：全员在列车内且人数达标后自动倒计时发车
- **手动**：管理员执行 `/lw_p1:start`

---

## 常用命令

| 命令 | 效果 |
|---|---|
| `/lw_p1:start` | 手动开局（需要权限等级 GameDirectors） |
| `/lw_p1:end` | 强制结束当前对局（任何时刻执行结束流程） |
| `/lw_p1:clear_corpses` | 清除所有尸体与名牌 |
| `/give @s minecraft:stick` | 获取配置管理员木棍 |
| `/give @s lw_p1:keydoor_1` ~ `keydoor_10` | 获取钥匙门 |
| `/give @s lw_p1:key_1` ~ `key_8` | 获取房间钥匙 |
| `/give @s lw_p1:lockpick` | 获取开锁器 |
| `/give @s lw_p1:guide_book` | 获取指南书 |

---

## 项目结构

```
demo/
├── BP/                         # 行为包
│   ├── manifest.json
│   ├── blocks/                 # 自定义方块（钥匙门 / 贩卖机 / 餐盘）
│   ├── entities/               # 子弹 / 尸体 / 鞭炮 / 手雷 / 手枪 / 名牌
│   ├── items/                  # 自定义物品
│   ├── loot_tables/            # 空掉落表
│   ├── texts/                  # BP 包名多语言
│   └── scripts/                # 全部逻辑脚本（ES Module）
│       ├── main.js             # 入口：仅 import 各模块
│       ├── core/               # hud / state / i18n / itemIcons
│       ├── game/               # lobby / gameFlow / gameEnd / environment / corpse
│       ├── gameplay/           # tasks / props / shop / inGame / guideBook
│       ├── blocks/             # keydoor
│       └── config/             # worldConfig（数据）/ configUI（界面）
├── RP/                         # 资源包（模型 / 动画 / 贴图 / 音效 / 文案）
├── package.json                # 仅 devDependencies（类型定义 + tsc）
├── tsconfig.json               # 类型检查配置（noEmit）
├── 列车狼人杀游玩指南.md        # 玩家向说明（中文）
└── PLAYER_GUIDE.md             # 玩家向说明（英文）
```

> 脚本按领域分层，入口 `BP/scripts/main.js` 只做 import，便于定位功能模块。

---

## 开发指南

### 类型检查

```bash
npx tsc --noEmit   # 0 error 即通过
```

所有脚本文件头部带 `// @ts-check`，配合 `tsconfig.json` 的 `allowJs + checkJs` 做静态校验。

### 注意事项

- **相对导入必须带 `.js` 扩展名**（如 `import "./config/worldConfig.js"`），否则运行时报 `ERR_MODULE_NOT_FOUND`。
- 使用 **ScriptAPI 2.x** 写法：`world.afterEvents.worldLoad`、`world.getPlayers()`、`entity.isValid`（属性）、`runCommand` 等，避免旧接口。
- `beforeEvents` 中不能可靠地修改世界（发物品 / 删实体等），需用 `mc.system.run()` 延后到下一帧执行。
- 面向玩家的文案一律通过 `core/i18n.js` 的 `t()` 输出，并在 `RP/texts/zh_CN.lang` 与 `en_US.lang` 中补齐对应键（两文件需严格镜像）。

### 新增一个道具

1. 在 `BP/items/` 添加物品 JSON；
2. 在 `RP/textures/items/` 放贴图，并在 `item_texture.json` 注册；
3. 在对应系统（通常在 `BP/scripts/gameplay/props.js`）编写事件处理逻辑；
4. 若要上架，在 `BP/scripts/config/worldConfig.js` 的商店配置中补条目；
5. 在 `RP/texts/zh_CN.lang` + `en_US.lang` 补译名（`item.lw_p1:<id>`）；
6. `npx tsc --noEmit` 通过后真机实测。

### 新增一扇门

1. 参照 `BP/blocks/keydoor_1.json` 添加门方块 JSON；
2. 在 `BP/items/` 添加对应钥匙；
3. 在 `BP/scripts/blocks/keydoor.js` 的 `DOOR_KEY_MAP` 中登记映射；
4. 在 RP 中放贴图并注册到 `terrain_texture.json`；
5. 补语言文件；`npx tsc --noEmit` 通过后实测。

### 提交约定

- 功能 / Bug 修复请同步到 `main` 与 `netease` 两条分支；
- 提交信息建议使用 `feat: / fix: / chore:` 前缀，说明「为什么改」。

---

## 文档

- **玩家指南（中文）**：[列车狼人杀游玩指南.md](./列车狼人杀游玩指南.md)
- **Player Guide (English)**：[PLAYER_GUIDE.md](./PLAYER_GUIDE.md)
- **开发者资料**：每个脚本文件头部都有一行职责注释，阅读入口为 `BP/scripts/main.js`
- **配置说明**：进入游戏后用木棍打开配置面板，各项均有说明

---

## 鸣谢

**作者 / 制作**

- 狮狼传奇_小怕
- LW.狮狼传奇工作室
- 尘世之狼

**联系邮箱**：xiaopa1214@163.com

**技术**

- Minecraft Bedrock ScriptAPI（`@minecraft/server`、`@minecraft/server-ui`）
- [TypeScript](https://www.typescriptlang.org/)（类型检查）

---

## 许可

本仓库当前**未附带开源许可证**。如需转载、二次开发或商用，请先通过 **xiaopa1214@163.com** 联系作者获得授权。

---

> 祝你好运——在这列车上，最不该相信的，往往就是笑得最自然的那个人。