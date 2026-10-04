// @ts-check
// state.js - 对局运行期状态与金币访问器

import * as mc from "@minecraft/server";
import { getConfig } from "../config/worldConfig.js";


// 全局对局计时（内存）
let gameTicks = 0;       // 游戏时间（tick），仅在"游戏中"存在时累加
let deathExtraSec = 0;   // 死亡加时（秒）

export function getGameTicks() {
    return gameTicks;
}

export function addGameTick() {
    gameTicks += 1;
}

// 重置对局计时（开局 / 结束时调用）
export function resetGameClock() {
    gameTicks = 0;
    deathExtraSec = 0;
}

export function getDeathExtra() {
    return deathExtraSec;
}

export function addDeathExtra(seconds) {
    deathExtraSec += seconds;
}

// 剩余游戏秒数 = 基础时长 + 死亡加时 - 已过时间（下限 0）
export function getRemainSeconds() {
    const base = getConfig("baseDuration");
    return Math.max(0, base + deathExtraSec - Math.floor(gameTicks / 20));
}


// 任务进度（内存，每玩家；退出重进清零）
/** @type {Map<string, number>} playerId -> 当前任务进度值 */
const taskProgress = new Map();

export function getTaskProgress(player) {
    return taskProgress.get(player.id) ?? 0;
}

export function setTaskProgress(player, value) {
    if (value <= 0) {
        taskProgress.delete(player.id);
    } else {
        taskProgress.set(player.id, value);
    }
}

export function addTaskProgress(player, amount) {
    setTaskProgress(player, getTaskProgress(player) + amount);
}

export function resetTaskProgress(player) {
    taskProgress.delete(player.id);
}

export function clearTaskProgress(playerId) {
    taskProgress.delete(playerId);
}

// 清空所有玩家的任务进度（开局 / 结束时调用）
export function clearAllTaskProgress() {
    taskProgress.clear();
}


// 金币（访问器，暂存于计分板 lw_p1:金币）
const GOLD_OBJECTIVE = "lw_p1:金币";

function ensureGoldObjective() {
    let obj = mc.world.scoreboard.getObjective(GOLD_OBJECTIVE);
    if (!obj) obj = mc.world.scoreboard.addObjective(GOLD_OBJECTIVE);
    return obj;
}

export function getGold(player) {
    try {
        return ensureGoldObjective().getScore(player) ?? 0;
    } catch (e) {
        return 0;
    }
}

export function setGold(player, value) {
    try {
        ensureGoldObjective().setScore(player, value);
    } catch (e) { }
}

export function addGold(player, amount) {
    if (amount === 0) return;
    try {
        ensureGoldObjective().addScore(player, amount);
    } catch (e) { }
}


// ===== 玩家对局状态（内存，键 = player.id） =====
// 官方保证 Entity.id 跨世界加载一致，故玩家中途重进状态仍保留；
// 世界关闭重开时本表随脚本重启清空（对局清零）。本表取代全部实体 tag。

/**
 * @typedef {Object} PlayerState
 * @property {boolean} inGame               游戏中
 * @property {boolean} inTrain              位于列车
 * @property {"killer"|"officer"|null} role 角色（null = 平民）
 * @property {boolean} endFlag               游戏结束（收尾信号）
 * @property {boolean} pistolDisabled        禁用手枪
 * @property {boolean} hurt                  受到伤害（瞬态事件）
 * @property {boolean} ventilating           通风中（派生）
 * @property {boolean} squatting             蹲坑中（派生）
 * @property {boolean} sleeping              睡觉中（派生）
 * @property {boolean} socializing           社交中（派生）
 * @property {number}  taskId                当前任务 1..6（0 = 无）
 * @property {boolean} taskCountdown         倒计时
 * @property {boolean} taskRequestCountdown  请求倒计时
 * @property {boolean} taskHinted            已提示
 * @property {boolean} taskDone              任务完成
 * @property {boolean} taskFailed            任务失败
 * @property {boolean} rewardGiven           已发奖励
 * @property {boolean} killRewardGiven       已击杀奖励
 */

/** @type {Map<string, PlayerState>} */
const playerStates = new Map();

/** 取玩家对局状态（不存在则初始化） @returns {PlayerState} */
export function getPlayerState(player) {
    let ps = playerStates.get(player.id);
    if (!ps) {
        ps = {
            inGame: false, inTrain: false, role: null, endFlag: false,
            pistolDisabled: false, hurt: false,
            ventilating: false, squatting: false, sleeping: false, socializing: false,
            taskId: 0, taskCountdown: false, taskRequestCountdown: false, taskHinted: false,
            taskDone: false, taskFailed: false, rewardGiven: false, killRewardGiven: false
        };
        playerStates.set(player.id, ps);
    }
    return ps;
}

export function isInGame(player) { return getPlayerState(player).inGame; }
export function isKiller(player) { return getPlayerState(player).role === "killer"; }
export function isOfficer(player) { return getPlayerState(player).role === "officer"; }
export function setRole(player, role) { getPlayerState(player).role = role; }

/** 清空全部玩家对局状态（开局重置 / 收尾清理） */
export function clearAllPlayerStates() { playerStates.clear(); }


// 跨模块共享的本局运行态（gameFlow 开局流程 与 gameEnd 结算流程 共用）
export const gameSession = { endTriggered: false, pendingEndMsg: null, roleRewardsGiven: false };