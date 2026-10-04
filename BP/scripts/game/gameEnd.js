// @ts-check
// gameEnd.js - 胜负判定 / 职业名单收集 / 结果广播 / 收尾清理 / 重进守卫

import * as mc from "@minecraft/server";
import { getWorldConfig } from "../config/worldConfig.js";
import {
    resetGameClock, getRemainSeconds, setGold, clearAllTaskProgress,
    getPlayerState, isInGame, isKiller, isOfficer, clearAllPlayerStates, gameSession,
} from "../core/state.js";
import { t } from "../core/i18n.js";
import { clearCrowbaredDoors } from "../blocks/keydoor.js";
import { setGameTime } from "./environment.js";


// 结束原因内部代号 → 语言键
const END_REASON_KEYS = {
    "杀手死亡": "lw_p1.end.reason.killerDead",
    "时间耗尽": "lw_p1.end.reason.timeUp",
    "平民全部死亡": "lw_p1.end.reason.civilsDead"
};

// 名单拼接：用可翻译的分隔符连接，无成员时显示“无”
function joinNames(names) {
    if (!names || names.length === 0) return t("lw_p1.common.none");
    const parts = [];
    names.forEach((n, i) => {
        if (i > 0) parts.push(t("lw_p1.common.listSep"));
        parts.push({ text: String(n) });
    });
    return { rawtext: parts };
}

// 广播结束消息
function broadcastEndMessage() {
    if (!gameSession.pendingEndMsg) return;
    const { winner, reason, killerNames, policeNames, civilNames } = gameSession.pendingEndMsg;
    const resultLine = t(winner === "杀手" ? "lw_p1.end.winner.killer" : "lw_p1.end.winner.civil");
    const reasonText = t(END_REASON_KEYS[reason] ?? reason);
    const killer = joinNames(killerNames);
    const police = joinNames(policeNames);
    const civils = joinNames(civilNames);
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        player.sendMessage(t("lw_p1.end.message", resultLine, reasonText, killer, police, civils));
    }
    gameSession.pendingEndMsg = null;
}

// 结算判定
// 规则1：游戏中只存在杀手一个冒险模式，杀手胜利
// 规则2：杀手的游戏模式不是冒险模式，平民胜利
// 规则3：任务栏时间归零，平民胜利
mc.system.runInterval(() => {
    try {
        if (gameSession.endTriggered) return;

        const allPlayers = Array.from(mc.world.getPlayers());
        const inGame = allPlayers.filter(p => p.isValid && isInGame(p));
        if (inGame.length === 0) return;

        const isAlive = (p) => {
            try { return p.getGameMode() === mc.GameMode.Adventure; } catch { return false; }
        };

        const killers = inGame.filter(p => isKiller(p));
        const civils = inGame.filter(p => !isKiller(p));
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
            if (getRemainSeconds() <= 0) {
                endMsg = { winner: "平民", reason: "时间耗尽" };
            }
        }

        if (endMsg) {
            gameSession.endTriggered = true;
            // 收集本局职业名单
            collectGameResult(endMsg.reason, endMsg.winner);
            // 标记收尾信号 endFlag（后续轮询据此触发收尾清理）
            for (const p of inGame) {
                if (!getPlayerState(p).endFlag) getPlayerState(p).endFlag = true;
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
    const inGame = Array.from(mc.world.getPlayers()).filter(p => p.isValid && isInGame(p));
    const killerP = inGame.filter(p => isKiller(p));
    const policeP = inGame.filter(p => isOfficer(p));
    const civilP = inGame.filter(p => !isKiller(p) && !isOfficer(p));
    gameSession.pendingEndMsg = {
        winner,
        reason,
        killerNames: killerP.map(p => p.name),
        policeNames: policeP.map(p => p.name),
        civilNames: civilP.map(p => p.name)
    };
}


// 全局游戏结束
mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());
    const hasGameEndPlayer = allPlayers.some(player => {
        return player.isValid && getPlayerState(player).endFlag;
    });
    if (!hasGameEndPlayer) return;

    // 收尾清理全部玩家的对局内存状态
    clearAllPlayerStates();

    // 重置对局计时与任务进度（运行态均为内存）
    resetGameClock();
    clearAllTaskProgress();

    // 清空经验、金币、背包与效果，设置模式并补发物品
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        try { setGold(player, 0); } catch (e) { }
        try { player.addLevels(-1000); } catch (e) { }
        try { player.setGameMode(mc.GameMode.Adventure); } catch (e) { }
        try { player.runCommand("clear @s"); } catch (e) { }
        try { player.runCommand("effect @s clear"); } catch (e) { }
        try { player.runCommand(`give @s lw_p1:guide_book 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`); } catch (e) { }
        try { player.runCommand(`give @s lw_p1:tp_game 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`); } catch (e) { }
    }

    // 清除本局生成的实体（三个维度）
    for (const dimName of ["overworld", "nether", "the_end"]) {
        let dimension;
        try { dimension = mc.world.getDimension(dimName); } catch { continue; }
        if (!dimension) continue;
        for (const typeId of ["lw_p1:corpes", "lw_p1:player_name", "lw_p1:firecracker", "lw_p1:pistol", "minecraft:item"]) {
            try { dimension.runCommand(`kill @e[type=${typeId}]`); } catch (e) { }
        }
    }

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
}, 1);


// 既无游戏中玩家、也无游戏结束标记时，重置结束/发放标记，保证下一局从干净状态开始
mc.system.runInterval(() => {
    try {
        const players = Array.from(mc.world.getPlayers());
        const hasInGame = players.some(p => p.isValid && isInGame(p));
        const hasEnd = players.some(p => p.isValid && getPlayerState(p).endFlag);
        if (!hasInGame && !hasEnd) {
            gameSession.endTriggered = false;
            gameSession.roleRewardsGiven = false;
        }
    } catch (e) { }
}, 20);


// 重进守卫：中途退出又加入的玩家不重复参与结算
// 监听玩家刚进入世界
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.playerJoin.subscribe((event) => {
        const allPlayers = Array.from(mc.world.getPlayers());
        const player = allPlayers.find(p => p.id === event.playerId);

        if (!player?.isValid) return;

        const gameIsRunning = allPlayers.some(player =>
            player.isValid && isInGame(player)
        );

        if (gameIsRunning) {
            getPlayerState(player).taskFailed = true;
        }
    });
});