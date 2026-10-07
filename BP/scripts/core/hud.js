// @ts-check
// hud.js - 活动栏轮播调度器 + 右侧常驻面板 + 标题显示工具

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

// subtitle 用于承载长文案：title 是特大号字且不会换行，长句必须放 subtitle 才不会溢出屏幕
export function showTitle(text, subtitle) {
    markTitleBusy(5 + 30 + 10);
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


// ===== 常驻面板（右侧信息面板 + 左上角任务面板）=====
// 面板控件定义在资源包 RP/ui/lw_p1_hud.json（info_panel / task_panel）。
// 由于脚本无法向自定义 UI 直接写数据，这里借道 title / subtitle 两条通道：
// 右面板文案加前缀关键字 "lwInfo:" 走 title，左面板文案加前缀关键字 "lwTask:" 走 subtitle，
// 用 setTitle 一次性发送（时长为 0，中央大字不受影响）；
// 资源包内的 preserved_title_display 组件只截获带关键字的对应通道内容并常驻显示。

const PANEL_KEYWORD = "lwInfo:";
const SUB_KEYWORD = "lwTask:";
const panelProviders = new Map();
const subProviders = new Map();
/** @type {Map<string, string>} playerId -> 上次已发送内容的指纹 */
const panelLastSent = new Map();
/** @type {Map<string, string>} playerId -> 上次已发送副通道内容的指纹 */
const subLastSent = new Map();
// 中央大字提示占用期间，暂停面板发送，避免把正在显示的中央提示顶掉
let titleBusyUntilTick = 0;

/**
 * 中央大字即将占用屏幕时调用，声明占用时长（tick）。
 * 占用期间右侧面板不发送，占用结束后自动补发变化的内容。
 */
export function markTitleBusy(ticks = 0) {
    titleBusyUntilTick = Math.max(titleBusyUntilTick, mc.system.currentTick + Math.max(0, ticks));
}

/**
 * 注册右侧常驻面板的文案来源。
 * getText 返回 undefined / null / "" 表示此刻无内容（面板隐藏）；
 * 返回字符串或 RawMessage 时显示在面板上（建议多行用 \n 分隔）。
 */
export function registerPanelProvider(id, getText) {
    panelProviders.set(id, getText);
}

/**
 * 注册副通道（subtitle）面板的文案来源。
 * 走 subtitle 通道，与主通道（title）彼此独立，可同时显示不同内容。
 */
export function registerSubPanelProvider(id, getText) {
    subProviders.set(id, getText);
}

// 从一组来源里取首个非空文案；全为空返回 undefined
function pickText(providers, player) {
    for (const provider of providers.values()) {
        let value;
        try {
            value = provider(player);
        } catch (e) {
            value = undefined;
        }
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
}

// 内容指纹（用于"只在变化时才发送"）
function textKey(text) {
    return text === undefined ? "" : (typeof text === "string" ? text : JSON.stringify(text));
}

// 把关键字和内容拼成发送负载；无内容时只发关键字，让面板清空
function buildPayload(keyword, text) {
    if (text === undefined) return { text: keyword };
    return typeof text === "string"
        ? { text: keyword + text }
        : { rawtext: [{ text: keyword }, text] };
}

mc.system.runInterval(() => {
    const busy = mc.system.currentTick < titleBusyUntilTick;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        const mainText = pickText(panelProviders, player);
        const subText = pickText(subProviders, player);

        const mainKey = textKey(mainText);
        const subKey = textKey(subText);
        if (panelLastSent.get(player.id) === mainKey && subLastSent.get(player.id) === subKey) continue;
        if (busy) continue;

        panelLastSent.set(player.id, mainKey);
        subLastSent.set(player.id, subKey);

        // 时长为 0：中央大字完全不显示、无残影，但 title / subtitle 文本仍会被写入
        try {
            player.onScreenDisplay.setTitle(buildPayload(PANEL_KEYWORD, mainText), {
                fadeInDuration: 0,
                stayDuration: 0,
                fadeOutDuration: 0,
                subtitle: buildPayload(SUB_KEYWORD, subText)
            });
        } catch (e) { }
    }
}, 1);

mc.world.afterEvents.playerLeave.subscribe((event) => {
    panelLastSent.delete(event.playerId);
    subLastSent.delete(event.playerId);
});


// ===== 屏幕转场 =====

/**
 * 黑屏转场：缓慢变黑 → 全黑瞬间执行回调 → 缓慢恢复
 * @param {mc.Player[]} players 应用转场的玩家
 * @param {{ fadeInTime?: number, holdTime?: number, fadeOutTime?: number }} [options] 各段时长（秒）
 * @param {() => void} [onFullBlack] 全黑瞬间执行（如传送）
 */
export function fadeBlackTransition(players, options, onFullBlack) {
    const fadeInTime = options?.fadeInTime ?? 1.5;
    const holdTime = options?.holdTime ?? 0.5;
    const fadeOutTime = options?.fadeOutTime ?? 1.5;

    for (const player of players) {
        if (!player?.isValid) continue;
        try {
            player.camera.fade({
                fadeColor: { red: 0, green: 0, blue: 0 },
                fadeTime: { fadeInTime, holdTime, fadeOutTime }
            });
        } catch (e) { }
    }

    // Camera.fade 只在客户端播放，服务端以时长估算"全黑"时刻
    if (onFullBlack) {
        mc.system.runTimeout(() => {
            try { onFullBlack(); } catch (e) { }
        }, Math.max(1, Math.ceil(fadeInTime * 20)));
    }
}