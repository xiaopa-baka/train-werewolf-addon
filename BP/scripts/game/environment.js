// @ts-check
// environment.js - 世界规则 / 游戏时间 / 传送物品 / 列车区域轮询 / 坠车判定

import * as mc from "@minecraft/server";
import { getWorldConfig } from "../config/worldConfig.js";
import { getPlayerState, isInGame } from "../core/state.js";
import { playSoundNearby } from "../gameplay/props.js";


// 世界基础规则
mc.world.afterEvents.worldLoad.subscribe(() => {
    try { mc.world.getDimension("overworld").runCommand("gamerule commandblockoutput false"); } catch (e) { }
    try { mc.world.getDimension("overworld").runCommand("gamerule sendcommandfeedback false"); } catch (e) { }
    try { mc.world.getDimension("overworld").runCommand("gamerule showtags false"); } catch (e) { }
});


// 工具函数，设置游戏时间
export function setGameTime(mode) {
    const timeMap = {
        day: 1000,
        noon: 6000,
        sunset: 14000,
        night: 18000
    };
    mc.world.setTimeOfDay(timeMap[mode]);
}


// 工具函数，设置游戏天气。
// 注意：基岩版天气是全局的（按键维度/区域区分不可行），此处仅切换主世界天气。
// mode: "thunder" 雷暴雨 / "rain" 下雨 / "clear" 晴天
export function setGameWeather(mode) {
    const weatherMap = {
        thunder: mc.WeatherType.Thunder,
        rain: mc.WeatherType.Rain,
        clear: mc.WeatherType.Clear
    };
    const weatherType = weatherMap[mode];
    if (weatherType === undefined) return;
    try { mc.world.getDimension("overworld").setWeather(weatherType); } catch (e) { }
}


// 清除本局残留的实体（三个维度）：尸体 / 名牌 / 爆竹 / 掉落手枪 / 子弹 / 手榴弹 / 掉落物。
// 开局与结束共用，避免上一局残留影响新对局。
export function clearGameEntities() {
    for (const dimName of ["overworld", "nether", "the_end"]) {
        let dimension;
        try { dimension = mc.world.getDimension(dimName); } catch { continue; }
        if (!dimension) continue;
        for (const typeId of ["lw_p1:corpes", "lw_p1:player_name", "lw_p1:firecracker", "lw_p1:pistol", "lw_p1:bullet", "lw_p1:grenade", "minecraft:item"]) {
            try { dimension.runCommand(`kill @e[type=${typeId}]`); } catch (e) { }
        }
    }
}


// 火车汽笛：声源固定在车头坐标，范围覆盖整列车。
// 车头坐标未配置时，退化为对每个玩家直接播放（无方位）。
export function playTrainWhistle() {
    const latestConfig = getWorldConfig();
    const pos = latestConfig.trainEngineCoordinates ?? latestConfig.trainCoordinates?.start;
    const hasPos = pos && typeof pos.x === "number" && typeof pos.y === "number" && typeof pos.z === "number";

    if (hasPos) {
        playSoundNearby("overworld", pos, "train_whistle", 0.003);
        return;
    }

    // 无坐标兜底：就地给所有玩家播放
    try { mc.world.getDimension("overworld")?.runCommand("playsound train_whistle @a"); } catch (e) { }
}


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


// 列车区域，位于列车 状态位 inTrain
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
            if (!getPlayerState(player).inTrain) {
                getPlayerState(player).inTrain = true;
            }
        } else {
            if (getPlayerState(player).inTrain) {
                getPlayerState(player).inTrain = false;
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
        if (!isInGame(player)) continue;

        // 已是旁观模式则跳过
        let isSpec = false;
        try { isSpec = player.getGameMode() === mc.GameMode.Spectator; } catch { isSpec = false; }
        if (isSpec) continue;

        // 玩家 Y 坐标低于最低 Y - 2 格，视为坠车死亡
        if (player.location.y < lowestY - 2) {
            try {
                player.setGameMode(mc.GameMode.Spectator);
                getPlayerState(player).hurt = false;
            } catch (e) { }
        }
    }
}, 1);