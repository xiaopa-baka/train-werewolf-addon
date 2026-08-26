// @ts-check
// main.js - 游戏主脚本，包含游戏的核心逻辑和事件处理
// 前缀 "lw_p1" = "Lionwolf's mod - Project 1"

// 输出测试日志，确认脚本已加载，同时声明版权信息
console.log("\n©\n狮狼传奇_小怕\nLW.狮狼传奇工作室\n尘世之狼");

import * as mc from "@minecraft/server";
import "./taskSystem.js";
import "./shopSystem.js";
import "./propSystem.js";
import "./config/configUI.js";
import { getWorldConfig } from "./config/worldConfig.js";
import "./blocks/vending_machine.js";
import { clearCrowbaredDoors } from "./blocks/keydoor.js";
import "./guideBook.js";


// 预创建全局所需计分板列表
const needCreateObjectiveList = [
    "lw_p1:是否自动开始",
    "lw_p1:游戏自动开始时间",
    "lw_p1:最低开局人数",
    "lw_p1:单局游戏基础时长",
    "lw_p1:游戏时间",
    "lw_p1:任务数",
    "lw_p1:每秒分配概率",
    "lw_p1:任务开始发布时间",
    "lw_p1:单个任务限时",
    "lw_p1:杀手虚假任务限时",
    "lw_p1:杀手初始金币",
    "lw_p1:平民初始金币",
    "lw_p1:杀手金币增速",
    "lw_p1:平民金币增速",
    "lw_p1:任务完成奖励",
    "lw_p1:死亡加时",
    "lw_p1:任务中",
    "lw_p1:计时器",
    "lw_p1:金币",
    "lw_p1:手动开局请求",
    "lw_p1:房间数",
];

function ensureObjectives() {
    for (const name of needCreateObjectiveList) {
        try {
            if (!mc.world.scoreboard.getObjective(name)) {
                mc.world.scoreboard.addObjective(name);
            }
        } catch (e) { }
    }
}

mc.system.runInterval(() => {
    if (mc.world.scoreboard) {
        ensureObjectives();
    }
}, 20);


// 初始化计分板默认值（仅当无数据时）
function initScoreboardDefaults() {
    const scoreDefaults = {
        "lw_p1:是否自动开始": 1,
        "lw_p1:游戏自动开始时间": 10,
        "lw_p1:最低开局人数": 5,
        "lw_p1:单局游戏基础时长": 600,
        "lw_p1:游戏时间": 0,
        "lw_p1:每秒分配概率": 3,
        "lw_p1:任务开始发布时间": 20,
        "lw_p1:单个任务限时": 100,
        "lw_p1:杀手虚假任务限时": 50,
        "lw_p1:任务数": 6,
        "lw_p1:杀手初始金币": 100,
        "lw_p1:平民初始金币": 0,
        "lw_p1:杀手金币增速": 15,
        "lw_p1:平民金币增速": 0,
        "lw_p1:任务完成奖励": 25,
        "lw_p1:死亡加时": 0,
        "lw_p1:手动开局请求": 0,
        "lw_p1:房间数": 8
    };

    const fakePlayer = "lw_p1:全局";

    for (const objectiveName in scoreDefaults) {
        try {
            const obj = mc.world.scoreboard.getObjective(objectiveName);
            if (!obj) continue;

            let score;
            try {
                score = obj.getScore(fakePlayer);
            } catch {
                score = undefined;
            }

            if (score === undefined) {
                obj.setScore(fakePlayer, scoreDefaults[objectiveName]);
            }
        } catch (err) { }
    }
}

mc.system.runInterval(() => {
    if (mc.world.scoreboard) {
        initScoreboardDefaults();
    }
}, 20);


// 工具函数，设置游戏时间
function setGameTime(mode) {
    const timeMap = {
        day: 1000,
        noon: 6000,
        sunset: 14000,
        night: 18000
    };
    mc.world.setTimeOfDay(timeMap[mode]);
}


// 玩家计时器，每 tick+1，满 20 重置为 0
mc.system.runInterval(() => {
    const allPlayers = mc.world.getPlayers();
    const timerObj = mc.world.scoreboard.getObjective("lw_p1:计时器");
    if (!timerObj) return;

    for (const player of allPlayers) {
        if (!player.isValid) continue;

        timerObj.addScore(player, 1);
        const playerTimerScore = timerObj.getScore(player) ?? 0;

        if (playerTimerScore >= 20) {
            timerObj.setScore(player, 0);
        }
    }
}, 1);


// 使用物品 lw_p1:tp_game 传送至车头
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (player && player.isValid && event.itemStack?.typeId === "lw_p1:tp_game") {
            const latestConfig = getWorldConfig();
            const coords = latestConfig.trainEngineCoordinates;
            if (!coords || typeof coords.x !== "number" || typeof coords.y !== "number" || typeof coords.z !== "number") {
                return;
            }
            player.teleport(coords);
        }
    });
});


// 列车区域，位于列车 标签
mc.system.runInterval(function () {
    const latestConfig = getWorldConfig();
    const trainStart = latestConfig.trainCoordinates.start;
    const trainEnd = latestConfig.trainCoordinates.end;

    const allPlayers = mc.world.getPlayers();
    if (!trainStart || !trainEnd) return;

    const minX = Math.min(trainStart.x, trainEnd.x);
    const maxX = Math.max(trainStart.x, trainEnd.x) + 1;
    const minY = Math.min(trainStart.y, trainEnd.y);
    const maxY = Math.max(trainStart.y, trainEnd.y) + 1;
    const minZ = Math.min(trainStart.z, trainEnd.z);
    const maxZ = Math.max(trainStart.z, trainEnd.z) + 1;

    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const pos = player.location;

        const isInArea =
            pos.x >= minX && pos.x < maxX &&
            pos.y >= minY && pos.y < maxY &&
            pos.z >= minZ && pos.z < maxZ;

        if (isInArea) {
            if (!player.hasTag("lw_p1:位于列车")) {
                player.addTag("lw_p1:位于列车");
            }
        } else {
            if (player.hasTag("lw_p1:位于列车")) {
                player.removeTag("lw_p1:位于列车");
            }
        }
    }
}, 1);


// 坠落列车底部 2 格视为死亡
mc.system.runInterval(() => {
    const latestConfig = getWorldConfig();
    const trainStart = latestConfig.trainCoordinates.start;
    const trainEnd = latestConfig.trainCoordinates.end;
    if (!trainStart || !trainEnd) return;

    // 提取列车区域对角坐标的 y 最小值
    const lowestY = Math.min(trainStart.y, trainEnd.y);

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!player.hasTag("lw_p1:游戏中")) continue;

        // 已是旁观模式则跳过
        let isSpec = false;
        try { isSpec = player.getGameMode() === mc.GameMode.Spectator; } catch { isSpec = false; }
        if (isSpec) continue;

        // 玩家 Y 坐标低于最低 Y - 2 格，视为坠车死亡
        if (player.location.y < lowestY - 2) {
            try {
                player.setGameMode(mc.GameMode.Spectator);
                player.removeTag("lw_p1:受到伤害");
            } catch (e) { }
        }
    }
}, 1);


// 非游戏阶段，活动栏显示列车人数统计
mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());
    const latestConfig = getWorldConfig();

    if (!latestConfig.trainCoordinates?.start || !latestConfig.trainCoordinates?.end) return;

    const hasInGameTag = allPlayers.some(player => player.hasTag("lw_p1:游戏中"));
    if (hasInGameTag) return;

    const totalPlayerCount = allPlayers.length;
    const inTrainPlayerCount = allPlayers.filter(player => player.hasTag("lw_p1:位于列车")).length;

    const actionBarMsg = `已登车 ${inTrainPlayerCount} / ${totalPlayerCount} 人`;

    for (const player of allPlayers) {
        if (!player.isValid) continue;
        player.onScreenDisplay.setActionBar(actionBarMsg);
    }
}, 1);


// 非游戏阶段，人数达标且全在列车内 开启开局倒计时
// 倒计时结束后将玩家随机传送至出生坐标，将时间设为午夜
let gameStartTimer = null;

function clearTitle() {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        player.runCommand("title @s clear");
    }
}

function clearCountdown() {
    gameStartTimer = null;
    clearTitle();
}

function showTitle(text) {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        player.onScreenDisplay.setTitle(text, {
            fadeInDuration: 5,
            stayDuration: 30,
            fadeOutDuration: 10
        });
    }
}

function teleportPlayersToRandomCoords(players) {
    try {
        const latestConfig = getWorldConfig();
        if (!latestConfig || typeof latestConfig !== "object") {
            return;
        }

        const coordsRaw = latestConfig.randomCoordinates;
        if (!Array.isArray(coordsRaw)) {
            return;
        }

        const coordsList = coordsRaw.map((item, index) => {
            let x, y, z;
            if (typeof item === "string") {
                const parts = item.trim().split(/\s+/).map(Number);
                x = parts[0]; y = parts[1]; z = parts[2];
            } else if (Array.isArray(item)) {
                x = item[0]; y = item[1]; z = item[2];
            } else if (item && typeof item === "object") {
                x = item.x; y = item.y; z = item.z;
            } else {
                return null;
            }
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                return null;
            }
            return { x, y, z };
        }).filter(c => c !== null);

        if (coordsList.length < players.length) {
            console.warn("[传送] 坐标数量不足");
            return;
        }

        const shuffled = [...coordsList];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const rnd = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[rnd]] = [shuffled[rnd], shuffled[i]];
        }

        const overworld = mc.world.getDimension("overworld");
        if (!overworld) {
            return;
        }

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player.isValid) continue;
            try {
                player.teleport(shuffled[i], { dimension: overworld });
            } catch (teleErr) { }
        }
    } catch (e) { }
}

// 核心开局逻辑
function startGameNow(allPlayers) {
    try {
        // 重置本局结束状态
        endTriggered = false;
        pendingEndMsg = null;
        roleRewardsGiven = false;
        gameStartTimer = null; // 重置倒计时，保证下一局可再次自动开始

        // 重建被 gameOver 删除的计分项并归零，保证第二局起计时/结算正常
        try {
            ensureObjectives();
            for (const name of ["lw_p1:游戏时间", "lw_p1:死亡加时", "lw_p1:任务中", "lw_p1:金币"]) {
                const obj = mc.world.scoreboard.getObjective(name);
                if (!obj) continue;
                try { obj.setScore("lw_p1:全局", 0); } catch (e) { }
            }
        } catch (e) { }

        showTitle("§a游戏开始！");
        mc.system.runTimeout(() => {
            clearTitle();
        }, 20);

        for (const player of allPlayers) {
            if (!player.isValid) continue;
            // 清除上一局残留的职业标签，保证每局角色重新随机分配
            player.removeTag("lw_p1:杀手");
            player.removeTag("lw_p1:警员");
            if (player.hasTag("lw_p1:位于列车")) {
                player.addTag("lw_p1:游戏中");
            }
            // 开局统一切到冒险模式（结算判定以冒险模式为存活）
            try { player.setGameMode(mc.GameMode.Adventure); } catch (e) { }
        }

        teleportPlayersToRandomCoords(allPlayers);
        setGameTime("night");
    } catch (e) { }
}

mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());

    const hasInGame = allPlayers.some(p => p.isValid && p.hasTag("lw_p1:游戏中"));

    // 手动开局
    try {
        const manualObj = mc.world.scoreboard.getObjective("lw_p1:手动开局请求");
        if (manualObj) {
            let flag;
            try { flag = manualObj.getScore("lw_p1:全局"); } catch { flag = 0; }
            if (flag === 1) {
                manualObj.setScore("lw_p1:全局", 0);
                if (!hasInGame) {
                    const minStartPlayer = mc.world.scoreboard.getObjective("lw_p1:最低开局人数");
                    const minPlayer = minStartPlayer?.getScore("lw_p1:全局") ?? 5;
                    const inTrainList = allPlayers.filter(p => p.isValid && p.hasTag("lw_p1:位于列车"));
                    if (inTrainList.length >= minPlayer) {
                        startGameNow(allPlayers);
                    } else {
                        for (const p of allPlayers) {
                            if (!p.isValid) continue;
                            try {
                                p.sendMessage(`§c人数不足，无法开始游戏（当前 ${inTrainList.length} / 最低 ${minPlayer}）`);
                            } catch { }
                        }
                    }
                }
            }
        }
    } catch { }

    if (hasInGame) return;

    // 是否启用自动开始
    let autoStartEnabled = 1;
    try {
        const asObj = mc.world.scoreboard.getObjective("lw_p1:是否自动开始");
        if (asObj) {
            try { autoStartEnabled = asObj.getScore("lw_p1:全局") ?? 1; } catch { autoStartEnabled = 1; }
        }
    } catch { }
    if (!autoStartEnabled) return;

    const totalCount = allPlayers.length;
    const inTrainList = allPlayers.filter(p => p.isValid && p.hasTag("lw_p1:位于列车"));
    const allInTrain = totalCount > 0 && inTrainList.length === totalCount;

    if (!allInTrain && gameStartTimer !== null) {
        clearCountdown();
        return;
    }

    const minStartPlayer = mc.world.scoreboard.getObjective("lw_p1:最低开局人数");
    const minPlayer = minStartPlayer?.getScore("lw_p1:全局") ?? 5;

    if (!(totalCount >= minPlayer && allInTrain)) {
        return;
    }

    try {
        const timeObj = mc.world.scoreboard.getObjective("lw_p1:游戏自动开始时间");

        if (gameStartTimer === null) {
            gameStartTimer = timeObj.getScore("lw_p1:全局") ?? 10;
            showTitle(`§e${gameStartTimer} 秒后游戏开始`);
        }

        if (mc.system.currentTick % 20 === 0) {
            if (gameStartTimer > 0) {
                gameStartTimer--;
                showTitle(`§e${gameStartTimer} 秒后游戏开始`);
            } else if (gameStartTimer === 0) {
                gameStartTimer = -1;
                startGameNow(allPlayers);
            }
        }
    } catch (err) { }
}, 1);


// 游戏开始后分配职业
async function checkRoleAssign() {
    try {
        const allPlayers = Array.from(mc.world.getPlayers());
        const inGamePlayers = allPlayers.filter(p => p.isValid && p.hasTag("lw_p1:游戏中"));
        if (inGamePlayers.length === 0) {
            roleRewardsGiven = false;
            return;
        }

        const hasKiller = inGamePlayers.some(p => p.hasTag("lw_p1:杀手"));
        const hasPolice = inGamePlayers.some(p => p.hasTag("lw_p1:警员"));

        // 职业分配
        if (!hasKiller) {
            const candidatesKiller = inGamePlayers.filter(p => !p.hasTag("lw_p1:警员"));
            if (candidatesKiller.length > 0) {
                const target = candidatesKiller[Math.floor(Math.random() * candidatesKiller.length)];
                target.addTag("lw_p1:杀手");
            }
        }

        if (!hasPolice) {
            const candidatesPolice = inGamePlayers.filter(p => !p.hasTag("lw_p1:杀手"));
            if (candidatesPolice.length > 0) {
                const target = candidatesPolice[Math.floor(Math.random() * candidatesPolice.length)];
                target.addTag("lw_p1:警员");
            }
        }

        // 只有本局首次分配完成时才发放物品
        if (roleRewardsGiven) return;
        roleRewardsGiven = true;

        try {
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                p.runCommand(`clear @s`);
            }
        } catch (err) { }

        // 职业分配完成，发放初始金币
        try {
            const objKillerGold = mc.world.scoreboard.getObjective("lw_p1:杀手初始金币");
            const objCivilGold = mc.world.scoreboard.getObjective("lw_p1:平民初始金币");
            const objGold = mc.world.scoreboard.getObjective("lw_p1:金币");
            if (objGold) {
                const killerGold = objKillerGold?.getScore("lw_p1:全局") ?? 100;
                const civilGold = objCivilGold?.getScore("lw_p1:全局") ?? 0;
                for (const p of inGamePlayers) {
                    if (!p.isValid) continue;
                    objGold.setScore(p, p.hasTag("lw_p1:杀手") ? killerGold : civilGold);
                }
            }
        } catch (err) { }

        // 随机分配房间钥匙
        try {
            const roomObj = mc.world.scoreboard.getObjective("lw_p1:房间数");
            const roomCount = roomObj?.getScore("lw_p1:全局") ?? 8;
            if (roomCount > 0) {
                const shuffled = [...inGamePlayers].sort(() => Math.random() - 0.5);

                const keyPool = [];
                for (let i = 0; i < shuffled.length; i++) {
                    keyPool.push((i % roomCount) + 1);
                }

                for (const p of shuffled) {
                    if (!p.isValid) continue;
                    const lastKey = p.getDynamicProperty("lw_p1:lastKey");

                    // 优先选择与上局不同的钥匙
                    let chosenIndex = -1;
                    for (let i = 0; i < keyPool.length; i++) {
                        if (keyPool[i] !== lastKey) {
                            chosenIndex = i;
                            break;
                        }
                    }
                    if (chosenIndex === -1) chosenIndex = 0;

                    const keyNum = keyPool.splice(chosenIndex, 1)[0];
                    p.runCommand(`give @s lw_p1:key_${keyNum} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`);
                    p.setDynamicProperty("lw_p1:lastKey", keyNum);
                }
            }
        } catch (err) { }

        // 开局发放便条
        try {
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                p.runCommand(`give @s lw_p1:guide_book 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`);
                p.runCommand(`give @s lw_p1:note 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`);
            }
        } catch (err) { }

        // 杀手开局发放便携商店
        try {
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                if (!p.hasTag("lw_p1:杀手")) continue;
                p.runCommand(`replaceitem entity @s slot.hotbar 8 lw_p1:killer_store 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);
            }
        } catch (err) { }

        // 警员开局发放左轮手枪
        try {
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                if (!p.hasTag("lw_p1:警员")) continue;
                const pistol = new mc.ItemStack("lw_p1:pistol", 1);
                p.getComponent("inventory").container.addItem(pistol);
            }
        } catch (err) { }

    } catch (err) { }
}

mc.system.runInterval(() => {
    checkRoleAssign();
}, 20);


// 游戏进行中，记录游戏总 Tick
mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());
    const hasGameInPlayer = allPlayers.some(player => {
        return player.isValid && player.hasTag("lw_p1:游戏中");
    });

    if (hasGameInPlayer) {
        const gameTimeObj = mc.world.scoreboard.getObjective("lw_p1:游戏时间");
        if (gameTimeObj) {
            gameTimeObj.addScore("lw_p1:全局", 1);
        }
    }
}, 1);


// 杀手活动栏显示剩余游戏时长倒计时（每秒更新，格式 分:秒）
mc.system.runInterval(() => {
    // 仅每个整秒更新
    if (mc.system.currentTick % 20 !== 0) return;

    const gameTimeObj = mc.world.scoreboard.getObjective("lw_p1:游戏时间");
    const baseTimeObj = mc.world.scoreboard.getObjective("lw_p1:单局游戏基础时长");
    const extraObj = mc.world.scoreboard.getObjective("lw_p1:死亡加时");
    if (!gameTimeObj || !baseTimeObj) return;

    const elapsedSec = Math.floor((gameTimeObj.getScore("lw_p1:全局") ?? 0) / 20);
    const baseSec = baseTimeObj.getScore("lw_p1:全局") ?? 600;
    const extraSec = extraObj?.getScore("lw_p1:全局") ?? 0;
    const remainSec = Math.max(0, baseSec + extraSec - elapsedSec);

    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    const text = `§e剩余时间 ${m}:${String(s).padStart(2, "0")}`;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (player.hasTag("lw_p1:游戏中") && player.hasTag("lw_p1:杀手")) {
            player.onScreenDisplay.setActionBar(text);
        }
    }
}, 1);


// 游戏结束，胜负判定、职业名单收集、结果广播
let endTriggered = false;
let pendingEndMsg = null;
let roleRewardsGiven = false;

// 广播结束消息
function broadcastEndMessage() {
    if (!pendingEndMsg) return;
    const { winner, reason, killerNames, policeNames, civilNames } = pendingEndMsg;
    const resultLine = winner === "杀手" ? "§c游戏结束，杀手胜利！" : "§a游戏结束，平民胜利！";
    const reasonText = {
        "杀手死亡": "杀手死亡",
        "时间耗尽": "时间耗尽，平民存活",
        "平民全部死亡": "平民全部阵亡"
    }[reason] || reason;
    const killer = killerNames.join("、") || "无";
    const police = policeNames.join("、") || "无";
    const civils = civilNames.join("、") || "无";
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        player.sendMessage(`§6【游戏结束】\n${resultLine}\n§f结束原因：${reasonText}\n§f杀手：${killer}\n§f警员：${police}\n§f平民：${civils}`);
    }
    pendingEndMsg = null;
}

// 结算判定
// 规则1：游戏中只存在杀手一个冒险模式，杀手胜利
// 规则2：杀手的游戏模式不是冒险模式，平民胜利
// 规则3：任务栏时间归零，平民胜利
mc.system.runInterval(() => {
    try {
        if (endTriggered) return;

        const allPlayers = Array.from(mc.world.getPlayers());
        const inGame = allPlayers.filter(p => p.isValid && p.hasTag("lw_p1:游戏中"));
        if (inGame.length === 0) return;

        const isAlive = (p) => {
            try { return p.getGameMode() === mc.GameMode.Adventure; } catch { return false; }
        };

        const killers = inGame.filter(p => p.hasTag("lw_p1:杀手"));
        const civils = inGame.filter(p => !p.hasTag("lw_p1:杀手"));
        const hasKiller = killers.length > 0;
        const killerDead = hasKiller && killers.every(p => !isAlive(p));
        const civilsAllDead = civils.length > 0 && civils.every(p => !isAlive(p));

        let endMsg = null;

        if (killerDead) {
            endMsg = { winner: "平民", reason: "杀手死亡" };
        }
        else if (hasKiller && civilsAllDead) {
            endMsg = { winner: "杀手", reason: "平民全部死亡" };
        }
        else {
            let elapsedSec = 0, baseSec = 600, extraSec = 0;
            try {
                const gameTimeObj = mc.world.scoreboard.getObjective("lw_p1:游戏时间");
                const baseTimeObj = mc.world.scoreboard.getObjective("lw_p1:单局游戏基础时长");
                const extraObj = mc.world.scoreboard.getObjective("lw_p1:死亡加时");
                elapsedSec = Math.floor((gameTimeObj?.getScore("lw_p1:全局") ?? 0) / 20);
                baseSec = baseTimeObj?.getScore("lw_p1:全局") ?? 600;
                extraSec = extraObj?.getScore("lw_p1:全局") ?? 0;
            } catch (e) { }
            if (baseSec + extraSec - elapsedSec <= 0) {
                endMsg = { winner: "平民", reason: "时间耗尽" };
            }
        }

        if (endMsg) {
            endTriggered = true;
            // 收集本局职业名单
            collectGameResult(endMsg.reason, endMsg.winner);
            // 调用 gameover.mcfunction
            for (const p of inGame) {
                if (!p.hasTag("lw_p1:游戏结束")) p.addTag("lw_p1:游戏结束");
            }
            // 广播结束消息
            mc.system.runTimeout(() => {
                broadcastEndMessage();
            }, 20);
        }
    } catch (e) { }
}, 1);

// 收集本局全部玩家职业名单
function collectGameResult(reason, winner) {
    const inGame = Array.from(mc.world.getPlayers()).filter(p => p.isValid && p.hasTag("lw_p1:游戏中"));
    const killerP = inGame.filter(p => p.hasTag("lw_p1:杀手"));
    const policeP = inGame.filter(p => p.hasTag("lw_p1:警员"));
    const civilP = inGame.filter(p => !p.hasTag("lw_p1:杀手") && !p.hasTag("lw_p1:警员"));
    pendingEndMsg = {
        winner,
        reason,
        killerNames: killerP.map(p => p.name),
        policeNames: policeP.map(p => p.name),
        civilNames: civilP.map(p => p.name)
    };
}


// 全局游戏结束,调用 lw_p1_gameOver.mcfunction ,设置时间为白天、传送至站台
mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());
    const hasGameEndPlayer = allPlayers.some(player => {
        return player.isValid && player.hasTag("lw_p1:游戏结束");
    });
    if (!hasGameEndPlayer) return;

    try {
        try {
            mc.world.getDimension("overworld").runCommand("function lw_p1_gameOver");
        } catch (e) { }

        // 清除所有撬棍锁定
        clearCrowbaredDoors();

        for (const player of allPlayers) {
            if (!player.isValid) continue;
            try { player.setDynamicProperty("lw_p1:noteMessage", undefined); } catch (e) { }
        }

        setGameTime("day");

        const latestConfig = getWorldConfig();
        const trainStation = latestConfig.trainStationCoordinates;

        if (trainStation && typeof trainStation.x === "number") {
            for (const player of allPlayers) {
                if (!player.isValid) continue;
                try {
                    player.teleport(trainStation);
                } catch (e) { }
            }
        }
    } finally {
        for (const player of allPlayers) {
            if (!player.isValid) continue;
            if (!player.hasTag("lw_p1:游戏结束")) continue;
            try { player.removeTag("lw_p1:游戏结束"); } catch (e) { }
        }
    }
}, 1);


// 既无游戏中玩家、也无游戏结束标记时，重置结束/发放标记，保证下一局从干净状态开始
mc.system.runInterval(() => {
    try {
        const players = Array.from(mc.world.getPlayers());
        const hasInGame = players.some(p => p.isValid && p.hasTag("lw_p1:游戏中"));
        const hasEnd = players.some(p => p.isValid && p.hasTag("lw_p1:游戏结束"));
        if (!hasInGame && !hasEnd) {
            endTriggered = false;
            roleRewardsGiven = false;
        }
    } catch (e) { }
}, 20);


// 防止中途退出又加入的刁民
// 监听玩家刚进入世界
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.playerJoin.subscribe((event) => {
        const allPlayers = Array.from(mc.world.getPlayers());
        const player = allPlayers.find(p => p.id === event.playerId);

        if (!player?.isValid) return;

        const gameIsRunning = allPlayers.some(player =>
            player.isValid && player.hasTag("lw_p1:游戏中")
        );

        if (gameIsRunning) {
            player.addTag("lw_p1:任务失败");
        }
        else {
            // 非游戏阶段加入：直接发放基础物品，不调用 gameOver 清理函数（避免误伤进行中的新一局）
            try {
                player.runCommand(`give @s lw_p1:guide_book 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`);
                player.runCommand(`give @s lw_p1:tp_game 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`);
            } catch (e) { }
        }
    });
});


// 尸体名牌系统，为每个尸体绑定最近玩家，生成显示玩家名字的 player_name 实体
function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

function findNearestPlayer(entityLocation, allPlayers) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const d = distanceSq(entityLocation, player.location);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = player;
        }
    }
    return nearest;
}

mc.system.runInterval(() => {
    try {
        const allPlayers = Array.from(mc.world.getPlayers());

        for (const dimName of ["overworld", "nether", "the_end"]) {
            let dimension;
            try {
                dimension = mc.world.getDimension(dimName);
            } catch { continue; }
            if (!dimension) continue;

            const corpses = dimension.getEntities({ type: "lw_p1:corpes" });
            if (corpses.length === 0) continue;

            for (const corpse of corpses) {
                if (!corpse.isValid) continue;
                if (corpse.getDynamicProperty("lw_p1:hasNameTag")) continue;

                let nameTagLoc;
                try {
                    const vd = corpse.getViewDirection();
                    nameTagLoc = {
                        x: corpse.location.x + vd.x,
                        y: corpse.location.y + vd.y,
                        z: corpse.location.z + vd.z
                    };
                } catch {
                    nameTagLoc = {
                        x: corpse.location.x,
                        y: corpse.location.y,
                        z: corpse.location.z + 1
                    };
                }

                const ownerId = corpse.getDynamicProperty("lw_p1:ownerId");
                const targetPlayer = typeof ownerId === "string" ? allPlayers.find(p => p.id === ownerId) : null;
                const nearestPlayer = targetPlayer || findNearestPlayer(corpse.location, allPlayers);
                if (!nearestPlayer) continue;

                try {
                    const nameEntity = dimension.spawnEntity("lw_p1:player_name", nameTagLoc);
                    if (nameEntity && nameEntity.isValid) {
                        nameEntity.nameTag = nearestPlayer.name;
                        corpse.setDynamicProperty("lw_p1:hasNameTag", true);
                    }
                } catch (spawnErr) { }
            }
        }
    } catch (err) { }
}, 10);


