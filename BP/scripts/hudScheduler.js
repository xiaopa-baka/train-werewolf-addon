// @ts-check
// hudScheduler.js - 活动栏轮播调度器
// 多个功能都要占用活动栏时，由本调度器统一分配，避免互相覆盖：
// 各功能注册一个 provider，运行时逐玩家收集"此刻适用"的文案，
// 按权重占位后轮播；无适用文案时清空活动栏。

import * as mc from "@minecraft/server";


// 每隔多少 tick 切换一次文案（40 tick = 2 秒）
const ROTATE_TICKS = 40;

/** @typedef {(player: import("@minecraft/server").Player) => (string | import("@minecraft/server").RawMessage | undefined | null)} */

/** @type {Map<string, { getText: any, weight: number }>} */
const providers = new Map();


/**
 * 注册一个活动栏文案来源。
 * @param {string} id 唯一标识，重复注册会覆盖旧的
 * @param {any} getText 返回此刻该玩家应显示的文案；返回空串 / undefined / null 表示此刻不适用
 * @param {{ weight?: number }} [options] weight 越大，轮播中停留的份额越多（默认 1）
 */
export function registerActionBarProvider(id, getText, options = {}) {
    const weight = Math.max(1, Math.floor(options.weight ?? 1));
    providers.set(id, { getText, weight });
}


mc.system.runInterval(() => {
    const rotateIndex = Math.floor(mc.system.currentTick / ROTATE_TICKS);

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        /** @type {(string | import("@minecraft/server").RawMessage)[]} */
        const slots = [];
        for (const provider of providers.values()) {
            let text;
            try {
                text = provider.getText(player);
            } catch (e) {
                continue;
            }
            if (text === undefined || text === null || text === "") continue;
            for (let i = 0; i < provider.weight; i++) slots.push(text);
        }

        try {
            player.onScreenDisplay.setActionBar(slots.length === 0 ? "" : slots[rotateIndex % slots.length]);
        } catch (e) { }
    }
}, 1);