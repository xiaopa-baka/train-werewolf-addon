// @ts-check
// taskSystem.js - 任务系统

import * as mc from "@minecraft/server";
import { getWorldConfig } from "./config/worldConfig.js";


// 游戏开始后按概率给无任务玩家分配随机任务
mc.system.runInterval(() => {
    const players = Array.from(mc.world.getPlayers());
    if (players.length === 0) return;

    try {
        const objTaskCount = mc.world.scoreboard.getObjective("lw_p1:任务数");
        const objPublishTime = mc.world.scoreboard.getObjective("lw_p1:任务开始发布时间");
        const objGameTime = mc.world.scoreboard.getObjective("lw_p1:游戏时间");
        const objProbability = mc.world.scoreboard.getObjective("lw_p1:每秒分配概率");

        const maxTask = objTaskCount.getScore("lw_p1:全局") ?? 6;
        const publishTime = objPublishTime.getScore("lw_p1:全局") ?? 20;
        const percent = objProbability?.getScore("lw_p1:全局") ?? 3;
        const chance = Math.min(Math.max(percent / 100, 0), 1);

        for (const player of players) {
            if (!player.hasTag("lw_p1:游戏中") || player.hasTag("lw_p1:有任务")) continue;

            const playerGameTime = objGameTime.getScore(player);
            if (playerGameTime / 20 < publishTime) continue;

            if (Math.random() < chance) {
                const taskNum = Math.floor(Math.random() * maxTask) + 1;
                player.addTag(`lw_p1:任务${taskNum}`);
                player.addTag("lw_p1:有任务");
                player.addLevels(1);
            }
        }
    } catch (e) { }
}, 20);


// 玩家获得任务后添加 请求倒计时 标签
mc.system.runInterval(() => {
    const timerObj = mc.world.scoreboard.getObjective("lw_p1:计时器");
    if (!timerObj) return;

    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;

        const hasGameTag = player.hasTag("lw_p1:游戏中");
        const hasTaskTag = player.hasTag("lw_p1:有任务");
        const noCountdownTag = !player.hasTag("lw_p1:倒计时");

        let timerScore = 0;
        try {
            timerScore = timerObj.getScore(player);
        } catch {
            timerScore = 0;
        }

        if (hasGameTag && hasTaskTag && noCountdownTag && timerScore === 0) {
            if (!player.hasTag("lw_p1:请求倒计时")) {
                player.addTag("lw_p1:请求倒计时");
            }
        }
    }
}, 1);


// 请求倒计时后将倒计时写入玩家等级
mc.system.runInterval(() => {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid || !player.hasTag("lw_p1:请求倒计时")) continue;

        try {
            const objKillerTime = mc.world.scoreboard.getObjective("lw_p1:杀手虚假任务限时");
            const objTaskTime = mc.world.scoreboard.getObjective("lw_p1:单个任务限时");

            if (player.hasTag("lw_p1:杀手")) {
                const rawKillerTime = objKillerTime?.getScore("lw_p1:全局") ?? 50;
                if (rawKillerTime > 0) {
                    player.addLevels(rawKillerTime);
                }
            } else {
                const rawTaskTime = objTaskTime?.getScore("lw_p1:全局") ?? 100;
                if (rawTaskTime > 0) {
                    player.addLevels(rawTaskTime);
                }
            }

            player.removeTag("lw_p1:请求倒计时");
            if (!player.hasTag("lw_p1:倒计时")) {
                player.addTag("lw_p1:倒计时");
            }
        } catch (e) { }
    }
}, 1);


// 倒计时中玩家每秒扣除 1 级经验
mc.system.runInterval(() => {
    const timerObj = mc.world.scoreboard.getObjective("lw_p1:计时器");
    if (!timerObj) return;

    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;

        const inGame = player.hasTag("lw_p1:游戏中");
        const inCountdown = player.hasTag("lw_p1:倒计时");

        let timerScore = 0;
        try {
            timerScore = timerObj.getScore(player);
        } catch {
            timerScore = 0;
        }
        const timerZero = timerScore === 0;

        if (inGame && inCountdown && timerZero) {
            player.addLevels(-1);
        }
    }
}, 1);


// 全局冷却缓存（供任务4/5使用）
const scoreCooldown = new Map();
const COOLDOWN_TIME = 2000;


// 任务1，车头/车尾通风区域，通风中 标签
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

    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const pos = player.location;

        const inEngine =
            pos.x >= engMinX && pos.x < engMaxX &&
            pos.y >= engMinY && pos.y < engMaxY &&
            pos.z >= engMinZ && pos.z < engMaxZ;

        const inTail =
            pos.x >= tailMinX && pos.x < tailMaxX &&
            pos.y >= tailMinY && pos.y < tailMaxY &&
            pos.z >= tailMinZ && pos.z < tailMaxZ;

        if (inEngine || inTail) {
            if (!player.hasTag("lw_p1:通风中")) {
                player.addTag("lw_p1:通风中");
            }
        } else {
            if (player.hasTag("lw_p1:通风中")) {
                player.removeTag("lw_p1:通风中");
            }
        }
    }
}, 1);


// 任务2，蹲坑区域检测，蹲坑中 标签
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
        const hasSocialTag = player.hasTag("lw_p1:社交中");
        let inToiletRange = false;

        for (const toilet of toiletList) {
            if (!toilet || toilet.x === undefined) continue;
            const dx = x - toilet.x;
            const dy = y - toilet.y;
            const dz = z - toilet.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist <= 1) {
                inToiletRange = true;
                break;
            }
        }

        if (inToiletRange && !hasSocialTag) {
            if (!player.hasTag("lw_p1:蹲坑中")) {
                player.addTag("lw_p1:蹲坑中");
            }
        } else {
            if (player.hasTag("lw_p1:蹲坑中")) {
                player.removeTag("lw_p1:蹲坑中");
            }
        }
    }
}, 1);


// 任务3，睡觉状态检测，睡觉中 标签
mc.system.runInterval(() => {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const isSleeping = player.isSleeping;
        const hasTag = player.hasTag("lw_p1:睡觉中");

        if (isSleeping && !hasTag) {
            player.addTag("lw_p1:睡觉中");
        } else if (!isSleeping && hasTag) {
            player.removeTag("lw_p1:睡觉中");
        }
    }
}, 1);


// 任务4/5，进食食物/饮用饮品 计分加分
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

        const isGaming = player.hasTag("lw_p1:游戏中");
        let needAddScore = false;
        const latestCfg = getWorldConfig();

        if (isGaming && player.hasTag("lw_p1:任务4") && latestCfg.allowedFoods?.includes(itemId)) {
            needAddScore = true;
        }
        if (isGaming && player.hasTag("lw_p1:任务5") && latestCfg.allowedDrinks?.includes(itemId)) {
            needAddScore = true;
        }

        if (needAddScore) {
            mc.world.scoreboard.getObjective("lw_p1:任务中")?.addScore(player, 1);
            scoreCooldown.set(playerId, now);
        }

        if (now - lastTime > COOLDOWN_TIME * 10) {
            scoreCooldown.delete(playerId);
        }
    });
});


// 任务6，玩家近距离检测，社交中 标签
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

            if (distSq <= 9) {
                hasOtherPlayerNearby = true;
                break;
            }
        }

        if (hasOtherPlayerNearby) {
            if (!player.hasTag("lw_p1:社交中")) {
                player.addTag("lw_p1:社交中");
            }
        } else {
            if (player.hasTag("lw_p1:社交中")) {
                player.removeTag("lw_p1:社交中");
            }
        }
    }
}, 1);


// 玩家任务完成，清空任务标签、重置计分板、重置经验、发放金币奖励
mc.system.runInterval(() => {
    const taskCountObjective = mc.world.scoreboard.getObjective("lw_p1:任务数");
    if (!taskCountObjective) return;

    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        if (!player.hasTag("lw_p1:任务完成")) continue;

        // 发放任务完成金币奖励（仅平民/警员，杀手不发）
        if (!player.hasTag("lw_p1:杀手") && !player.hasTag("lw_p1:已发奖励")) {
            try {
                const goldObj = mc.world.scoreboard.getObjective("lw_p1:金币");
                const rewardObj = mc.world.scoreboard.getObjective("lw_p1:任务完成奖励");
                const reward = rewardObj?.getScore("lw_p1:全局") ?? 25;
                if (goldObj && reward > 0) {
                    goldObj.addScore(player, reward);
                }
                player.addTag("lw_p1:已发奖励");
            } catch (e) { }
        }

        player.removeTag("lw_p1:有任务");
        player.removeTag("lw_p1:倒计时");
        player.removeTag("lw_p1:已提示");
        player.removeTag("lw_p1:已发奖励");

        const maxTaskIndex = taskCountObjective.getScore("lw_p1:全局") || 0;
        for (let i = 1; i <= maxTaskIndex; i++) {
            player.removeTag(`lw_p1:任务${i}`);
        }

        mc.world.scoreboard.getObjective("lw_p1:任务中")?.setScore(player, 0);
        player.addLevels(-1000);

        player.removeTag("lw_p1:任务完成")
    }
}, 1);


// 平民死亡给杀手金币，加时
mc.system.runInterval(() => {
    const goldObj = mc.world.scoreboard.getObjective("lw_p1:金币");
    const extraObj = mc.world.scoreboard.getObjective("lw_p1:死亡加时");
    const killer = Array.from(mc.world.getPlayers()).find(p => p.isValid && p.hasTag("lw_p1:杀手"));
    if (!goldObj || !killer) return;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (player.hasTag("lw_p1:杀手")) continue;
        if (!player.hasTag("lw_p1:游戏中")) continue;
        if (player.hasTag("lw_p1:已击杀奖励")) continue;

        let isSpec = false;
        try { isSpec = player.getGameMode() === mc.GameMode.Spectator; } catch { isSpec = false; }
        if (!isSpec) continue;

        player.addTag("lw_p1:已击杀奖励");
        if (extraObj) extraObj.addScore("lw_p1:全局", 60);
        goldObj.addScore(killer, 100);
        try { killer.sendMessage("§e有平民死亡，获得 100 金币，倒计时延长 60 秒"); } catch (e2) { }
    }
}, 1);


// 倒计时结束，未完成任务非杀手添加 任务失败 标签
mc.system.runInterval(() => {
    const allPlayers = mc.world.getPlayers();
    for (const player of allPlayers) {
        if (!player.isValid) continue;

        const isNeedFail =
            player.hasTag("lw_p1:游戏中") &&
            player.hasTag("lw_p1:有任务") &&
            player.hasTag("lw_p1:倒计时") &&
            !player.hasTag("lw_p1:杀手") &&
            player.level === 0;

        if (isNeedFail) {
            if (!player.hasTag("lw_p1:任务失败")) {
                player.addTag("lw_p1:任务失败");
            }
        }
    }
}, 20);


// 任务失败的玩家原地死亡
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!player.hasTag("lw_p1:游戏中")) continue;
        if (!player.hasTag("lw_p1:任务失败")) continue;

        let isSpec = false;
        try { isSpec = player.getGameMode() === mc.GameMode.Spectator; } catch { isSpec = false; }
        if (isSpec) continue;

        try {
            // 生成尸体
            player.runCommand("summon lw_p1:corpes ~ ~ ~ facing ^ ^ ^1");
            player.setGameMode(mc.GameMode.Spectator);
            player.removeTag("lw_p1:受到伤害");

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