// @ts-check
// tasks.js - 任务系统

import * as mc from "@minecraft/server";
import { getWorldConfig, getConfig } from "../config/worldConfig.js";
import {
    getGameTicks,
    getTaskProgress, setTaskProgress, addTaskProgress, resetTaskProgress, clearTaskProgress,
    addGold, addDeathExtra, getPlayerState, isInGame, isKiller, isOfficer, isGameDead, getGold, gameSession, getRemainSeconds,
} from "../core/state.js";
import { t } from "../core/i18n.js";
import { registerPanelProvider, registerSubPanelProvider } from "../core/hud.js";


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
        if (!isInGame(player) || isGameDead(player) || getPlayerState(player).taskId > 0) continue;

        if (Math.random() < chance) {
            const taskNum = Math.floor(Math.random() * maxTask) + 1;
            getPlayerState(player).taskId = taskNum;
            getPlayerState(player).taskLimit = 0;
            getPlayerState(player).taskRemain = 0;
        }
    }
}, 20);


// 已淘汰（旁观）的玩家不再持有任务：清空任务状态，停掉倒计时与提示
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!isGameDead(player)) continue;
        const ps = getPlayerState(player);
        if (ps.taskId === 0 && !ps.taskCountdown && !ps.taskRequestCountdown) continue;
        ps.taskId = 0;
        ps.taskLimit = 0;
        ps.taskRemain = 0;
        ps.taskCountdown = false;
        ps.taskRequestCountdown = false;
        ps.taskHinted = false;
        ps.taskHinted2 = false;
        ps.taskHinted3 = false;
        ps.taskDone = false;
        ps.taskDoneTick = 0;
        ps.taskFailed = false;
    }
}, 20);


// 请求倒计时 → 写入本次任务时限（内存计时，不再占用经验条）→ 每秒扣 1 秒
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        const ps = getPlayerState(player);

        // 获得任务后先挂上"请求倒计时"
        if (isInGame(player) && ps.taskId > 0
            && !ps.taskCountdown && !ps.taskRequestCountdown) {
            ps.taskRequestCountdown = true;
        }

        // 请求倒计时：写入本次任务时限（杀手与平民共用同一限时）
        if (ps.taskRequestCountdown) {
            const limit = getConfig("taskLimit");
            ps.taskLimit = limit > 0 ? limit : 0;
            ps.taskRemain = ps.taskLimit;
            ps.taskRequestCountdown = false;
            ps.taskCountdown = true;
        }

        // 倒计时中每秒扣 1 秒
        if (isInGame(player) && ps.taskCountdown) {
            // 正在做任务（通风/蹲坑/睡觉/社交）时暂停倒计时
            // 仅对非杀手的累计型任务（有 stateField）生效；事件型任务（进食/饮用）无暂停条件
            const tDef = TASKS[getTaskId(player)];
            const doingTask = !isKiller(player) && tDef && tDef.stateField
                && ps[tDef.stateField];
            if (!doingTask) {
                ps.taskRemain = Math.max(0, ps.taskRemain - 1);
            }
        }
    }
}, 20);


// 任务提示：按 剩余时间/任务时限 的比例分档（0.6 / 0.4 / 0.2），不再依赖固定剩余秒数
// 提示文本本身改到右侧面板常驻显示（见文件末尾的面板文案），此处只维护档位标记与惩罚效果
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;

        const ps = getPlayerState(player);
        if (!ps.taskCountdown) continue;

        const ratio = ps.taskLimit > 0 ? ps.taskRemain / ps.taskLimit : 0;
        const taskId = getTaskId(player);

        if (isKiller(player)) {
            // 杀手的虚假任务：标记已提示 + 临近结束自动完成
            if (taskId && !ps.taskHinted && ratio <= 0.6) {
                ps.taskHinted = true;
            }
            if (isInGame(player) && ps.taskId > 0 && ps.taskRemain <= 1) {
                ps.taskDone = true;
            }
            continue;
        }

        // 剩余 60%：首次提示（进入低档）
        if (taskId && !ps.taskHinted && ratio <= 0.6) {
            ps.taskHinted = true;
        }
        // 剩余 40%：二次提示
        if (taskId && !ps.taskHinted2 && ratio <= 0.4) {
            ps.taskHinted2 = true;
        }
        // 剩余 20%：末次提示并施加惩罚效果
        if (taskId && !ps.taskHinted3 && ratio <= 0.2) {
            ps.taskHinted3 = true;
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
            if (!getPlayerState(player).taskDone) {
                // 完成提示改由左上角面板第三行显示，不再发聊天栏消息
                // 睡觉任务完成后自动起床：基岩版传送会唤醒睡眠中的玩家
                // 延迟几 tick 再传送，避免与任务完成结算同 tick 竞争导致任务未结算
                if (taskId === 3) {
                    mc.system.runTimeout(() => {
                        try { if (player.isValid) player.teleport(player.location); } catch (e) { }
                    }, 5);
                }
                getPlayerState(player).taskDoneTick = mc.system.currentTick;
            }
            getPlayerState(player).taskDone = true;
        }
    }
}, 1);


// 任务完成：清状态位、重置进度与经验、发金币奖励
// 完成后先停留 2 秒（40 tick）让左上角第三行显示绿色 ✓，再清理状态
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        const ps = getPlayerState(player);
        if (!ps.taskDone) continue;
        if (mc.system.currentTick - (ps.taskDoneTick || 0) < 40) continue;

        // 仅平民/警员发奖励
        if (!isKiller(player) && !getPlayerState(player).rewardGiven) {
            const reward = getConfig("taskReward");
            if (reward > 0) addGold(player, reward);
            getPlayerState(player).rewardGiven = true;
        }

        getPlayerState(player).taskId = 0;
        getPlayerState(player).taskLimit = 0;
        getPlayerState(player).taskRemain = 0;
        getPlayerState(player).taskCountdown = false;
        getPlayerState(player).taskHinted = false;
        getPlayerState(player).taskHinted2 = false;
        getPlayerState(player).taskHinted3 = false;
        getPlayerState(player).rewardGiven = false;

        resetTaskProgress(player);

        getPlayerState(player).taskDone = false;
        getPlayerState(player).taskDoneTick = 0;
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

            // 社交判定距离 4 格（4² = 16）
            if (distSq <= 16) {
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
            !getPlayerState(player).taskDone &&
            !isKiller(player) &&
            getPlayerState(player).taskRemain <= 0;

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


// 任务进度条已移至左上角面板第三行，不再占用活动栏


// ===== 右侧信息面板 / 左上角任务面板 =====
// 右面板走 title 通道（关键字 lwInfo:）：局内显示 4 行玩家信息，局外显示上一局结算。
// 左面板走 subtitle 通道（关键字 lwTask:）：局内显示任务提示 + 倒计时进度条 + 任务进度条，局外隐藏。
// 两条通道由 hud.js 的面板调度器在同一次 setTitle 里下发，彼此独立。

// 把多行文案拼成一条 RawMessage
function joinLines(lines) {
    const parts = [];
    lines.forEach((line, i) => {
        if (i > 0) parts.push({ text: "\n" });
        parts.push(line);
    });
    return { rawtext: parts };
}

// 职业名（杀手 / 警员 / 平民）
function roleText(player) {
    if (isKiller(player)) return t("lw_p1.role.killer");
    if (isOfficer(player)) return t("lw_p1.role.officer");
    return t("lw_p1.role.passenger");
}

// 右面板：局内 4 行（名字 / 职业 / 金币 / 剩余游戏时长仅杀手）；局外 = 上一局结算
function getInfoPanelText(player) {
    if (!isInGame(player)) return gameSession.lastResultText ?? undefined;

    const lines = [
        t("lw_p1.panel.name", player.name),
        t("lw_p1.panel.role", roleText(player)),
        t("lw_p1.panel.gold", getGold(player))
    ];

    // 第四行：剩余游戏时长（仅杀手），格式 分:秒，与实际对局剩余时间一致
    if (isKiller(player)) {
        const remainSec = getRemainSeconds();
        const m = Math.floor(remainSec / 60);
        const s = String(remainSec % 60).padStart(2, "0");
        lines.push(t("lw_p1.panel.time", m, s));
    }
    return joinLines(lines);
}

// 左面板：任务提示（第一行）+ 倒计时进度条（第二行，杀手不显示）+ 任务进度条（第三行）
// 第三行：需要时间完成的任务（1/2/3/6）显示平滑进度条；任务完成后变为绿色 ✓，停留 2 秒再隐藏
function getTaskPanelText(player) {
    if (!isInGame(player)) return undefined;

    const ps = getPlayerState(player);
    if (ps.taskId <= 0 || !ps.taskCountdown || ps.taskLimit <= 0) return undefined;

    // 提示档位取"已到达的最高档"，避免做任务暂停计时时提示来回跳
    const stage = ps.taskHinted3 ? 3 : ps.taskHinted2 ? 2 : 1;
    const hintKey = isKiller(player)
        ? `lw_p1.task.fake.${ps.taskId}`
        : `lw_p1.task.${ps.taskId}.hint${stage}`;

    const lines = [t(hintKey)];

    // 杀手不显示倒计时进度条
    if (!isKiller(player)) {
        // 剩余时间进度条：10 格，按剩余比例变色
        const ratio = Math.max(0, Math.min(1, ps.taskRemain / ps.taskLimit));
        const cells = 10;
        const filled = Math.max(0, Math.min(cells, Math.round(ratio * cells)));
        const color = ratio > 0.6 ? "§a" : ratio > 0.3 ? "§e" : "§c";
        const bar = color + "▓".repeat(filled) + "§8" + "░".repeat(cells - filled);
        lines.push({ rawtext: [t("lw_p1.task.panel.time", ps.taskRemain), { text: " " }, { text: bar }] });
    }

    // 第三行：任务完成则显示完成提示；否则需要时间完成的任务显示平滑进度条
    if (ps.taskDone) {
        lines.push(t("lw_p1.task.done"));
    } else {
        const def = TASKS[ps.taskId];
        // 仅需要时间完成的任务（有 stateField 的 1/2/3/6）显示进度条；事件型任务（4/5）无此行
        if (def && def.stateField) {
            const value = getTaskProgress(player);
            if (value > 0) {
                const pRatio = Math.max(0, Math.min(1, value / def.threshold));
                const pCells = 10;
                const pFilled = Math.max(0, Math.min(pCells, Math.round(pRatio * pCells)));
                const pColor = pRatio > 0.6 ? "§a" : pRatio > 0.3 ? "§e" : "§c";
                const pBar = pColor + "█".repeat(pFilled) + "§8" + "░".repeat(pCells - pFilled);
                lines.push({ text: pBar });
            }
        }
    }

    return joinLines(lines);
}

// 注册：右面板（title 通道）与左面板（subtitle 通道）
registerPanelProvider("lw_p1:infoPanel", (player) => getInfoPanelText(player));
registerSubPanelProvider("lw_p1:taskPanel", (player) => getTaskPanelText(player));