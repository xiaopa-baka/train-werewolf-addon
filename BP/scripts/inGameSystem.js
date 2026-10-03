// @ts-check
// inGameSystem.js - 局内系统（体力 + 跳跃）

import * as mc from "@minecraft/server";
import { getWorldConfig } from "./config/worldConfig.js";


// 体力（疾跑耐久）系统
// 固定阈值在此；消耗 / 恢复速率由 worldConfig.js 提供（单位：点 / 秒）
const STAMINA_MAX = 100;          // 体力上限
const TICKS_PER_SECOND = 20;      // 1 秒 = 20 tick
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

// 以下参数由世界配置决定，每 tick 刷新
let staminaEnabled = true;
let staminaDrainPerTick = 0.5;    // 疾跑每 tick 消耗（= 每秒消耗 / 20）
let staminaRegenPerTick = 0.2;    // 恢复每 tick 回复（= 每秒恢复 / 20）
let killerStamina = true;         // 杀手是否有体力值


// 获取玩家的 hunger 属性组件（读写饱食度）
function getHunger(player) {
    try {
        return player.getComponent("minecraft:player.hunger");
    } catch (e) {
        return undefined;
    }
}


// 是否免体力：创造模式，或关闭"杀手体力值"后的杀手（可无限疾跑）
function isStaminaExempt(player) {
    let isCreative = false;
    try { isCreative = player.getGameMode() === mc.GameMode.Creative; } catch (e) { }
    if (isCreative) return true;
    if (!killerStamina && player.hasTag("lw_p1:杀手")) return true;
    return false;
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


// 体力条文案（由 main.js 注册到活动栏调度器）：仅玩家自己看得到（活动栏天然按玩家单独下发）
export function staminaHudText(player) {
    if (!staminaEnabled || !player.hasTag("lw_p1:游戏中")) return undefined;
    if (isStaminaExempt(player)) return undefined;

    const state = staminaMap.get(player.id);
    if (!state) return undefined;

    // 体力已满时不占用活动栏
    if (state.value >= STAMINA_MAX) return undefined;

    const bar = staminaBar(state.value);
    const value = Math.round(state.value);
    return state.exhausted
        ? `§c体力 ${bar} §f${value}`
        : `§b体力 ${bar} §f${value}`;
}


mc.system.runInterval(() => {
    const tick = mc.system.currentTick;
    const config = getWorldConfig();
    staminaEnabled = config.staminaEnabled !== false;
    killerStamina = config.killerStamina !== false;
    staminaDrainPerTick = (config.staminaDrainPerSecond ?? 10) / TICKS_PER_SECOND;
    staminaRegenPerTick = (config.staminaRegenPerSecond ?? 4) / TICKS_PER_SECOND;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        // 只在"游戏中"生效：体力系统关闭、不在局内、或免体力（创造 / 关闭杀手体力后的杀手）时，
        // 清状态并还原可能被压制的饱食度
        if (!staminaEnabled || !player.hasTag("lw_p1:游戏中") || isStaminaExempt(player)) {
            staminaMap.delete(player.id);
            restoreFromLock(player);
            continue;
        }

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
            state.value -= staminaDrainPerTick;
            if (state.value <= 0) {
                state.value = 0;
                state.exhausted = true;
                enterExhausted(player, state);
            }
        } else if (tick - state.lastSprintTick >= REGEN_DELAY_TICKS) {
            // 停止疾跑（或已力竭）一段时间后：缓慢恢复
            if (state.value < STAMINA_MAX) {
                state.value = Math.min(STAMINA_MAX, state.value + staminaRegenPerTick);
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
    hudHiddenMap.delete(event.playerId);
});


// 跳跃开关
mc.system.runInterval(() => {
    const jumpEnabled = getWorldConfig().jumpEnabled !== false;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        // 只在"游戏中"生效；局外一律恢复可跳跃，避免出局后仍被禁跳
        const allowJump = !player.hasTag("lw_p1:游戏中") || jumpEnabled;
        try {
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Jump, allowJump);
        } catch (e) { }
    }
}, 20);


// 局内隐藏 HUD：生命条 / 饥饿条 / 状态效果
// 用 /hud 指令控制，按玩家持久保存；只在"游戏中"标签出现/消失导致状态变化时才下发一次
const HUD_ELEMENTS = ["health", "hunger", "status_effects"];
const hudHiddenMap = new Map();   // playerId -> 当前是否已对该玩家隐藏

function applyHudVisibility(player, hide) {
    for (const element of HUD_ELEMENTS) {
        try {
            player.runCommand(`hud @s ${hide ? "hide" : "reset"} ${element}`);
        } catch (e) { }
    }
}

mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        const shouldHide = player.hasTag("lw_p1:游戏中");
        if (hudHiddenMap.get(player.id) === shouldHide) continue;
        applyHudVisibility(player, shouldHide);
        hudHiddenMap.set(player.id, shouldHide);
    }
}, 20);