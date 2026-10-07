// @ts-check
// gameFlow.js - 开局流程 / 随机传送 / 职业分配 / 对局计时

import * as mc from "@minecraft/server";
import { getWorldConfig, getConfig } from "../config/worldConfig.js";
import {
    resetGameClock, addGameTick, setGold,
    clearAllTaskProgress, getPlayerState, isInGame, isKiller, isOfficer, setRole,
    clearAllPlayerStates, gameSession,
} from "../core/state.js";
import { t } from "../core/i18n.js";
import { showTitle, clearTitle, fadeBlackTransition, markTitleBusy } from "../core/hud.js";
import { setGameTime, setGameWeather, clearGameEntities, playTrainWhistle } from "./environment.js";
import { clearCrowbaredDoors } from "../blocks/keydoor.js";


// 开局角色提示
// 直接用 onScreenDisplay.setTitle 接收 RawMessage，避免 titleraw 命令对 JSON 格式的额外要求
function showRoleTitle() {
    markTitleBusy(5 + 50 + 10);
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid || !isInGame(player)) continue;
        const roleKey = isKiller(player) ? "lw_p1.roleTitle.killer"
            : isOfficer(player) ? "lw_p1.roleTitle.officer"
                : "lw_p1.roleTitle.passenger";
        try {
            player.onScreenDisplay.setTitle(t(roleKey), {
                fadeInDuration: 5,
                stayDuration: 50,
                fadeOutDuration: 10,
                subtitle: t("lw_p1.roleWelcome")
            });
        } catch (e) { }
    }
}

// 开局目标提示
function showRoleGoal() {
    markTitleBusy(5 + 50 + 10);
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid || !isInGame(player)) continue;
        const goalKey = isKiller(player) ? "lw_p1.roleGoal.killer"
            : isOfficer(player) ? "lw_p1.roleGoal.officer"
                : "lw_p1.roleGoal.passenger";
        try {
            player.onScreenDisplay.setTitle(t("lw_p1.roleGoalTitle"), {
                fadeInDuration: 5,
                stayDuration: 50,
                fadeOutDuration: 10,
                subtitle: t(goalKey)
            });
        } catch (e) { }
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
export function startGameNow(allPlayers) {
    try {
        // 重置本局结束状态与对局计时（计时/任务进度均为内存态）
        gameSession.endTriggered = false;
        gameSession.pendingEndMsg = null;
        gameSession.roleRewardsGiven = false;
        // 清空上一局结算文案，右侧面板随开局清空（局外常驻展示到此为止）
        gameSession.lastResultText = null;
        resetGameClock();
        clearAllTaskProgress();
        // 先记录仍在列车上的玩家；clearAllPlayerStates 会清空内存状态（含 inTrain）
        const boardedPlayers = allPlayers.filter(p => p.isValid && getPlayerState(p).inTrain);
        clearAllPlayerStates();

        // 开局清理：清除上一局残留、避免影响新对局
        // clearAllPlayerStates 已把全部对局状态归零（含"失去手枪资格" pistolDisabled）
        clearGameEntities();     // 残留尸体 / 名牌 / 爆竹 / 掉落手枪 / 子弹 / 手榴弹 / 掉落物
        clearCrowbaredDoors();   // 残留的撬棍锁定门
        for (const player of allPlayers) {
            if (!player.isValid) continue;
            try { player.setDynamicProperty("lw_p1:noteMessage", undefined); } catch (e) { }
        }

        showTitle(t("lw_p1.msg.gameStart"));
        mc.system.runTimeout(() => {
            clearTitle();
        }, 20);

        for (const player of allPlayers) {
            if (!player.isValid) continue;
            // 清除上一局残留的职业，保证每局角色重新随机分配
            setRole(player, null);
            if (boardedPlayers.includes(player)) {
                getPlayerState(player).inGame = true;
            }
            // 开局统一切到冒险模式（结算判定以冒险模式为存活）
            try { player.setGameMode(mc.GameMode.Adventure); } catch (e) { }
        }

        // 开局转场：所有参与玩家缓慢黑屏，全黑瞬间随机传送，再缓慢恢复
        // 汽笛在开始变黑时响起，声源在车头
        playTrainWhistle();
        fadeBlackTransition(allPlayers, { fadeInTime: 2, holdTime: 0.5, fadeOutTime: 2 }, () => {
            teleportPlayersToRandomCoords(allPlayers);
            // 职业分配与全部道具发放（清背包、初始金币、房间钥匙、便条、杀手商店、警员手枪）
            // 都放到全黑瞬间执行，避免玩家看见背包变化
            checkRoleAssign();
        });
        setGameTime("night");
        // 开局天气：开关开启时设为雷暴雨（配置界面可关闭）
        if (getWorldConfig().weatherEnabled !== false) {
            setGameWeather("thunder");
        }

        // 职业提示推迟到转场（约 4.5 秒）结束后，避免被黑屏遮挡
        mc.system.runTimeout(() => showRoleTitle(), 100);
        mc.system.runTimeout(() => showRoleGoal(), 180);
    } catch (e) { }
}


// 游戏开始后分配职业
async function checkRoleAssign() {
    try {
        const allPlayers = Array.from(mc.world.getPlayers());
        const inGamePlayers = allPlayers.filter(p => p.isValid && isInGame(p));
        if (inGamePlayers.length === 0) {
            gameSession.roleRewardsGiven = false;
            return;
        }

        const hasKiller = inGamePlayers.some(p => isKiller(p));
        const hasPolice = inGamePlayers.some(p => isOfficer(p));

        // 职业分配
        if (!hasKiller) {
            const candidatesKiller = inGamePlayers.filter(p => !isOfficer(p));
            if (candidatesKiller.length > 0) {
                const target = candidatesKiller[Math.floor(Math.random() * candidatesKiller.length)];
                setRole(target, "killer");
            }
        }

        if (!hasPolice) {
            const candidatesPolice = inGamePlayers.filter(p => !isKiller(p));
            if (candidatesPolice.length > 0) {
                const target = candidatesPolice[Math.floor(Math.random() * candidatesPolice.length)];
                setRole(target, "officer");
            }
        }

        // 只有本局首次分配完成时才发放物品
        if (gameSession.roleRewardsGiven) return;
        gameSession.roleRewardsGiven = true;

        try {
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                p.runCommand(`clear @s`);
            }
        } catch (err) { }

        // 职业分配完成，发放初始金币
        try {
            const killerGold = getConfig("killerGold");
            const civilGold = getConfig("civilGold");
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                setGold(p, isKiller(p) ? killerGold : civilGold);
            }
        } catch (err) { }

        // 随机分配房间钥匙
        try {
            const roomCount = getConfig("roomCount");
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
                if (!isKiller(p)) continue;
                p.runCommand(`replaceitem entity @s slot.hotbar 8 lw_p1:killer_store 1 0 {"minecraft:item_lock":{"mode":"lock_in_slot"}}`);
            }
        } catch (err) { }

        // 警员开局发放左轮手枪
        try {
            for (const p of inGamePlayers) {
                if (!p.isValid) continue;
                if (!isOfficer(p)) continue;
                const pistol = new mc.ItemStack("lw_p1:pistol", 1);
                p.getComponent("inventory").container.addItem(pistol);
            }
        } catch (err) { }

    } catch (err) { }
}

// 游戏进行中，记录游戏总 Tick
mc.system.runInterval(() => {
    const allPlayers = Array.from(mc.world.getPlayers());
    const hasGameInPlayer = allPlayers.some(player => {
        return player.isValid && isInGame(player);
    });

    if (hasGameInPlayer) {
        addGameTick();
    }
}, 1);