// @ts-check
// tasks.js - 任务系统

import * as mc from "@minecraft/server";
import { getWorldConfig, getConfig } from "../config/worldConfig.js";
import {
    getGameTicks,
    getTaskProgress, setTaskProgress, addTaskProgress, resetTaskProgress, clearTaskProgress,
    addGold, addDeathExtra, getPlayerState, isInGame, isKiller,
} from "../core/state.js";
import { t } from "../core/i18n.js";
import { registerActionBarProvider } from "../core/hud.js";


// ===== 任务定义表 =====
//   mode: "reset"      离开判定区域即清零（任务1/2）
//         "accumulate" 累计不清零（任务3/6）
//         "event"      由进食/饮用事件直接加分，不参与逐 tick 累计（任务4/5）
//   stateField 该状态为真时每 tick +1
//   threshold 完成所需进度（tick 数：200 = 10 秒，100 = 5 秒，300 = 15 秒）
//   steps     进度条档位：取 <= 当前进度的最大档
const TASKS = {
    1: {
        mode: "reset", stateField: "ventilating", threshold: 200,
        steps: [
            { at: 1, bar: "§c▓▓▓▓▓" },
            { at: 40, bar: "§c▓▓▓▓" },
            { at: 80, bar: "§6▓▓▓" },
            { at: 120, bar: "§6▓▓" },
            { at: 160, bar: "§a▓" },
        ],
    },
    2: {
        mode: "reset", stateField: "squatting", threshold: 200,
        steps: [
            { at: 1, bar: "§c▓▓▓▓▓" },
            { at: 40, bar: "§c▓▓▓▓" },
            { at: 80, bar: "§6▓▓▓" },
            { at: 120, bar: "§6▓▓" },
            { at: 160, bar: "§a▓" },
        ],
    },
    3: {
        mode: "accumulate", stateField: "sleeping", threshold: 100,
        steps: [
            { at: 1, bar: "§c▓▓▓▓▓" },
            { at: 20, bar: "§c▓▓▓▓" },
            { at: 40, bar: "§6▓▓▓" },
            { at: 60, bar: "§6▓▓" },
            { at: 80, bar: "§a▓" },
        ],
    },
    4: {
        mode: "event", threshold: 1,
        steps: [{ at: 1, bar: "§a▓" }],
    },
    5: {
        mode: "event", threshold: 1,
        steps: [{ at: 1, bar: "§a▓" }],
    },
    6: {
        mode: "accumulate", stateField: "socializing", threshold: 300,
        steps: [
            { at: 1, bar: "§c▓▓▓▓▓▓" },
            { at: 50, bar: "§c▓▓▓▓▓" },
            { at: 100, bar: "§6▓▓▓▓" },
            { at: 150, bar: "§6▓▓▓" },
            { at: 200, bar: "§6▓▓" },
            { at: 250, bar: "§a▓" },
        ],
    },
};

// 提示（下）的惩罚效果：经验等级（=剩余秒数）降到 20 时施加，持续 20 秒
const TASK_HINT3_EFFECTS = {
    1: [["minecraft:nausea", 0], ["minecraft:poison", 0]],
    2: [["minecraft:speed", 2], ["minecraft:poison", 0]],
    3: [["minecraft:darkness", 0], ["minecraft:slow_falling", 0]],
    4: [["minecraft:hunger", 0], ["minecraft:slowness", 2]],
    5: [["minecraft:weakness", 0], ["minecraft:slowness", 2]],
    6: [["minecraft:invisibility", 0], ["minecraft:blindness", 0]],
};

// 需要逐 tick 累计进度的任务
const RUNNING_TASK_IDS = [1, 2, 3, 6];


// 玩家当前持有的任务编号（1..任务数），无任务则返回 0
function getTaskId(player) {
    const id = getPlayerState(player).taskId;
    return id > 0 ? id : 0;
}


// 任务进度条文案（供活动栏调度器使用）；无进度时返回 undefined
export function getTaskBarText(player) {
    if (!isInGame(player)) return undefined;
    if (isKiller(player)) return undefined;

    const value = getTaskProgress(player);
    if (value <= 0) return undefined;

    const def = TASKS[getTaskId(player)];
    if (!def) return undefined;

    // 进度条仅在处于该任务的判定状态时显示
    if (def.stateField && !getPlayerState(player)[def.stateField]) return undefined;

    let bar;
    for (const step of def.steps) {
        if (value >= step.at) bar = step.bar;
        else break;
    }
    return bar;
}


// 游戏开始后按概率给无任务玩家分配随机任务
mc.system.runInterval(() => {
    const players = Array.from(mc.world.getPlayers());
    if (players.length === 0) return;

    const maxTask = getConfig("taskCount") || 6;
    const publishTime = getConfig("taskFirstDelay");
    const chance = Math.min(Math.max(getConfig("taskChance") / 100, 0), 1);

    // 距开局不足发布时间则不发任务
    if (getGameTicks() / 20 < publishTime) return;

    for (const player of players) {
        if (!player.isValid) continue;
        if (!isInGame(player) || getPlayerState(player).taskId > 0) continue;

        if (Math.random() < chance) {
            const taskNum = Math.floor(Math.random() * maxTask) + 1;
            getPlayerState(player).taskId = taskNum;
            player.addLevels(1);
        }
    }
}, 20);


// 请求倒计时 → 写入限时经验等级 → 每秒扣 1 级
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        // 获得任务后先挂上"请求倒计时"
        if (isInGame(player) && getPlayerState(player).taskId > 0
            && !getPlayerState(player).taskCountdown && !getPlayerState(player).taskRequestCountdown) {
            getPlayerState(player).taskRequestCountdown = true;
        }

        // 请求倒计时：把限时写入经验等级（杀手用虚假任务限时）
        if (getPlayerState(player).taskRequestCountdown) {
            const limit = isKiller(player)
                ? getConfig("fakeTaskLimit")
                : getConfig("taskLimit");
            if (limit > 0) player.addLevels(limit);
            getPlayerState(player).taskRequestCountdown = false;
            getPlayerState(player).taskCountdown = true;
        }

        // 倒计时中每秒扣 1 级
        if (isInGame(player) && getPlayerState(player).taskCountdown) {
            player.addLevels(-1);
        }
    }
}, 20);


// 任务提示：每秒按经验等级（=剩余秒数）触发
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!getPlayerState(player).taskCountdown) continue;

        const level = player.level;
        const taskId = getTaskId(player);

        if (isKiller(player)) {
            // 杀手的虚假任务提示 + 标记已提示 + 临近结束自动完成
            if (taskId && !getPlayerState(player).taskHinted && level >= 20 && level <= 60) {
                player.sendMessage(t(`lw_p1.task.fake.${taskId}`));
            }
            if (getPlayerState(player).taskId > 0 && !getPlayerState(player).taskHinted
                && level >= 20 && level <= 60) {
                getPlayerState(player).taskHinted = true;
            }
            if (isInGame(player) && getPlayerState(player).taskId > 0 && level === 1) {
                getPlayerState(player).taskDone = true;
            }
            continue;
        }

        // 首次提示：等级落在 [60,180] 时提示一次
        if (level >= 60 && level <= 180) {
            if (taskId && !getPlayerState(player).taskHinted) {
                player.sendMessage(t(`lw_p1.task.${taskId}.hint1`));
            }
            if (getPlayerState(player).taskId > 0 && !getPlayerState(player).taskHinted) {
                getPlayerState(player).taskHinted = true;
            }
        }
        // 进入 40 秒提示
        if (taskId && level === 40) {
            player.sendMessage(t(`lw_p1.task.${taskId}.hint2`));
        }
        // 进入 20 秒提示并施加惩罚效果
        if (taskId && level === 20) {
            player.sendMessage(t(`lw_p1.task.${taskId}.hint3`));
            for (const [effectId, amplifier] of TASK_HINT3_EFFECTS[taskId] ?? []) {
                try { player.addEffect(effectId, 400, { amplifier, showParticles: true }); } catch (e) { }
            }
        }
    }
}, 20);


// 任务进度逐 tick 累计（任务1/2/3/6）+ 完成判定
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!isInGame(player)) continue;

        const taskId = getTaskId(player);
        const def = TASKS[taskId];
        if (!def) continue;

        // 事件型任务（4/5）由进食/饮用事件加分，不参与逐 tick 累计，但仍需在此判定完成
        if (def.mode !== "event") {
            if (getPlayerState(player)[def.stateField]) {
                addTaskProgress(player, 1);
            } else if (def.mode === "reset") {
                setTaskProgress(player, 0);
            }
        }

        if (getTaskProgress(player) >= def.threshold) {
            if (!isKiller(player) && !getPlayerState(player).taskDone) {
                player.sendMessage(t("lw_p1.task.done"));
            }
            getPlayerState(player).taskDone = true;
        }
    }
}, 1);


// 任务完成：清状态位、重置进度与经验、发金币奖励
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!getPlayerState(player).taskDone) continue;

        // 仅平民/警员发奖励
        if (!isKiller(player) && !getPlayerState(player).rewardGiven) {
            const reward = getConfig("taskReward");
            if (reward > 0) addGold(player, reward);
            getPlayerState(player).rewardGiven = true;
        }

        getPlayerState(player).taskId = 0;
        getPlayerState(player).taskCountdown = false;
        getPlayerState(player).taskHinted = false;
        getPlayerState(player).rewardGiven = false;

        resetTaskProgress(player);
        player.addLevels(-1000);

        getPlayerState(player).taskDone = false;
    }
}, 1);


// 全局冷却缓存（供任务4/5使用）
const scoreCooldown = new Map();
const COOLDOWN_TIME = 2000;


// 任务1，车头/车尾通风区域，通风中 状态位
mc.system.runInterval(function () {
    const latestConfig = getWorldConfig();

    const engineStart = latestConfig.ventilationAreas.trainEngine.start;
    const engineEnd = latestConfig.ventilationAreas.trainEngine.end;
    const tailStart = latestConfig.ventilationAreas.trainTail.start;
    const tailEnd = latestConfig.ventilationAreas.trainTail.end;

    const allPlayers = mc.world.getPlayers();

    if (!engineStart || !engineEnd || !tailStart || !tailEnd) return;

    const engMinX = Math.min(engineStart.x, engineEnd.x);
    const engMaxX = Math.max(engineStart.x, engineEnd.x) + 1;
    const engMinY = Math.min(engineStart.y, engineEnd.y);
    const engMaxY = Math.max(engineStart.y, engineEnd.y) + 1;
    const engMinZ = Math.min(engineStart.z, engineEnd.z);
    const engMaxZ = Math.max(engineStart.z, engineEnd.z) + 1;

    const tailMinX = Math.min(tailStart.x, tailEnd.x);
    const tailMaxX = Math.max(tailStart.x, tailEnd.x) + 1;
    const tailMinY = Math.min(tailStart.y, tailEnd.y);
    const tailMaxY = Math.max(tailStart.y, tailEnd.y) + 1;
    const tailMinZ = Math.min(tailStart.z, tailEnd.z);
    const tailMaxZ = Math.max(tailStart.z, tailEnd.z) + 1;

    // 局内玩家脱离列车区域（如站在车顶）同样视为通风中；需列车区域已配置
    const trainCoords = latestConfig.trainCoordinates;
    const offTrainEnabled = !!(trainCoords && trainCoords.start && trainCoords.end);

    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const pos = player.location;

        const offTrain = offTrainEnabled && isInGame(player) && !getPlayerState(player).inTrain;

        const inEngine =
            pos.x >= engMinX && pos.x < engMaxX &&
            pos.y >= engMinY && pos.y < engMaxY &&
            pos.z >= engMinZ && pos.z < engMaxZ;

        const inTail =
            pos.x >= tailMinX && pos.x < tailMaxX &&
            pos.y >= tailMinY && pos.y < tailMaxY &&
            pos.z >= tailMinZ && pos.z < tailMaxZ;

        if (inEngine || inTail || offTrain) {
            if (!getPlayerState(player).ventilating) {
                getPlayerState(player).ventilating = true;
            }
        } else {
            if (getPlayerState(player).ventilating) {
                getPlayerState(player).ventilating = false;
            }
        }
    }
}, 1);


// 任务2，蹲坑区域检测，蹲坑中 状态位
mc.system.runInterval(() => {
    const latestConfig = getWorldConfig();

    if (!Array.isArray(latestConfig.toiletCoordinates)) {
        latestConfig.toiletCoordinates = [];
    }
    const toiletList = latestConfig.toiletCoordinates;
    const allPlayers = mc.world.getPlayers();

    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const { x, y, z } = player.location;
        const hasSocialTag = getPlayerState(player).socializing;
        let inToiletRange = false;

        for (const toilet of toiletList) {
            if (!toilet || toilet.x === undefined) continue;
            const dx = x - toilet.x;
            const dy = y - toilet.y;
            const dz = z - toilet.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // 蹲坑判定半径 1 格
            if (dist <= 1) {
                inToiletRange = true;
                break;
            }
        }

        if (inToiletRange && !hasSocialTag) {
            if (!getPlayerState(player).squatting) {
                getPlayerState(player).squatting = true;
            }
        } else {
            if (getPlayerState(player).squatting) {
                getPlayerState(player).squatting = false;
            }
        }
    }
}, 1);


// 任务3，睡觉状态检测，睡觉中 状态位
mc.system.runInterval(() => {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const isSleeping = player.isSleeping;
        const wasSleeping = getPlayerState(player).sleeping;

        if (isSleeping && !wasSleeping) {
            getPlayerState(player).sleeping = true;
        } else if (!isSleeping && wasSleeping) {
            getPlayerState(player).sleeping = false;
        }
    }
}, 1);


// 任务4/5，进食食物/饮用饮品 进度加分
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemCompleteUse.subscribe((event) => {
        const player = event.source;
        const item = event.itemStack;

        if (!player?.isValid || !item) return;

        const itemId = item.typeId;
        const playerId = player.id;
        const now = Date.now();

        const lastTime = scoreCooldown.get(playerId) ?? 0;
        if (now - lastTime < COOLDOWN_TIME) return;

        const isGaming = isInGame(player);
        let needAddScore = false;
        const latestCfg = getWorldConfig();

        if (isGaming && getPlayerState(player).taskId === 4 && latestCfg.allowedFoods?.includes(itemId)) {
            needAddScore = true;
        }
        if (isGaming && getPlayerState(player).taskId === 5 && latestCfg.allowedDrinks?.includes(itemId)) {
            needAddScore = true;
        }

        if (needAddScore) {
            addTaskProgress(player, 1);
            scoreCooldown.set(playerId, now);
        }

        if (now - lastTime > COOLDOWN_TIME * 10) {
            scoreCooldown.delete(playerId);
        }
    });
});


// 任务6，玩家近距离检测，社交中 状态位
mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());

    for (const player of allPlayers) {
        if (!player.isValid) continue;
        let hasOtherPlayerNearby = false;
        const pPos = player.location;

        for (const other of allPlayers) {
            if (player.id === other.id || !other.isValid) continue;
            const oPos = other.location;

            const dx = pPos.x - oPos.x;
            const dy = pPos.y - oPos.y;
            const dz = pPos.z - oPos.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            // 社交判定距离 3 格（3² = 9）
            if (distSq <= 9) {
                hasOtherPlayerNearby = true;
                break;
            }
        }

        if (hasOtherPlayerNearby) {
            if (!getPlayerState(player).socializing) {
                getPlayerState(player).socializing = true;
            }
        } else {
            if (getPlayerState(player).socializing) {
                getPlayerState(player).socializing = false;
            }
        }
    }
}, 1);


// 平民死亡给杀手金币，加时
mc.system.runInterval(() => {
    const killer = Array.from(mc.world.getPlayers()).find(p => p.isValid && isKiller(p));
    if (!killer) return;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (isKiller(player)) continue;
        if (!isInGame(player)) continue;
        if (getPlayerState(player).killRewardGiven) continue;

        let isSpec = false;
        try { isSpec = player.getGameMode() === mc.GameMode.Spectator; } catch { isSpec = false; }
        if (!isSpec) continue;

        getPlayerState(player).killRewardGiven = true;
        addDeathExtra(60);
        addGold(killer, 100);
        try { killer.sendMessage(t("lw_p1.msg.killer.civilianDeath")); } catch (e) { }
    }
}, 1);


// 倒计时结束，未完成任务非杀手添加 任务失败 状态位
mc.system.runInterval(() => {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;

        const isNeedFail =
            isInGame(player) &&
            getPlayerState(player).taskId > 0 &&
            getPlayerState(player).taskCountdown &&
            !isKiller(player) &&
            player.level === 0;

        if (isNeedFail) {
            if (!getPlayerState(player).taskFailed) {
                getPlayerState(player).taskFailed = true;
            }
        }
    }
}, 20);


// 任务失败的玩家原地死亡
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!isInGame(player)) continue;
        if (!getPlayerState(player).taskFailed) continue;

        let isSpec = false;
        try { isSpec = player.getGameMode() === mc.GameMode.Spectator; } catch { isSpec = false; }
        if (isSpec) continue;

        try {
            // 生成尸体
            player.runCommand("summon lw_p1:corpes ~ ~ ~ facing ^ ^ ^1");
            player.setGameMode(mc.GameMode.Spectator);
            getPlayerState(player).hurt = false;

            const pid = player.id;
            const ploc = player.location;
            const pdim = player.dimension;
            mc.system.runTimeout(() => {
                const nearby = pdim.getEntities({ type: "lw_p1:corpes", location: ploc, maxDistance: 3 });
                let best = null;
                let bestDist = Infinity;
                for (const c of nearby) {
                    if (!c.isValid) continue;
                    if (typeof c.getDynamicProperty("lw_p1:ownerId") === "string") continue;
                    const d = (c.location.x - ploc.x) ** 2 + (c.location.y - ploc.y) ** 2 + (c.location.z - ploc.z) ** 2;
                    if (d < bestDist) { bestDist = d; best = c; }
                }
                if (best) best.setDynamicProperty("lw_p1:ownerId", pid);
            }, 1);
        } catch (e) { }
    }
}, 1);


// 玩家离开：清理其内存中的任务进度
mc.world.afterEvents.playerLeave.subscribe((event) => {
    clearTaskProgress(event.playerId);
});


// 任务进度条：进行中独占活动栏
registerActionBarProvider("lw_p1:taskBar", (player) => getTaskBarText(player), { exclusive: true });