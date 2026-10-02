// @ts-check
// inGameSystem.js - 局内系统（体力 + 跳跃），对应配置界面的「局内相关配置」开关
//
// 体力（疾跑耐久）：全局生效，不限游戏状态与游戏模式
//   疾跑持续消耗体力 -> 体力耗尽把饱食度压在 6（原版规则：饱食度 ≤6 无法疾跑）
//   -> 停止疾跑一段时间后体力缓慢恢复 -> 回到阈值解除饱食度压制，恢复疾跑
//
// 跳跃：由世界配置 jumpEnabled 控制，周期性向所有在线玩家下发跳跃输入权限

import * as mc from "@minecraft/server";
import { getWorldConfig } from "./config/worldConfig.js";
import { registerActionBarProvider } from "./hudScheduler.js";
import { t } from "./i18n/i18n.js";


// ============================ 体力（疾跑耐久）系统 ============================

// ——— 可调参数 ———
const STAMINA_MAX = 100;          // 体力上限
const DRAIN_PER_TICK = 0.5;       // 疾跑每 tick 消耗（200 tick ≈ 10 秒耗尽）
const REGEN_PER_TICK = 0.2;       // 恢复每 tick 回复（500 tick ≈ 25 秒回满）
const REGEN_DELAY_TICKS = 60;     // 停止疾跑后延迟多久才开始恢复（3 秒）
const RECOVER_THRESHOLD = 30;     // 体力回到该值才解除禁跑
const EXHAUST_HUNGER = 2;         // 力竭时把饱食度压到 2（≤6 无法疾跑；取 2 以防和平模式自然恢复过快）
const MIN_SPRINT_HUNGER = 7;      // 解除力竭时至少恢复到 7（>6 才能疾跑）

// 排查用日志开关：打开后每秒输出一次每个玩家的体力状态；确认无误后可关掉
const DEBUG_LOG = false;

// 力竭期间记录"力竭前的饱食度"，存玩家动态属性以便跨会话保留（避免退出后卡在低饱食度）
const HUNGER_LOCK_KEY = "lw_p1:staminaHungerLock";


// playerId -> { value, exhausted, lastSprintTick, savedHunger }
const staminaMap = new Map();

// 体力系统是否启用（由世界配置决定，每条 tick 刷新）
let staminaEnabled = true;


// 获取玩家的 hunger 属性组件（读写饱食度）
function getHunger(player) {
    try {
        return player.getComponent("minecraft:player.hunger");
    } catch (e) {
        return undefined;
    }
}


// 按动态属性里的记录还原饱食度并清锁（用于关闭体力系统、或玩家上线兜底）
function restoreFromLock(player) {
    try {
        const lock = player.getDynamicProperty(HUNGER_LOCK_KEY);
        if (typeof lock !== "number") return;
        const hunger = getHunger(player);
        if (hunger) {
            const max = hunger.effectiveMax ?? 20;
            hunger.setCurrentValue(Math.min(Math.max(lock, MIN_SPRINT_HUNGER), max));
        }
        player.setDynamicProperty(HUNGER_LOCK_KEY, undefined);
    } catch (e) { }
}


// 进入力竭：记录当前饱食度并压到 6
function enterExhausted(player, state) {
    const hunger = getHunger(player);
    if (!hunger) return;
    try {
        state.savedHunger = hunger.currentValue;
        player.setDynamicProperty(HUNGER_LOCK_KEY, state.savedHunger);
        hunger.setCurrentValue(EXHAUST_HUNGER);
    } catch (e) { }
}


// 力竭期间持续压制饱食度（防止吃东西后又重新站起来疾跑）
function holdHunger(player) {
    const hunger = getHunger(player);
    if (!hunger) return;
    try {
        if (hunger.currentValue > EXHAUST_HUNGER) {
            hunger.setCurrentValue(EXHAUST_HUNGER);
        }
    } catch (e) { }
}


// 解除力竭：把饱食度还原到力竭前的值（至少 7，且不超过上限），并清掉锁
function restoreHunger(player, state) {
    try { player.setDynamicProperty(HUNGER_LOCK_KEY, undefined); } catch (e) { }
    const hunger = getHunger(player);
    if (!hunger) return;
    try {
        const max = hunger.effectiveMax ?? 20;
        const target = Math.min(Math.max(state.savedHunger ?? max, MIN_SPRINT_HUNGER), max);
        hunger.setCurrentValue(target);
    } catch (e) { }
}


function createState() {
    return {
        value: STAMINA_MAX,
        exhausted: false,
        lastSprintTick: -REGEN_DELAY_TICKS,
        savedHunger: null
    };
}


// 把体力画成 10 格的进度条
const BAR_SEGMENTS = 10;
function staminaBar(value) {
    const filled = Math.max(0, Math.min(BAR_SEGMENTS, Math.round(value / STAMINA_MAX * BAR_SEGMENTS)));
    return "█".repeat(filled) + "░".repeat(BAR_SEGMENTS - filled);
}


// 注册到活动栏调度器：仅玩家自己看得到（活动栏天然按玩家单独下发），创造模式不显示
registerActionBarProvider("lw_p1:stamina", (player) => {
    if (!staminaEnabled) return undefined;

    let isCreative = false;
    try { isCreative = player.getGameMode() === mc.GameMode.Creative; } catch (e) { }
    if (isCreative) return undefined;

    const state = staminaMap.get(player.id);
    if (!state) return undefined;

    // 体力已满时不占用活动栏
    if (state.value >= STAMINA_MAX) return undefined;

    const bar = staminaBar(state.value);
    const value = Math.round(state.value);
    return state.exhausted
        ? t("lw_p1.hud.stamina.exhausted", bar, value)
        : t("lw_p1.hud.stamina", bar, value);
}, { weight: 1 });


mc.system.runInterval(() => {
    const tick = mc.system.currentTick;
    staminaEnabled = getWorldConfig().staminaEnabled !== false;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        // 体力系统关闭：清掉状态并还原可能被压制的饱食度
        if (!staminaEnabled) {
            staminaMap.delete(player.id);
            restoreFromLock(player);
            continue;
        }

        // 创造模式跳过
        let isCreative = false;
        try { isCreative = player.getGameMode() === mc.GameMode.Creative; } catch (e) { }
        if (isCreative) continue;

        let state = staminaMap.get(player.id);
        if (!state) {
            state = createState();
            staminaMap.set(player.id, state);

            // 若上次是力竭状态退出（存在锁），上线先还原饱食度，避免一上线就跑不动
            restoreFromLock(player);
        }

        const sprinting = player.isSprinting;

        if (sprinting && !state.exhausted) {
            // 疾跑中：持续消耗体力
            state.lastSprintTick = tick;
            state.value -= DRAIN_PER_TICK;
            if (state.value <= 0) {
                state.value = 0;
                state.exhausted = true;
                enterExhausted(player, state);
            }
        } else if (tick - state.lastSprintTick >= REGEN_DELAY_TICKS) {
            // 停止疾跑（或已力竭）一段时间后：缓慢恢复
            if (state.value < STAMINA_MAX) {
                state.value = Math.min(STAMINA_MAX, state.value + REGEN_PER_TICK);
            }
        }

        if (state.exhausted) {
            // 力竭期间全程压制饱食度
            holdHunger(player);
            if (state.value >= RECOVER_THRESHOLD) {
                state.exhausted = false;
                restoreHunger(player, state);
            }
        }

        if (DEBUG_LOG && tick % 20 === 0) {
            console.log(`[体力] ${player.name} 疾跑=${sprinting} 体力=${state.value.toFixed(1)} 力竭=${state.exhausted}`);
        }
    }
}, 1);


// 玩家离开：清理内存状态（动态属性锁保留，供下次上线还原）
mc.world.afterEvents.playerLeave.subscribe((event) => {
    staminaMap.delete(event.playerId);
});


// ============================ 跳跃开关 ============================

// 跳跃输入权限会随玩家重登/重生重置，所以周期性重新下发，保证开关始终生效
mc.system.runInterval(() => {
    const jumpEnabled = getWorldConfig().jumpEnabled !== false;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        try {
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Jump, jumpEnabled);
        } catch (e) { }
    }
}, 20);