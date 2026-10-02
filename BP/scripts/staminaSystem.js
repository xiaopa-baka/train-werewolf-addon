// @ts-check
// staminaSystem.js - 体力（疾跑耐久）系统
// 全局生效，不限游戏状态与游戏模式
// 疾跑持续消耗体力 -> 体力耗尽把饱食度压在 6（原版规则：饱食度 ≤6 无法疾跑）
// -> 停止疾跑一段时间后体力缓慢恢复 -> 回到阈值解除饱食度压制，恢复疾跑

import * as mc from "@minecraft/server";


// ——— 可调参数 ———
const STAMINA_MAX = 100;          // 体力上限
const DRAIN_PER_TICK = 0.5;       // 疾跑每 tick 消耗（200 tick ≈ 10 秒耗尽）
const REGEN_PER_TICK = 0.2;       // 恢复每 tick 回复（500 tick ≈ 25 秒回满）
const REGEN_DELAY_TICKS = 60;     // 停止疾跑后延迟多久才开始恢复（3 秒）
const RECOVER_THRESHOLD = 50;     // 体力回到该值才解除禁跑
const EXHAUST_HUNGER = 6;         // 力竭时把饱食度压到 6（≤6 无法疾跑）
const MIN_SPRINT_HUNGER = 7;      // 解除力竭时至少恢复到 7（>6 才能疾跑）

// 排查用日志开关：打开后每秒输出一次每个玩家的体力状态；确认无误后可关掉
const DEBUG_LOG = true;

// 力竭期间记录"力竭前的饱食度"，存玩家动态属性以便跨会话保留（避免退出后卡在低饱食度）
const HUNGER_LOCK_KEY = "lw_p1:staminaHungerLock";


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


mc.system.runInterval(() => {
    const tick = mc.system.currentTick;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        let state = staminaMap.get(player.id);
        if (!state) {
            state = createState();
            staminaMap.set(player.id, state);

            // 若上次是力竭状态退出（存在锁），上线先还原饱食度，避免一上线就跑不动
            try {
                const lock = player.getDynamicProperty(HUNGER_LOCK_KEY);
                if (typeof lock === "number") {
                    const hunger = getHunger(player);
                    if (hunger) {
                        const max = hunger.effectiveMax ?? 20;
                        hunger.setCurrentValue(Math.min(Math.max(lock, MIN_SPRINT_HUNGER), max));
                    }
                    player.setDynamicProperty(HUNGER_LOCK_KEY, undefined);
                }
            } catch (e) { }
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