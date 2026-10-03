// @ts-check
// main.js - 脚本入口（仅 import 各模块，不写逻辑）

import "./core/hud.js";             // 活动栏轮播调度器 + 标题显示工具
import "./config/configUI.js";      // 配置界面 UI（用木棍打开）
import "./game/lobby.js";           // 大厅：自动开局轮询 + 手动开局命令 + 登车人数
import "./game/gameFlow.js";        // 开局流程 / 随机传送 / 职业分配 / 对局计时
import "./game/gameEnd.js";         // 胜负判定 / 名单收集 / 结果广播 / 收尾清理
import "./game/environment.js";     // 世界规则 / 游戏时间 / 列车区域 / 坠车判定
import "./game/corpse.js";          // 尸体名牌系统
import "./gameplay/tasks.js";       // 任务系统
import "./gameplay/props.js";       // 道具系统
import "./gameplay/shop.js";        // 商店系统（含贩卖机多方块逻辑）
import "./gameplay/inGame.js";      // 局内系统（体力 + 跳跃）
import "./gameplay/guideBook.js";   // 指南书
import "./blocks/keydoor.js";       // 钥匙门逻辑
import "./core/state.js";           // 对局运行期状态与金币访问器
import "./core/i18n.js";            // 多语言文案工具
import "./core/itemIcons.js";       // 物品图标映射与贴图路径解析
import "./config/worldConfig.js";   // 世界配置（读取 / 保存 / 恢复默认）