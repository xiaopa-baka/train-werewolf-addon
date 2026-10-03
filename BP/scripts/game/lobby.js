// @ts-check
// lobby.js - 大厅：自动开局轮询 + 手动开局命令 + 登车人数活动栏

import * as mc from "@minecraft/server";
import { getWorldConfig, getConfig } from "../config/worldConfig.js";
import { getPlayerState, isInGame } from "../core/state.js";
import { t } from "../core/i18n.js";
import { registerActionBarProvider, showTitle, clearCountdown } from "../core/hud.js";
import { startGameNow } from "./gameFlow.js";


// 手动开局自定义命令
// 命令回调运行在只读上下文，实际开局逻辑经 system.run 延后到下一帧执行
mc.system.beforeEvents.startup.subscribe((init) => {
    init.customCommandRegistry.registerCommand({
        name: "lw_p1:start",
        description: "Manually start the game",
        permissionLevel: mc.CommandPermissionLevel.GameDirectors,
    }, () => {
        mc.system.run(() => requestManualStart());
        return { status: mc.CustomCommandStatus.Success };
    });
});


// 手动开局请求：校验最低人数后开局
function requestManualStart() {
    const allPlayers = Array.from(mc.world.getPlayers());
    if (allPlayers.some(p => p.isValid && isInGame(p))) return;

    const minPlayer = getConfig("minPlayers");
    const inTrainList = allPlayers.filter(p => p.isValid && getPlayerState(p).inTrain);
    if (inTrainList.length >= minPlayer) {
        startGameNow(allPlayers);
        gameStartTimer = null;
    } else {
        for (const p of allPlayers) {
            if (!p.isValid) continue;
            try { p.sendMessage(t("lw_p1.msg.notEnoughPlayers", inTrainList.length, minPlayer)); } catch (e) { }
        }
    }
}


// 非游戏阶段，活动栏显示列车人数统计（注册到活动栏调度器）
let boardedCacheTick = -1;
let boardedCache = undefined;
function boardedText() {
    const tick = mc.system.currentTick;
    if (tick === boardedCacheTick) return boardedCache;
    boardedCacheTick = tick;

    const latestConfig = getWorldConfig();
    if (!latestConfig.trainCoordinates?.start || !latestConfig.trainCoordinates?.end) {
        boardedCache = undefined;
        return undefined;
    }

    const allPlayers = Array.from(mc.world.getPlayers());
    const hasInGameTag = allPlayers.some(player => isInGame(player));
    if (hasInGameTag) {
        boardedCache = undefined;
        return undefined;
    }

    const totalPlayerCount = allPlayers.length;
    const inTrainPlayerCount = allPlayers.filter(player => getPlayerState(player).inTrain).length;

    boardedCache = t("lw_p1.msg.boarded", inTrainPlayerCount, totalPlayerCount);
    return boardedCache;
}


// 非游戏阶段，人数达标且全在列车内 开启开局倒计时
// 倒计时结束后将玩家随机传送至出生坐标，将时间设为午夜
let gameStartTimer = null;

mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());

    const hasInGame = allPlayers.some(p => p.isValid && isInGame(p));

    if (hasInGame) return;

    // 是否启用自动开始
    if (!getConfig("autoStart")) return;

    const totalCount = allPlayers.length;
    const inTrainList = allPlayers.filter(p => p.isValid && getPlayerState(p).inTrain);
    const allInTrain = totalCount > 0 && inTrainList.length === totalCount;

    if (!allInTrain && gameStartTimer !== null) {
        gameStartTimer = null;
        clearCountdown();
        return;
    }

    const minPlayer = getConfig("minPlayers");

    if (!(totalCount >= minPlayer && allInTrain)) {
        return;
    }

    try {
        if (gameStartTimer === null) {
            gameStartTimer = getConfig("autoStartDelay");
            showTitle(t("lw_p1.msg.autoStart.title", gameStartTimer), t("lw_p1.msg.autoStart.subtitle"));
        }

        // 每 20 tick（1 秒）递减一次开局倒计时
        if (mc.system.currentTick % 20 === 0) {
            if (gameStartTimer > 0) {
                gameStartTimer--;
                showTitle(t("lw_p1.msg.autoStart.title", gameStartTimer), t("lw_p1.msg.autoStart.subtitle"));
            } else if (gameStartTimer === 0) {
                gameStartTimer = -1;
                startGameNow(allPlayers);
                gameStartTimer = null;
            }
        }
    } catch (err) { }
}, 1);   // 每 tick 轮询，人数达标后能即时响应


// 各功能的注册（weight 越大，轮播中停留的份额越多）
registerActionBarProvider("lw_p1:boarded", () => boardedText(), { weight: 2 });