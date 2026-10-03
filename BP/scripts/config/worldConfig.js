// @ts-check
// worldConfig.js - 世界配置的读写入口（数值配置 + 复杂数据）

// 本模块集中管理两类"世界级"持久化数据，二者的存储方式不同：
//
//   1）数值型可调参数 —— CONFIG_SCHEMA
//      每一项单独存成一个 world 动态属性（键名见该项的 prop 字段），
//      读写统一走 getConfig / setConfig；配置界面里的滑块、开关都基于它。
//      好处：单项独立读写，改一项不影响其它项。
//
//   2）复杂数据 —— getEmptyConfig()（坐标、物品列表、局内开关、地图信息等）
//      整份对象经 JSON 序列化后，整体存入 world 动态属性 "lw_p1:config"，
//      读写统一走 getWorldConfig / saveWorldConfig。
//      好处：结构自由，日后新增字段不必改动存储层。
//
// 使用约定：
//   · getWorldConfig() 总是返回"结构完整"的配置对象（缺失字段用默认值补齐），
//     调用方拿到后可直接使用，无需自行判空。
//   · 涉及具体某一项数值参数时，优先用 getConfig(key)，而不是读整份配置对象。

import * as mc from "@minecraft/server";


// ===== 数值配置表（CONFIG_SCHEMA） =====
// 每一项的字段含义：
//   prop             该配置项在 world 动态属性中的键名（读写时的实际存储位置）
//   default          预设值（首次使用、读取失败、或"恢复默认"时使用）
//   min / max / step 配置界面滑块的范围与步长；未写 min 的项不生成滑块（即界面不可调）
//
// 下方每项均标注：含义、单位、默认值、范围，以及实际消费它的模块。
export const CONFIG_SCHEMA = {
    // ===== 游戏相关 =====
    // 是否启用"自动开始游戏"：1 = 启用，0 = 关闭。
    // 关闭后只能由玩家执行 /lw_p1:start 手动开局（配置界面用开关表示，写回时 true→1、false→0）
    autoStart:      { prop: "lw_p1.cfg.autoStart",      default: 1 },
    // 自动开始倒计时（秒）：车厢内人数达标后，等待多少秒自动发车。默认 10，范围 0-60（步长 5）
    // 消费方：lobby.js（轮询判定是否发车）
    autoStartDelay: { prop: "lw_p1.cfg.autoStartDelay", default: 10,  min: 0,   max: 60,   step: 5 },
    // 最低开局人数：车厢内玩家数达到此值才允许开始。默认 5，范围 5-15（步长 1）
    // 消费方：lobby.js（自动与手动开局都会校验）
    minPlayers:     { prop: "lw_p1.cfg.minPlayers",     default: 5,   min: 5,   max: 15,   step: 1 },
    // 单局基础时长（秒）。实际剩余时间 = 基础时长 + 死亡加时 - 已过时间。
    // 默认 600（= 10 分钟），范围 300-1200（步长 20）。消费方：core/state.js（getRemainSeconds）
    baseDuration:   { prop: "lw_p1.cfg.baseDuration",   default: 600, min: 300, max: 1200, step: 20 },

    // ===== 任务相关 =====
    // 发任务概率（百分比，0-100 的整数百分比）：每秒为"尚未分配任务"的玩家发任务的概率。
    // 默认 3（即 3%），范围 0-20（步长 1）。消费方：tasks.js（使用时会再除以 100）
    taskChance:     { prop: "lw_p1.cfg.taskChance",     default: 3,   min: 0,   max: 20,   step: 1 },
    // 首次发任务延迟（秒）：开局后先等待这么长时间，才开始尝试发任务。默认 20，范围 0-60（步长 10）
    // 消费方：tasks.js
    taskFirstDelay: { prop: "lw_p1.cfg.taskFirstDelay", default: 20,  min: 0,   max: 60,   step: 10 },
    // 单个任务限时（秒）：平民/警员必须在此时间内完成，超时视为失败。
    // 该值同时会被换算成"限时经验等级"用于倒计时显示。默认 100，范围 60-180（步长 10）。消费方：tasks.js
    taskLimit:      { prop: "lw_p1.cfg.taskLimit",      default: 100, min: 60,  max: 180,  step: 10 },
    // 杀手虚假任务限时（秒）：杀手假任务的最长存续时间。默认 50，范围 20-60（步长 10）。消费方：tasks.js
    fakeTaskLimit:  { prop: "lw_p1.cfg.fakeTaskLimit",  default: 50,  min: 20,  max: 60,   step: 10 },
    // 任务完成奖励（金币）：平民/警员每完成一个任务获得的金币。默认 25，范围 10-50（步长 5）。消费方：tasks.js
    taskReward:     { prop: "lw_p1.cfg.taskReward",     default: 25,  min: 10,  max: 50,   step: 5 },
    // 任务总数上限：任务编号范围为 1..taskCount。默认 6。
    // 未填写 min，故配置界面不提供滑块（需修改代码或存储值才能调整）。消费方：tasks.js
    taskCount:      { prop: "lw_p1.cfg.taskCount",      default: 6 },

    // ===== 金币相关 =====
    // 杀手初始金币：开局时发放给杀手的金币。默认 100，范围 0-500（步长 50）。消费方：gameFlow.js
    killerGold:     { prop: "lw_p1.cfg.killerGold",     default: 100, min: 0,   max: 500,  step: 50 },
    // 平民初始金币：开局时发放给非杀手（平民/警员）的金币。默认 0，范围 0-500（步长 50）。消费方：gameFlow.js
    civilGold:      { prop: "lw_p1.cfg.civilGold",      default: 0,   min: 0,   max: 500,  step: 50 },
    // 杀手金币成长：开局后杀手每 10 秒自然增加的金币。默认 15，范围 0-30（步长 5）。消费方：shop.js
    killerGoldRate: { prop: "lw_p1.cfg.killerGoldRate", default: 15,  min: 0,   max: 30,   step: 5 },
    // 平民金币成长：开局后非杀手每 10 秒自然增加的金币。默认 0，范围 0-10（步长 2）。消费方：shop.js
    civilGoldRate:  { prop: "lw_p1.cfg.civilGoldRate",  default: 0,   min: 0,   max: 10,   step: 2 },

    // ===== 地图相关 =====
    // 房间数量：决定开局发放的钥匙编号范围（1..roomCount）；玩家数超过房间数时循环分配。
    // 默认 8，范围 1-8（步长 1）。消费方：gameFlow.js
    roomCount:      { prop: "lw_p1.cfg.roomCount",      default: 8,   min: 1,   max: 8,    step: 1 },
};


// ===== 复杂数据的默认模板 =====
// 返回一份"完整"的世界配置对象（即复杂数据的预设值）。
// 坐标均为 {x, y, z} 数值对象，未设置时用 null / 空数组占位。
// 本函数的返回值同时充当两处用途：首次使用时的初始配置、以及 getWorldConfig 补齐缺失字段的参照。
export function getEmptyConfig() {
    return {
        // 合法食物列表：判定"进食任务"是否完成时使用的原版物品 id 列表。消费方：tasks.js
        allowedFoods: [
            "minecraft:apple",              // 苹果
            "minecraft:melon_slice",        // 西瓜片
            "minecraft:carrot",             // 胡萝卜
            "minecraft:sweet_berries",      // 甜浆果
            "minecraft:glow_berries",       // 发光浆果

            "minecraft:bread",              // 面包
            "minecraft:cookie",             // 曲奇
            "minecraft:pumpkin_pie",        // 南瓜派
            "minecraft:dried_kelp",         // 干海带
            "minecraft:baked_potato",       // 烤马铃薯

            "minecraft:cooked_beef",        // 熟牛排
            "minecraft:cooked_chicken",     // 熟鸡肉
            "minecraft:cooked_porkchop",    // 熟猪排
            "minecraft:cooked_mutton",      // 熟羊肉
            "minecraft:cooked_salmon",      // 熟鲑鱼
        ],

        // 合法饮品列表：判定"补水任务"是否完成时使用的物品 id 列表（含自定义饮品）。消费方：tasks.js
        allowedDrinks: [
            "lw_p1:old_fashioned",          // 古典鸡尾酒
            "lw_p1:mojito",                 // 莫吉托
            "lw_p1:martini",                // 马提尼
            "lw_p1:cosmopolitan",           // 大都会鸡尾酒
            "lw_p1:champagne",              // 香槟
            "lw_p1:mineral_water",          // 矿泉水
        ],

        // 车头单点坐标：使用"传送至车头"物品后的落点。默认 (0.5, 0.5, 0.5) 为占位值
        trainEngineCoordinates: {
            x: 0.5,
            y: 0.5,
            z: 0.5
        },

        // 站台单点坐标：每局结束时把玩家传送回此处（开始屋）。null = 未设置。消费方：gameEnd.js
        trainStationCoordinates: null,

        // 列车区域：一对对角坐标，圈出"在车上"的立方体判定范围。null = 未设置。消费方：environment.js
        trainCoordinates: {
            start: null,
            end: null
        },

        // 透气区：车头、车尾各一对对角坐标，用于"通风任务"的判定。消费方：tasks.js
        ventilationAreas: {
            trainEngine: {
                start: null,
                end: null
            },
            trainTail: {
                start: null,
                end: null
            }
        },

        // 蹲坑坐标：可设置多个（数组），玩家在这些点附近潜行即可完成"蹲坑任务"。消费方：tasks.js
        toiletCoordinates: [],

        // 随机传送坐标：可设置多个（数组），开局时把玩家随机散布到这些点。消费方：gameFlow.js
        randomCoordinates: [],

        // 杀手商店商品列表：每项形如 { id 物品标识符, displayName 自定义显示名(空则用物品译名), price 价格(金币) }
        killerStoreItems: [
            {
                id: "lw_p1:dagger",
                displayName: "",
                price: 100
            },
            {
                id: "lw_p1:pistol_mini",
                displayName: "",
                price: 250
            },
            {
                id: "lw_p1:crowbar",
                displayName: "",
                price: 75
            },
            {
                id: "lw_p1:lockpick",
                displayName: "",
                price: 100
            },
            {
                id: "lw_p1:poison",
                displayName: "",
                price: 100
            },
            {
                id: "lw_p1:firecracker_spawn_egg",
                displayName: "",
                price: 75
            },
            {
                id: "lw_p1:grenade",
                displayName: "",
                price: 250
            },
            {
                id: "lw_p1:bat",
                displayName: "",
                price: 300
            },
            {
                id: "lw_p1:power_cut",
                displayName: "",
                price: 200
            },
        ],

        // 贩卖机商品列表：结构同 killerStoreItems。消费方：shop.js
        vendingMachineItems: [
            {
                id: "lw_p1:pistol",
                displayName: "",
                price: 250
            },
            {
                id: "lw_p1:mineral_water",
                displayName: "",
                price: 100
            },
            {
                id: "lw_p1:cigarette",
                displayName: "",
                price: 100
            },
            {
                id: "minecraft:ender_pearl",
                displayName: "",
                price: 100
            },
            {
                id: "lw_p1:magic_conch",
                displayName: "",
                price: 100
            },
            {
                id: "lw_p1:pocke_watch",
                displayName: "",
                price: 125
            },
            {
                id: "lw_p1:royal_jelly",
                displayName: "",
                price: 100
            },
        ],

        // 食物托盘物品列表：托盘方块 id → 交互后随机掉落的物品 id 数组。消费方：props.js
        foodTrayItems: {
            "lw_p1:food_tray": [
                "minecraft:apple",              // 苹果
                "minecraft:melon_slice",        // 西瓜片
                "minecraft:carrot",             // 胡萝卜
                "minecraft:sweet_berries",      // 甜浆果
                "minecraft:glow_berries",       // 发光浆果
            ],
            "lw_p1:food_tray_glass": [
                "minecraft:bread",              // 面包
                "minecraft:cookie",             // 曲奇
                "minecraft:pumpkin_pie",        // 南瓜派
                "minecraft:dried_kelp",         // 干海带
                "minecraft:baked_potato",       // 烤马铃薯
            ],
            "lw_p1:food_tray_wood": [
                "minecraft:cooked_beef",        // 熟牛排
                "minecraft:cooked_chicken",     // 熟鸡肉
                "minecraft:cooked_porkchop",    // 熟猪排
                "minecraft:cooked_mutton",      // 熟羊肉
                "minecraft:cooked_salmon",      // 熟鲑鱼
            ],
            "lw_p1:food_tray_ceramic": [
                "lw_p1:old_fashioned",          // 古典鸡尾酒
                "lw_p1:mojito",                 // 莫吉托
                "lw_p1:martini",                // 马提尼
                "lw_p1:cosmopolitan",           // 大都会鸡尾酒
                "lw_p1:champagne",              // 香槟
            ]
        },

        // 局内相关开关与速率（仅对局内生效）。消费方：inGame.js
        staminaEnabled: true,           // 体力系统：关闭后疾跑不再消耗体力
        jumpEnabled: true,              // 是否允许跳跃：关闭后玩家无法跳跃
        staminaDrainPerSecond: 10,      // 疾跑每秒消耗的体力（范围 2-20，步长 2）
        staminaRegenPerSecond: 4,       // 停止疾跑后每秒恢复的体力（范围 2-20，步长 2）
        killerStamina: true,            // 杀手体力值：关闭后杀手没有体力值，可以无限疾跑

        // 地图信息：显示在指南书首页的地图名与作者。消费方：guideBook.js
        worldInformation: {
            mapName: "",
            mapAuthor: ""
        },
    };
}


// 用默认值补齐配置对象中缺失的字段（浅合并）。
// 必要性：老存档里保存的配置可能不含后续版本新增的字段；
// 若直接使用，读取这些字段会得到 undefined 而报错，故每次读取都补齐结构。
function fillDefaultConfig(inputConfig) {
    const defaults = getEmptyConfig();
    // 兼容历史版本：早期字段名为首字母大写的 VendingMachineItems，统一归一为 vendingMachineItems
    const normalizedConfig = {
        ...inputConfig,
        vendingMachineItems: inputConfig.vendingMachineItems ?? inputConfig.VendingMachineItems ?? []
    };
    const result = { ...defaults, ...normalizedConfig };
    // worldInformation 是嵌套对象，浅合并会整体覆盖，故对它单独再做一层合并
    if (!result.worldInformation) result.worldInformation = {};
    const wiDefaults = defaults.worldInformation;
    result.worldInformation = { ...wiDefaults, ...result.worldInformation };
    return result;
}


// 读取整份世界配置对象。
// 数据来源：world 动态属性 "lw_p1:config"（一段 JSON 字符串）。
// 若从未保存过、或解析失败，则回退为默认配置，保证调用方总能拿到可用对象。
export function getWorldConfig() {
    const jsonStr = mc.world.getDynamicProperty("lw_p1:config");
    if (!jsonStr) {
        return getEmptyConfig();
    }
    try {
        const parsed = JSON.parse(String(jsonStr));
        return fillDefaultConfig(parsed);
    } catch (err) {
        return getEmptyConfig();
    }
}


// 保存整份世界配置对象：序列化为 JSON 后写入 world 动态属性 "lw_p1:config"。
// 注意：写入的是调用方传入的完整对象，因此调用前应先 getWorldConfig() 取出、改完再存回。
export function saveWorldConfig(config) {
    mc.world.setDynamicProperty("lw_p1:config", JSON.stringify(config));
}


// 读取单个数值配置项。
// 数据来源：该项在 CONFIG_SCHEMA 中登记的 prop 动态属性。
// 未登记的 key 返回 0；存储值缺失或类型不是数字时回退到该项的 default。
export function getConfig(key) {
    const item = CONFIG_SCHEMA[key];
    if (!item) return 0;
    const value = mc.world.getDynamicProperty(item.prop);
    return typeof value === "number" ? value : item.default;
}


// 写入单个数值配置项。
// 未登记的 key 直接忽略；非有限数值（NaN / Infinity / 非数字字符串）回退写入 default，
// 避免把非法值持久化到动态属性里。
export function setConfig(key, value) {
    const item = CONFIG_SCHEMA[key];
    if (!item) return;
    const num = Number(value);
    mc.world.setDynamicProperty(item.prop, Number.isFinite(num) ? num : item.default);
}


// 取某一配置项的元信息（default / min / max / step / prop）。
// 主要供配置界面构造滑块（范围、步长、默认值）。未登记的 key 返回 undefined。
export function getConfigMeta(key) {
    return CONFIG_SCHEMA[key];
}


// 把 CONFIG_SCHEMA 中的所有数值项恢复为预设值。
// 注意：仅覆盖"数值参数"；getEmptyConfig() 中的复杂数据（坐标、物品列表等）不在本函数范围内。
export function resetConfigDefaults() {
    for (const key in CONFIG_SCHEMA) {
        setConfig(key, CONFIG_SCHEMA[key].default);
    }
}
