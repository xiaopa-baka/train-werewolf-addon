// @ts-check
// staminaSystem.js - 体力（疾跑耐久）系统
// 机制：疾跑持续消耗体力 -> 体力耗尽把饱食度压在 6（原版规则：饱食度 ≤6 无法疾跑）
//      -> 停止疾跑一段时间后体力缓慢恢复 -> 回到阈值后解除饱食度压制，恢复疾跑

import * as mc from "@minecraft/server";


// ——— 可调参数 ———
const STAMINA_MAX = 100;          // 体力上限
const DRAIN_PER_TICK = 0.5;       // 疾跑每 tick 消耗（200 tick ≈ 10 秒耗尽）
const REGEN_PER_TICK = 0.2;       // 恢复每 tick 回复（500 tick ≈ 25 秒回满）
const REGEN_DELAY_TICKS = 60;     // 停止疾跑后延迟多久才开始恢复（3 秒）
const RECOVER_THRESHOLD = 50;     // 体力回到该值才解除禁跑
const EXHAUST_HUNGER = 6;         // 力竭时把饱食度压到 6（≤6 无法疾跑）
const MIN_SPRINT_HUNGER = 7;      // 解除力竭时至少恢复到 7（>6 才能疾跑）


// playerId -> { value, exhausted, lastSprintTick, savedHunger }
const staminaMap = new Map();


// 获取玩家的 hunger 属性组件（读写饱食度）
function getHunger(player) {
    try {
        return player.getComponent("minecraft:player.hunger");
    } catch (e) {
        return undefined;
    }
}


// 创造 / 旁观不参与体力系统
function shouldSkip(player) {
    try {
        const mode = player.getGameMode();
        if (mode === mc.GameMode.Creative || mode === mc.GameMode.Spectator) return true;
    } catch (e) { }
    return false;
}


// 进入力竭：记录当前饱食度并压到 6
function enterExhausted(player, state) {
    const hunger = getHunger(player);
    if (!hunger) return;
    try {
        state.savedHunger = hunger.currentValue;
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


// 解除力竭：把饱食度还原到力竭前的值（至少 7，且不超过上限）
function restoreHunger(player, state) {
    const hunger = getHunger(player);
    if (!hunger) return;
    try {
        const max = hunger.effectiveMax ?? 20;
        const target = Math.min(Math.max(state.savedHunger ?? max, MIN_SPRINT_HUNGER), max);
        hunger.setCurrentValue(target);
    } catch (e) { }
}


mc.system.runInterval(() => {
    const tick = mc.system.currentTick;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        // 非游戏内 / 创造 / 旁观：清状态，但若正力竭先还原饱食度，避免卡在低饱食度
        if (!player.hasTag("lw_p1:游戏中") || shouldSkip(player)) {
            const state = staminaMap.get(player.id);
            if (state) {
                if (state.exhausted) restoreHunger(player, state);
                staminaMap.delete(player.id);
            }
            continue;
        }

        let state = staminaMap.get(player.id);
        if (!state) {
            state = {
                value: STAMINA_MAX,
                exhausted: false,
                lastSprintTick: -REGEN_DELAY_TICKS,
                savedHunger: null
            };
            staminaMap.set(player.id, state);
        }

        if (player.isSprinting && !state.exhausted) {
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
    }
}, 1);


// 玩家离开：清理状态
mc.world.afterEvents.playerLeave.subscribe((event) => {
    staminaMap.delete(event.playerId);
});