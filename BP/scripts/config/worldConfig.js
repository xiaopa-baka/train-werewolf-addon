// @ts-check
// worldConfig.js - 管理世界配置的模块，提供获取和保存配置

import * as mc from "@minecraft/server";


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