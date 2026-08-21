// @ts-check
// worldConfig.js - 管理世界配置的模块，提供获取和保存配置

import * as mc from "@minecraft/server";


// 获取世界配置对象
export function getEmptyConfig() {
    return {
        // 任务4 合法食物列表
        allowedFoods: [],
        
        // 任务5 合法饮品列表
        allowedDrinks: [],

        // 车头单点坐标
        trainEngineCoordinates: null,

        // 站台单点坐标
        trainStationCoordinates: null,

        // 列车区域 对角坐标
        trainCoordinates: {
            start: null,
            end: null
        },

        // 透气区 对角坐标
        ventilationAreas: {
            trainEngine: { start: null, end: null },
            trainTail: { start: null, end: null }
        },

        // 蹲坑坐标数组
        toiletCoordinates: [],

        // 随机传送坐标数组
        randomCoordinates: [],

        // 杀手商店物品列表
        killerShopItems: [],

        // 贩卖机物品列表
        vendingMachineItems: [],

        // 食物托盘物品列表
        foodTrayItems: {
            "lw_p1:food_tray": [],
            "lw_p1:food_tray_ceramic": [],
            "lw_p1:food_tray_glass": [],
            "lw_p1:food_tray_wood": []
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
    return { ...defaults, ...normalizedConfig };
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