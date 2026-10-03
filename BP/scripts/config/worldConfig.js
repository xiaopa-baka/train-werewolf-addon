// @ts-check
// worldConfig.js - 管理世界配置的模块，提供获取和保存配置

import * as mc from "@minecraft/server";


// 计分板参数统一配置表
// 字段说明：
//   default          预设分数（计分板初始值 / 恢复默认值）
//   min / max / step 配置UI 滑块范围；未写 min 的项不提供滑块（即不可调）
export const SCOREBOARD_CONFIG = {
    // 游戏相关
    "lw_p1:是否自动开始":     { default: 1 },
    "lw_p1:游戏自动开始时间": { default: 10,  min: 0,   max: 60,   step: 5 },
    "lw_p1:最低开局人数":     { default: 5,   min: 5,   max: 15,   step: 1 },
    "lw_p1:单局游戏基础时长": { default: 600, min: 300, max: 1200, step: 20 },

    // 任务相关
    "lw_p1:每秒分配概率":     { default: 3,   min: 0,   max: 20,   step: 1 },
    "lw_p1:任务开始发布时间": { default: 20,  min: 0,   max: 60,   step: 10 },
    "lw_p1:单个任务限时":     { default: 100, min: 60,  max: 180,  step: 10 },
    "lw_p1:杀手虚假任务限时": { default: 50,  min: 20,  max: 60,   step: 10 },
    "lw_p1:任务完成奖励":     { default: 25,  min: 10,  max: 50,   step: 5 },

    // 金币相关
    "lw_p1:杀手初始金币":     { default: 100, min: 0,   max: 500,  step: 50 },
    "lw_p1:平民初始金币":     { default: 0,   min: 0,   max: 500,  step: 50 },
    "lw_p1:杀手金币增速":     { default: 15,  min: 0,   max: 30,   step: 5 },
    "lw_p1:平民金币增速":     { default: 0,   min: 0,   max: 10,   step: 2 },

    // 地图相关
    "lw_p1:房间数":           { default: 8,   min: 1,   max: 8,    step: 1 },
};


// 获取世界配置对象
export function getEmptyConfig() {
    return {
        // 任务4 合法食物列表
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

        // 任务5 合法饮品列表
        allowedDrinks: [
            "lw_p1:old_fashioned",          // 古典鸡尾酒
            "lw_p1:mojito",                 // 莫吉托
            "lw_p1:martini",                // 马提尼
            "lw_p1:cosmopolitan",           // 大都会鸡尾酒
            "lw_p1:champagne",              // 香槟
            "lw_p1:mineral_water",          // 矿泉水
        ],

        // 车头单点坐标
        trainEngineCoordinates: {
            x: 0.5,
            y: 0.5,
            z: 0.5
        },

        // 站台单点坐标
        trainStationCoordinates: null,

        // 列车区域 对角坐标
        trainCoordinates: {
            start: null,
            end: null
        },

        // 透气区 对角坐标
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

        // 蹲坑坐标数组
        toiletCoordinates: [],

        // 随机传送坐标数组
        randomCoordinates: [],

        // 杀手商店物品列表
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

        // 贩卖机物品列表
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

        // 食物托盘物品列表
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

        // 局内相关开关
        staminaEnabled: true,           // 体力系统：关闭后疾跑不再消耗体力
        jumpEnabled: true,              // 是否允许跳跃：关闭后玩家无法跳跃
        staminaDrainPerSecond: 10,      // 疾跑每秒消耗的体力（范围 2-20，步长 2）
        staminaRegenPerSecond: 4,       // 停止疾跑后每秒恢复的体力（范围 2-20，步长 2）
        killerStamina: true,            // 杀手体力值：关闭后杀手没有体力值，可以无限疾跑

        // 地图信息
        worldInformation: {
            mapName: "",
            mapAuthor: ""
        },
    };
}


// 填充默认配置
function fillDefaultConfig(inputConfig) {
    const defaults = getEmptyConfig();
    const normalizedConfig = {
        ...inputConfig,
        vendingMachineItems: inputConfig.vendingMachineItems ?? inputConfig.VendingMachineItems ?? []
    };
    const result = { ...defaults, ...normalizedConfig };
    if (!result.worldInformation) result.worldInformation = {};
    const wiDefaults = defaults.worldInformation;
    result.worldInformation = { ...wiDefaults, ...result.worldInformation };
    return result;
}


// 获取世界配置，如果不存在则返回空配置
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


// 保存世界配置
export function saveWorldConfig(config) {
    mc.world.setDynamicProperty("lw_p1:config", JSON.stringify(config));
}


// 取某计分板的预设分数（表中没有则返回 fallback）
export function getScoreboardDefault(name, fallback = 0) {
    const item = SCOREBOARD_CONFIG[name];
    return item ? item.default : fallback;
}


// 取某计分板的滑块参数（不可调则返回 undefined）
export function getScoreboardSlider(name) {
    const item = SCOREBOARD_CONFIG[name];
    if (!item || item.min === undefined) return undefined;
    return { min: item.min, max: item.max, step: item.step, defaultValue: item.default };
}


// 生成"全部可调计分板"的预设分数对象（用于计分板初始化 / 恢复默认配置）
export function getAllScoreboardDefaults() {
    const result = {};
    for (const name in SCOREBOARD_CONFIG) {
        result[name] = SCOREBOARD_CONFIG[name].default;
    }
    return result;
}