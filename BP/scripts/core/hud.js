// @ts-check
// hud.js - 活动栏轮播调度器 + 标题显示工具

import * as mc from "@minecraft/server";

// 输出测试日志，确认脚本已加载，同时声明版权信息
console.log("\n©\nXiaopa baka\nLW Realm Studio");


// ===== 活动栏轮播调度器 =====
// 多个功能都要占用活动栏时统一分配：各功能提供文案，按权重轮播；
// 无适用文案时清空；任务进度条等外部独占时让位。

const ACTION_BAR_ROTATE_TICKS = 40;   // 每隔多少 tick 切换一次文案（40 tick = 2 秒）
const actionBarProviders = new Map();

// 注册一个活动栏文案来源；getText 返回空串 / undefined / null 表示此刻不适用；
// options.exclusive = true 时，只要它返回文案就独占活动栏，其余来源本轮不参与轮播
export function registerActionBarProvider(id, getText, options = {}) {
    const weight = Math.max(1, Math.floor(options.weight ?? 1));
    actionBarProviders.set(id, { getText, weight, exclusive: !!options.exclusive });
}

mc.system.runInterval(() => {
    const rotateIndex = Math.floor(mc.system.currentTick / ACTION_BAR_ROTATE_TICKS);

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        let exclusiveText;
        const slots = [];
        for (const provider of actionBarProviders.values()) {
            let text;
            try {
                text = provider.getText(player);
            } catch (e) {
                continue;
            }
            if (text === undefined || text === null || text === "") continue;
            if (provider.exclusive) {
                exclusiveText = text;
                break;
            }
            for (let i = 0; i < provider.weight; i++) slots.push(text);
        }

        try {
            if (exclusiveText !== undefined) {
                player.onScreenDisplay.setActionBar(exclusiveText);
            } else {
                player.onScreenDisplay.setActionBar(slots.length === 0 ? "" : slots[rotateIndex % slots.length]);
            }
        } catch (e) { }
    }
}, 1);


export function clearTitle() {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        player.runCommand("title @s clear");
    }
}

export function clearCountdown() {
    clearTitle();
}

// subtitle 用于承载长文案：title 是特大号字且不会换行，长句必须放 subtitle 才不会溢出屏幕
export function showTitle(text, subtitle) {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        player.onScreenDisplay.setTitle(text, {
            fadeInDuration: 5,
            stayDuration: 30,
            fadeOutDuration: 10,
            subtitle: subtitle
        });
    }
}