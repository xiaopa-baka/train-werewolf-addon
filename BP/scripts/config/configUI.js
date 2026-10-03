// @ts-check
// config_UI.js - 用于管理游戏配置的UI界面脚本

import * as mc from "@minecraft/server";
import {ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { getWorldConfig, saveWorldConfig, getEmptyConfig, getScoreboardDefault, getScoreboardSlider, getAllScoreboardDefaults } from "./worldConfig.js";


// 将玩家位置转换为方块坐标，并提供一个函数将方块坐标转换为方块中心坐标，方便UI输入输出
function getPlayerBlockIntPos(player) {
    return {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };
}


function intPosToCenter(intX, intY, intZ) {
    return {
        x: intX + 0.5,
        y: intY + 0.5,
        z: intZ + 0.5
    };
}


// 获取全局计分板分数
function getSco(objName, def = getScoreboardDefault(objName)) {
    try {
        return mc.world.scoreboard.getObjective(objName).getScore("lw_p1:全局") ?? def;
    } catch {
        return def;
    }
}


// 使用物品 木棍 打开配置UI
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (player && player.isValid && event.itemStack?.typeId === "minecraft:stick") {
            showMainForm(player);
        }
    });
});


// 主界面
function showMainForm(player) {
    if (!player.isValid) return;

    const mainForm = new ActionFormData()
        .title("主配置面板")
        .body("请选择配置分类")
        .button("全局游戏配置")
        .button("地图区域配置")
        .button("食物&饮品配置")
        .button("商店配置")
        .button("其他")
        .button("§c关闭");

    mainForm.show(player).then(res => {
        if (!player.isValid || res.canceled) return;
        switch (res.selection) {
            case 0: showGameSettingForm(player); break;
            case 1: showMapSettingForm(player); break;
            case 2: showFoodDrinkForm(player); break;
            case 3: showShopForm(player); break;
            case 4: showOtherMenu(player); break;
        }
    }).catch(() => { });
}


// 主界面/全局游戏配置
function showGameSettingForm(player) {
    if (!player.isValid) return;

    const gameForm = new ActionFormData()
        .title("全局游戏配置")
        .body("调整游戏全局数值参数")
        .button("游戏相关配置")
        .button("任务相关配置")
        .button("局内相关配置")
        .button("§6恢复默认配置")
        .button("§c返回");

    gameForm.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: mc.system.run(() => showGameConfigModal(player)); break;
            case 1: mc.system.run(() => showTaskConfigModal(player)); break;
            case 2: mc.system.run(() => showInGameSettingModal(player)); break;
            case 3: resetAllScoresToDefault(player); break;
            case 4: showMainForm(player); break;
        }
    }).catch(() => { });
}


// 主界面/全局游戏配置/局内相关配置
function showInGameSettingModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    new ModalFormData()
        .title("局内相关配置")
        .toggle("体力系统：仅局内生效，关闭后疾跑不再消耗体力", { defaultValue: cfg.staminaEnabled !== false })
        .slider("疾跑每秒消耗体力\n默认 10\n体力 / 秒", 2, 20, { valueStep: 2, defaultValue: cfg.staminaDrainPerSecond ?? 10 })
        .slider("停止疾跑后每秒恢复体力\n默认 4\n体力 / 秒", 2, 20, { valueStep: 2, defaultValue: cfg.staminaRegenPerSecond ?? 4 })
        .toggle("杀手体力值：关闭后杀手没有体力值，可以无限疾跑", { defaultValue: cfg.killerStamina !== false })
        .toggle("允许跳跃：仅局内生效，关闭后玩家无法跳跃", { defaultValue: cfg.jumpEnabled !== false })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showGameSettingForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                const latest = getWorldConfig();
                latest.staminaEnabled = vals[0] === true;
                latest.staminaDrainPerSecond = Number(vals[1]);
                latest.staminaRegenPerSecond = Number(vals[2]);
                latest.killerStamina = vals[3] === true;
                latest.jumpEnabled = vals[4] === true;
                saveWorldConfig(latest);
                player.sendMessage("§a局内相关配置已保存");
            } catch (e) {
                player.sendMessage("§c保存失败: " + e);
            }
            showGameSettingForm(player);
        }).catch(() => { });
}


// 主界面/全局游戏配置/游戏相关配置
function showGameConfigModal(player) {
    if (!player.isValid) return;
    const val0 = getSco("lw_p1:是否自动开始");
    const s1 = getScoreboardSlider("lw_p1:游戏自动开始时间");
    const s2 = getScoreboardSlider("lw_p1:最低开局人数");
    const s3 = getScoreboardSlider("lw_p1:单局游戏基础时长");
    new ModalFormData()
        .title("游戏相关配置")
        .header("自动开始时间")
        .slider(`当所有玩家都位于列车时，游戏自动开始倒计时。\n也可通过以下指令手动开始游戏\n/function lw_p1:gameStart\n默认 ${s1.defaultValue}\n自动开始时间（秒）`, s1.min, s1.max, { valueStep: s1.step, defaultValue: getSco("lw_p1:游戏自动开始时间") })
        .toggle("启用自动开始游戏", { defaultValue: val0 !== 0 })
        .header("\n最低开局人数")
        .slider(`当列车内玩家数量达到此值时，游戏可以开始。\n默认 ${s2.defaultValue}\n最低开局人数（个）`, s2.min, s2.max, { valueStep: s2.step, defaultValue: getSco("lw_p1:最低开局人数") })
        .header("\n游戏基础时长")
        .slider(`单局游戏的基础时长，每死亡一位平民时长加60秒。\n默认 ${s3.defaultValue}\n游戏时长（秒）`, s3.min, s3.max, { valueStep: s3.step, defaultValue: getSco("lw_p1:单局游戏基础时长") })
        .show(player).then(res => {
            if (res.canceled) { showGameSettingForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                mc.world.scoreboard.getObjective("lw_p1:游戏自动开始时间").setScore("lw_p1:全局", Number(vals[0]));
                mc.world.scoreboard.getObjective("lw_p1:是否自动开始").setScore("lw_p1:全局", vals[1] ? 1 : 0);
                mc.world.scoreboard.getObjective("lw_p1:最低开局人数").setScore("lw_p1:全局", Number(vals[2]));
                mc.world.scoreboard.getObjective("lw_p1:单局游戏基础时长").setScore("lw_p1:全局", Number(vals[3]));
                player.sendMessage("§a游戏配置已保存");
            } catch (e) {
                player.sendMessage("§c保存失败: " + e);
            }
            showGameSettingForm(player);
        }).catch(() => { });
}


// 主界面/全局游戏配置/任务相关配置
function showTaskConfigModal(player) {
    if (!player.isValid) return;
    const s1 = getScoreboardSlider("lw_p1:每秒分配概率");
    const s2 = getScoreboardSlider("lw_p1:任务开始发布时间");
    const s3 = getScoreboardSlider("lw_p1:单个任务限时");
    const s4 = getScoreboardSlider("lw_p1:杀手虚假任务限时");
    const s5 = getScoreboardSlider("lw_p1:任务完成奖励");
    new ModalFormData()
        .title("任务相关配置")
        .header("任务分配概率")
        .slider(`每秒给未分配任务玩家发布任务的概率。\n默认 ${s1.defaultValue}\n分配概率（百分比）`, s1.min, s1.max, { valueStep: s1.step, defaultValue: getSco("lw_p1:每秒分配概率") })
        .header("\n任务开始发布时间")
        .slider(`游戏开始后，首次尝试发布任务的时间。\n默认 ${s2.defaultValue}\n首个任务发布时间（秒）`, s2.min, s2.max, { valueStep: s2.step, defaultValue: getSco("lw_p1:任务开始发布时间") })
        .header("\n单个任务限时")
        .slider(`单个任务必须在该时间内完成，超时视为任务失败。\n默认 ${s3.defaultValue}\n单个任务限时（秒）`, s3.min, s3.max, { valueStep: s3.step, defaultValue: getSco("lw_p1:单个任务限时") })
        .header("\n杀手虚假任务限时")
        .slider(`杀手虚假任务可选择完成的限时，超过该时间未完成则虚假任务结束。\n默认 ${s4.defaultValue}\n虚假任务限时（秒）`, s4.min, s4.max, { valueStep: s4.step, defaultValue: getSco("lw_p1:杀手虚假任务限时") })
        .header("\n任务完成奖励")
        .slider(`平民/警员每完成一个任务获得的金币数。\n默认 ${s5.defaultValue}\n任务完成奖励（金币）`, s5.min, s5.max, { valueStep: s5.step, defaultValue: getSco("lw_p1:任务完成奖励") })
        .show(player).then(res => {
            if (res.canceled) { showGameSettingForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                mc.world.scoreboard.getObjective("lw_p1:每秒分配概率").setScore("lw_p1:全局", Number(vals[0]));
                mc.world.scoreboard.getObjective("lw_p1:任务开始发布时间").setScore("lw_p1:全局", Number(vals[1]));
                mc.world.scoreboard.getObjective("lw_p1:单个任务限时").setScore("lw_p1:全局", Number(vals[2]));
                mc.world.scoreboard.getObjective("lw_p1:杀手虚假任务限时").setScore("lw_p1:全局", Number(vals[3]));
                mc.world.scoreboard.getObjective("lw_p1:任务完成奖励").setScore("lw_p1:全局", Number(vals[4]));
                player.sendMessage("§a任务配置已保存");
            } catch (e) {
                player.sendMessage("§c保存失败: " + e);
            }
            showGameSettingForm(player);
        }).catch(() => { });
}


// 主界面/全局游戏配置/恢复默认配置
function resetAllScoresToDefault(player) {
    if (!player.isValid) return;

    new MessageFormData()
        .title("恢复默认配置")
        .body("§c确定要将所有游戏配置恢复为默认值吗？\n此操作会覆盖当前所有设置！")
        .button1("取消")
        .button2("§c确认恢复")
        .show(player).then(res => {
            if (res.selection === 1) {
                const fakePlayer = "lw_p1:全局";
                // 预设分数统一取自 worldConfig.js 的 SCOREBOARD_CONFIG
                const defaults = getAllScoreboardDefaults();

                for (const objName in defaults) {
                    try {
                        const obj = mc.world.scoreboard.getObjective(objName);
                        if (obj) obj.setScore(fakePlayer, defaults[objName]);
                    } catch (e) { }
                }

                // 局内开关同样恢复默认（开启）
                const cfg = getWorldConfig();
                cfg.staminaEnabled = true;
                cfg.jumpEnabled = true;
                cfg.staminaDrainPerSecond = 10;
                cfg.staminaRegenPerSecond = 4;
                cfg.killerStamina = true;
                saveWorldConfig(cfg);

                player.sendMessage("§a已成功恢复所有任务/游戏配置为默认值！");
            }

            showGameSettingForm(player);
        });
}


// 主界面/地图区域配置
function showMapSettingForm(player) {
    if (!player.isValid) return;

    const mapForm = new ActionFormData()
        .title("地图区域配置")
        .body("坐标管理")
        .button("站台&车头坐标")
        .button("列车区域坐标")
        .button("车头透气区坐标")
        .button("车尾透气区坐标")
        .button("蹲坑坐标管理")
        .button("随机传送坐标管理")
        .button("房间数配置")
        .button("§6清空所有地图坐标")
        .button("§c返回");

    mapForm.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: mc.system.run(() => showStationEngineCoordModal(player)); break;
            case 1: mc.system.run(() => showTrainAreaCoordModal(player)); break;
            case 2: mc.system.run(() => showEngineVentCoordModal(player)); break;
            case 3: mc.system.run(() => showTailVentCoordModal(player)); break;
            case 4: showToiletList(player); break;
            case 5: showRandomList(player); break;
            case 6: mc.system.run(() => showRoomCountModal(player)); break;
            case 7: confirmClearAllCoord(player); break;
            case 8: showMainForm(player); break;
        }
    }).catch(() => { });
}


// 主界面/地图区域配置/站台&车头坐标
function showStationEngineCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);

    // 站台坐标默认值
    let station = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    if (cfg.trainStationCoordinates && cfg.trainStationCoordinates.x !== undefined) {
        station = {
            x: Math.floor(cfg.trainStationCoordinates.x),
            y: Math.floor(cfg.trainStationCoordinates.y),
            z: Math.floor(cfg.trainStationCoordinates.z)
        };
    }

    // 车头坐标默认值
    let engine = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    if (cfg.trainEngineCoordinates && cfg.trainEngineCoordinates.x !== undefined) {
        engine = {
            x: Math.floor(cfg.trainEngineCoordinates.x),
            y: Math.floor(cfg.trainEngineCoordinates.y),
            z: Math.floor(cfg.trainEngineCoordinates.z)
        };
    }

    new ModalFormData()
        .title("站台&车头坐标配置")
        .header("站台坐标")
        .textField("每局结束后玩家传送至该坐标（开始屋）\n\n站台X坐标", "", { defaultValue: String(station.x) })
        .textField("站台Y坐标", "", { defaultValue: String(station.y) })
        .textField("站台Z坐标", "", { defaultValue: String(station.z) })
        .header("\n车头坐标")
        .textField("使用“传送至车头”物品后传送的坐标\n\n车头X坐标", "", { defaultValue: String(engine.x) })
        .textField("车头Y坐标", "", { defaultValue: String(engine.y) })
        .textField("车头Z坐标", "", { defaultValue: String(engine.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage("§c坐标输入不合法，保存失败");
                showMapSettingForm(player);
                return;
            }
            cfg.trainStationCoordinates = intPosToCenter(sx, sy, sz);
            cfg.trainEngineCoordinates = intPosToCenter(ex, ey, ez);
            saveWorldConfig(cfg);
            player.sendMessage("§a站台&车头坐标已保存");
            showMapSettingForm(player);
        }).catch(() => { });
}


// 主界面/地图区域配置/列车区域坐标
function showTrainAreaCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);
    const tc = cfg.trainCoordinates || {};

    const start = tc.start && tc.start.x !== undefined
        ? tc.start
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const end = tc.end && tc.end.x !== undefined
        ? tc.end
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    new ModalFormData()
        .title("列车区域坐标配置")
        .header("列车区域 起点")
        .textField("对角线起点坐标\n\n起点X坐标", "", { defaultValue: String(start.x) })
        .textField("起点Y坐标", "", { defaultValue: String(start.y) })
        .textField("起点Z坐标", "", { defaultValue: String(start.z) })
        .header("\n列车区域 终点")
        .textField("对角线终点坐标\n\n终点X坐标", "", { defaultValue: String(end.x) })
        .textField("终点Y坐标", "", { defaultValue: String(end.y) })
        .textField("终点Z坐标", "", { defaultValue: String(end.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage("§c坐标输入不合法，保存失败");
                showMapSettingForm(player);
                return;
            }
            if (!cfg.trainCoordinates) cfg.trainCoordinates = {};
            cfg.trainCoordinates.start = { x: sx, y: sy, z: sz };
            cfg.trainCoordinates.end = { x: ex, y: ey, z: ez };
            saveWorldConfig(Object.assign({}, cfg));
            player.sendMessage("§a列车区域坐标已保存");
            showMapSettingForm(player);
        }).catch(() => { });
}


// 主界面/地图区域配置/车头透气区坐标
function showEngineVentCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);
    if (!cfg.ventilationAreas) cfg.ventilationAreas = {};
    if (!cfg.ventilationAreas.trainEngine) cfg.ventilationAreas.trainEngine = {};
    const ve = cfg.ventilationAreas.trainEngine;

    const start = ve.start && ve.start.x !== undefined
        ? ve.start
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const end = ve.end && ve.end.x !== undefined
        ? ve.end
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    new ModalFormData()
        .title("车头透气区坐标配置")
        .header("车头透气区 起点")
        .textField("对角线起点坐标\n\n起点X坐标", "", { defaultValue: String(start.x) })
        .textField("起点Y坐标", "", { defaultValue: String(start.y) })
        .textField("起点Z坐标", "", { defaultValue: String(start.z) })
        .header("\n车头透气区 终点")
        .textField("对角线终点坐标\n\n终点X坐标", "", { defaultValue: String(end.x) })
        .textField("终点Y坐标", "", { defaultValue: String(end.y) })
        .textField("终点Z坐标", "", { defaultValue: String(end.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage("§c坐标输入不合法，保存失败");
                showMapSettingForm(player);
                return;
            }
            cfg.ventilationAreas.trainEngine.start = { x: sx, y: sy, z: sz };
            cfg.ventilationAreas.trainEngine.end = { x: ex, y: ey, z: ez };
            saveWorldConfig(Object.assign({}, cfg));
            player.sendMessage("§a车头透气区坐标已保存");
            showMapSettingForm(player);
        }).catch(() => { });
}


// 主界面/地图区域配置/车尾透气区坐标
function showTailVentCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);
    if (!cfg.ventilationAreas) cfg.ventilationAreas = {};
    if (!cfg.ventilationAreas.trainTail) cfg.ventilationAreas.trainTail = {};
    const vt = cfg.ventilationAreas.trainTail;

    const start = vt.start && vt.start.x !== undefined
        ? vt.start
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const end = vt.end && vt.end.x !== undefined
        ? vt.end
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    new ModalFormData()
        .title("车尾透气区坐标配置")
        .header("车尾透气区 起点")
        .textField("对角线起点坐标\n\n起点X坐标", "", { defaultValue: String(start.x) })
        .textField("起点Y坐标", "", { defaultValue: String(start.y) })
        .textField("起点Z坐标", "", { defaultValue: String(start.z) })
        .header("\n车尾透气区 终点")
        .textField("对角线终点坐标\n\n终点X坐标", "", { defaultValue: String(end.x) })
        .textField("终点Y坐标", "", { defaultValue: String(end.y) })
        .textField("终点Z坐标", "", { defaultValue: String(end.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage("§c坐标输入不合法，保存失败");
                showMapSettingForm(player);
                return;
            }
            cfg.ventilationAreas.trainTail.start = { x: sx, y: sy, z: sz };
            cfg.ventilationAreas.trainTail.end = { x: ex, y: ey, z: ez };
            saveWorldConfig(Object.assign({}, cfg));
            player.sendMessage("§a车尾透气区坐标已保存");
            showMapSettingForm(player);
        }).catch(() => { });
}


// 主界面/地图区域配置/蹲坑坐标管理
function showToiletList(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const form = new ActionFormData()
        .title("蹲坑坐标管理")
        .body("玩家在以下坐标位置潜行一段时间可完成蹲坑任务。\n至少设置一个坐标")
        .button("添加当前位置");

    cfg.toiletCoordinates.forEach((pos) => {
        const label = pos && pos.x !== undefined
            ? `${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`
            : "未设置";
        form.button(label);
    });

    form.button("§c返回").show(player).then(res => {
        if (!player.isValid || res.canceled) { showMapSettingForm(player); return; }
        if (res.selection === 0) {
            const intPos = getPlayerBlockIntPos(player);
            cfg.toiletCoordinates.push(intPosToCenter(intPos.x, intPos.y, intPos.z));
            saveWorldConfig(cfg);
            player.sendMessage("§a蹲坑坐标已添加");
            showToiletList(player);
            return;
        }

        const itemIndex = res.selection - 1;
        if (itemIndex >= 0 && itemIndex < cfg.toiletCoordinates.length) {
            editToiletCoordinate(player, itemIndex);
            return;
        }

        showMapSettingForm(player);
    });
}


// 主界面/地图区域配置/蹲坑坐标管理/编辑
function editToiletCoordinate(player, index) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const item = cfg.toiletCoordinates[index];
    if (!item) { showToiletList(player); return; }

    new ModalFormData()
        .title(`编辑 蹲坑坐标 ${index + 1}`)
        .textField("X坐标", "输入整型坐标", { defaultValue: String(Math.floor(item.x)) })
        .textField("Y坐标", "输入整型坐标", { defaultValue: String(Math.floor(item.y)) })
        .textField("Z坐标", "输入整型坐标", { defaultValue: String(Math.floor(item.z)) })
        .toggle("§c删除此项", { defaultValue: false })
        .show(player).then(res => {
            if (!player.isValid) { showToiletList(player); return; }
            if (res.canceled) { showToiletList(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            if (vals[3] === true) {
                cfg.toiletCoordinates.splice(index, 1);
                saveWorldConfig(cfg);
                player.sendMessage("§c已删除蹲坑坐标");
                showToiletList(player);
                return;
            }
            const x = parseInt(String(vals[0]));
            const y = parseInt(String(vals[1]));
            const z = parseInt(String(vals[2]));
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                player.sendMessage("§c坐标输入不合法，保存失败");
                showToiletList(player);
                return;
            }
            cfg.toiletCoordinates[index] = intPosToCenter(x, y, z);
            saveWorldConfig(cfg);
            player.sendMessage("§a蹲坑坐标已更新");
            showToiletList(player);
        });
}


// 主界面/地图区域配置/随机传送坐标管理
function showRandomList(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const form = new ActionFormData()
        .title("随机传送坐标管理")
        .body("开局后玩家将随机传送到以下坐标。\n至少设置数目为最大玩家数的坐标数。")
        .button("添加当前位置");

    cfg.randomCoordinates.forEach((pos) => {
        const label = pos && pos.x !== undefined
            ? `${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`
            : "未设置";
        form.button(label);
    });

    form.button("§c返回").show(player).then(res => {
        if (!player.isValid || res.canceled) { showMapSettingForm(player); return; }
        if (res.selection === 0) {
            const intPos = getPlayerBlockIntPos(player);
            cfg.randomCoordinates.push(intPosToCenter(intPos.x, intPos.y, intPos.z));
            saveWorldConfig(cfg);
            player.sendMessage("§a随机坐标已添加");
            showRandomList(player);
            return;
        }

        const itemIndex = res.selection - 1;
        if (itemIndex >= 0 && itemIndex < cfg.randomCoordinates.length) {
            editRandomCoordinate(player, itemIndex);
            return;
        }

        showMapSettingForm(player);
    });
}


// 主界面/地图区域配置/随机传送坐标管理/编辑
function editRandomCoordinate(player, index) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const item = cfg.randomCoordinates[index];
    if (!item) { showRandomList(player); return; }

    new ModalFormData()
        .title(`编辑 随机传送坐标 ${index + 1}`)
        .textField("X坐标", "输入整型坐标", { defaultValue: String(Math.floor(item.x)) })
        .textField("Y坐标", "输入整型坐标", { defaultValue: String(Math.floor(item.y)) })
        .textField("Z坐标", "输入整型坐标", { defaultValue: String(Math.floor(item.z)) })
        .toggle("§c删除此项", { defaultValue: false })
        .show(player).then(res => {
            if (!player.isValid) { showRandomList(player); return; }
            if (res.canceled) { showRandomList(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            if (vals[3] === true) {
                cfg.randomCoordinates.splice(index, 1);
                saveWorldConfig(cfg);
                player.sendMessage("§c已删除随机传送坐标");
                showRandomList(player);
                return;
            }
            const x = parseInt(String(vals[0]));
            const y = parseInt(String(vals[1]));
            const z = parseInt(String(vals[2]));
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                player.sendMessage("§c坐标输入不合法，保存失败");
                showRandomList(player);
                return;
            }
            cfg.randomCoordinates[index] = intPosToCenter(x, y, z);
            saveWorldConfig(cfg);
            player.sendMessage("§a随机传送坐标已更新");
            showRandomList(player);
        });
}


// 主界面/地图区域配置/房间数配置
function showRoomCountModal(player) {
    if (!player.isValid) return;
    const s = getScoreboardSlider("lw_p1:房间数");
    new ModalFormData()
        .title("房间数配置")
        .header("房间数量")
        .slider(`游戏开始时，钥匙数量（1-N），若玩家数超过房间数则循环分配。\n默认 ${s.defaultValue}\n房间数量`, s.min, s.max, { valueStep: s.step, defaultValue: getSco("lw_p1:房间数") })
        .show(player).then(res => {
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const n = Number(vals[0]);
            if (Number.isFinite(n) && n >= s.min && n <= s.max) {
                mc.world.scoreboard.getObjective("lw_p1:房间数")?.setScore("lw_p1:全局", n);
                player.sendMessage(`§a房间数已设为 ${n}`);
            }
            showMapSettingForm(player);
        });
}


// 主界面/地图区域配置/清空所有地图坐标
function confirmClearAllCoord(player) {
    if (!player.isValid) return;
    new MessageFormData()
        .title("确认清空")
        .body("§c确定清空所有地图坐标？不可恢复！")
        .button1("取消")
        .button2("§c确认清空")
        .show(player).then(res => {
            if (res.selection === 1) {
                saveWorldConfig(getEmptyConfig());
                player.sendMessage("§c所有地图坐标已清空");
            }
            showMapSettingForm(player);
        });
}


// 物品ID转贴图路径；支持两类输入：
// 1. 完整贴图路径（含任意层级子目录，如 "textures/items/饮品/champagne"）-> 直接原样返回
// 2. 物品ID（如 "minecraft:cooked_beef" / "lw_p1:pistol"）-> 查询特判映射，查不到则用 textures/items/ 下同名
// 若添加新的特殊物品，直接在 ITEM_ICON_MAP 追加一行即可
const ITEM_ICON_MAP = {
    cooked_beef: "beef_cooked",
    cooked_salmon: "fish_salmon_cooked",
    cooked_porkchop: "porkchop_cooked",
    cooked_chicken: "chicken_cooked",
    cooked_mutton: "mutton_cooked",
    cooked_rabbit: "rabbit_cooked",
    cooked_cod: "cod_cooked",
    baked_potato: "potato_baked",
    poisonous_potato: "potato_poisonous",
    golden_apple: "apple_golden",
    enchanted_golden_apple: "apple_golden",
    golden_carrot: "carrot_golden",
    melon_slice: "melon",
    // 刷怪蛋没有自己的物品贴图（外观由客户端实体定义的 spawn_egg 配色生成），复用其对应实体的图标
    firecracker_spawn_egg: "firecracker",
};

export function itemIdToIconPath(itemId) {
    const rawName = itemId.includes(":") ? itemId.split(":")[1] : itemId;

    // 输入本身是完整路径（含路径分隔符，非纯物品名）则直接返回，支持任意子目录
    if (rawName.includes("/")) return itemId;

    // 命中特判映射则用之，否则用 textures/items/ 下同名贴图
    return `textures/items/${ITEM_ICON_MAP[rawName] ?? rawName}`;
}


// 主界面/食物&饮品配置
function showFoodDrinkForm(player) {
    if (!player.isValid) return;
    const form = new ActionFormData();
        form.title("物品配置管理");
        form.body("管理进食/补水任务的合法物品列表");
        form.button("配置合法食物");
        form.button("配置合法饮品");
        form.button("食物托盘配置");
        form.button("§6恢复默认配置");
        form.button("§c返回");

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: showFoodListForm(player); break;
            case 1: showDrinkListForm(player); break;
            case 2: showFoodTrayMenu(player); break;
            case 3: confirmResetFoodDrink(player); break;
            case 4: showMainForm(player); break;
        }
    });
}


// 确认恢复合法食物/饮品/食物托盘默认配置
function confirmResetFoodDrink(player) {
    if (!player.isValid) return;
    new MessageFormData()
        .title("恢复默认")
        .body("§c确定恢复合法食物、饮品和食物托盘的默认列表吗？当前的自定义项将被覆盖！")
        .button1("取消")
        .button2("§c确认恢复")
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.selection === 1) {
                const config = getWorldConfig();
                const defaults = getEmptyConfig();
                config.allowedFoods = [...defaults.allowedFoods];
                config.allowedDrinks = [...defaults.allowedDrinks];
                config.foodTrayItems = {};
                for (const id of Object.keys(defaults.foodTrayItems)) {
                    config.foodTrayItems[id] = [...defaults.foodTrayItems[id]];
                }
                saveWorldConfig(config);
                player.sendMessage("§a已恢复合法食物/饮品/食物托盘的默认配置");
            }
            showFoodDrinkForm(player);
        });
}


// 主界面/食物&饮品配置/管理合法食物
function showFoodListForm(player) {
    const config = getWorldConfig();
    const form = new ActionFormData();
    form.title("合法食物管理");
    form.body("管理进食任务的合法物品列表");

    config.allowedFoods.forEach(itemId => {
        const icon = itemIdToIconPath(itemId);
        form.button(itemId, icon);
    });
    form.button("新增食物");
    form.button("§c返回");

    form.show(player).then(res => {
        if (res.canceled) return showFoodDrinkForm(player);
        const idx = res.selection;

        if (idx === config.allowedFoods.length) {
            showAddModal(player, "food");
        } else if (idx === config.allowedFoods.length + 1) {
            showFoodDrinkForm(player);
        } else {
            showEditModal(player, "food", idx);
        }
    });
}


// 主界面/食物&饮品配置/管理合法饮品
function showDrinkListForm(player) {
    const config = getWorldConfig();
    const form = new ActionFormData();
    form.title("合法饮品管理");
    form.body("管理补水任务的合法物品列表");

    config.allowedDrinks.forEach(itemId => {
        const icon = itemIdToIconPath(itemId);
        form.button(itemId, icon);
    });
    form.button("新增饮品");
    form.button("§c返回");

    form.show(player).then(res => {
        if (res.canceled) return showFoodDrinkForm(player);
        const idx = res.selection;

        if (idx === config.allowedDrinks.length) {
            showAddModal(player, "drink");
        } else if (idx === config.allowedDrinks.length + 1) {
            showFoodDrinkForm(player);
        } else {
            showEditModal(player, "drink", idx);
        }
    });
}


// 主界面/食物&饮品配置/管理合法食物（饮品）/编辑
function showEditModal(player, type, index) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const list = type === "food" ? config.allowedFoods : config.allowedDrinks;
    const oldValue = list[index];
    const form = new ModalFormData();
        form.title(`编辑 ${oldValue}`);
        form.textField("请输入物品完整标识符，示例：minecraft:apple", "请输入物品ID", { defaultValue: String(oldValue) });
        form.toggle("§c删除此项", { defaultValue: false });

    form.show(player).then(res => {
        const backList = () => type === "food" ? showFoodListForm(player) : showDrinkListForm(player);
        if (res.canceled) return backList();

        const vals = res.formValues.filter(v => v !== null && v !== undefined);
        if (vals[1] === true) {
            list.splice(index, 1);
            saveWorldConfig(config);
            return backList();
        }
        const newValue = (String(vals[0]) || "").trim();
        if (newValue) {
            list[index] = newValue;
            saveWorldConfig(config);
        }
        backList();
    });
}


// 主界面/食物&饮品配置/管理合法食物（饮品）/单项操作/新增
function showAddModal(player, type) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const label = type === "food" ? "食物" : "饮品";
    const form = new ModalFormData();

    form.title(`新增${label}`);
    form.textField("请输入物品完整标识符，示例：minecraft:apple", "请输入物品ID", { defaultValue: "" });

    form.show(player).then(res => {
        const backList = () => type === "food" ? showFoodListForm(player) : showDrinkListForm(player);
        if (res.canceled) return backList();

        const newValue = String(res.formValues[0]).trim();
        if (newValue) {
            const list = type === "food" ? config.allowedFoods : config.allowedDrinks;
            list.push(newValue);
            saveWorldConfig(config);
        }
        backList();
    });
}


// 食物托盘名称映射
const FOOD_TRAY_NAMES = {
    "lw_p1:food_tray": "普通食物托盘",
    "lw_p1:food_tray_ceramic": "陶瓷食物托盘",
    "lw_p1:food_tray_glass": "玻璃食物托盘",
    "lw_p1:food_tray_wood": "木制食物托盘"
};

// 主界面/食物&饮品配置/食物托盘配置
function showFoodTrayMenu(player) {
    if (!player.isValid) return;
    const form = new ActionFormData();
    form.title("食物托盘配置");
    form.body("选择要配置的托盘类型，交互后可随机获得配置中的物品");

    const trayIds = Object.keys(FOOD_TRAY_NAMES);
    trayIds.forEach(id => {
        form.button(FOOD_TRAY_NAMES[id]);
    });
    form.button("§c返回");

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showFoodDrinkForm(player); return; }
        if (res.selection < trayIds.length) {
            showFoodTrayItemList(player, trayIds[res.selection]);
        } else {
            showFoodDrinkForm(player);
        }
    });
}


// 主界面/食物&饮品配置/食物托盘配置/物品列表
function showFoodTrayItemList(player, trayId) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    if (!config.foodTrayItems) config.foodTrayItems = {};
    if (!config.foodTrayItems[trayId]) config.foodTrayItems[trayId] = [];
    const items = config.foodTrayItems[trayId];

    const form = new ActionFormData();
    form.title(`${FOOD_TRAY_NAMES[trayId]} 物品`);
    form.body("交互后可随机获得以下物品之一");

    items.forEach(itemId => {
        const icon = itemIdToIconPath(itemId);
        form.button(itemId, icon);
    });
    form.button("新增物品");
    form.button("§c返回");

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showFoodTrayMenu(player); return; }
        if (res.selection === items.length) {
            showFoodTrayAddModal(player, trayId);
        } else if (res.selection === items.length + 1) {
            showFoodTrayMenu(player);
        } else {
            showFoodTrayEditModal(player, trayId, res.selection);
        }
    });
}


// 主界面/食物&饮品配置/食物托盘配置/物品列表/新增
function showFoodTrayAddModal(player, trayId) {
    if (!player.isValid) return;
    new ModalFormData()
        .title(`新增 ${FOOD_TRAY_NAMES[trayId]} 物品`)
        .textField("请输入物品完整标识符，示例：minecraft:apple", "物品ID", { defaultValue: "" })
        .show(player).then(res => {
            if (res.canceled) { showFoodTrayItemList(player, trayId); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const newValue = String(vals[0]).trim();
            if (newValue) {
                const config = getWorldConfig();
                config.foodTrayItems[trayId].push(newValue);
                saveWorldConfig(config);
            }
            showFoodTrayItemList(player, trayId);
        });
}


// 主界面/食物&饮品配置/食物托盘配置/物品列表/编辑
function showFoodTrayEditModal(player, trayId, index) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const oldValue = config.foodTrayItems[trayId][index];
    new ModalFormData()
        .title(`编辑 ${oldValue}`)
        .textField("物品完整标识符", "物品ID", { defaultValue: String(oldValue) })
        .toggle("§c删除此项", { defaultValue: false })
        .show(player).then(res => {
            if (res.canceled) { showFoodTrayItemList(player, trayId); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            if (vals[1] === true) {
                config.foodTrayItems[trayId].splice(index, 1);
                saveWorldConfig(config);
                showFoodTrayItemList(player, trayId);
                return;
            }
            const newValue = String(vals[0]).trim();
            if (newValue) {
                config.foodTrayItems[trayId][index] = newValue;
                saveWorldConfig(config);
            }
            showFoodTrayItemList(player, trayId);
        });
}


// 主界面/商店配置
function showShopForm(player) {
    if (!player.isValid) return;
    const form = new ActionFormData();
    form.title("商店配置");
    form.body("管理商店物品列表与初始金币");
    form.button("杀手商店配置");
    form.button("贩卖机配置");
    form.button("初始金币")
    form.button("§6恢复默认配置");
    form.button("§c返回");

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: showkillerStoreForm(player); break;
            case 1: showVendingMachineForm(player); break;
            case 2: showInitialCoinsForm(player); break;
            case 3: confirmResetShop(player); break;
            case 4: showMainForm(player); break;
        }
    });
}


// 确认恢复商店默认配置
function confirmResetShop(player) {
    if (!player.isValid) return;
    new MessageFormData()
        .title("恢复默认")
        .body("§c确定恢复杀手商店和贩卖机的默认商品列表吗？当前的自定义项将被覆盖！")
        .button1("取消")
        .button2("§c确认恢复")
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.selection === 1) {
                const config = getWorldConfig();
                const defaults = getEmptyConfig();
                config.killerStoreItems = defaults.killerStoreItems.map(i => ({ ...i }));
                config.vendingMachineItems = defaults.vendingMachineItems.map(i => ({ ...i }));
                saveWorldConfig(config);
                player.sendMessage("§a已恢复商店的默认配置");
            }
            showShopForm(player);
        });
}


// 主界面/商店配置/杀手商店配置
function showkillerStoreForm(player) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const form = new ActionFormData();
    const items = config.killerStoreItems;

    form.title("杀手商店配置");
    form.body("管理杀手商店物品列表");

    config.killerStoreItems.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(`${item.displayName}：${item.price}金币`, icon);
    });
    form.button("新增商品");
    form.button("§c返回");

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showShopForm(player); return; }

        const idx = res.selection;
        if (idx === items.length) {
            showAddShopItemModal(player, "killer");
        } else if (idx === items.length + 1) {
            showShopForm(player);
        } else {
            showEditShopItemModal(player, "killer", idx);
        }
    });
}


// 主界面/商店配置/贩卖机配置
function showVendingMachineForm(player) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const form = new ActionFormData();
    const items = config.vendingMachineItems;

    form.title("贩卖机配置");
    form.body("管理贩卖机物品列表");

    config.vendingMachineItems.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(`${item.displayName}：${item.price}金币`, icon);
    });
    form.button("新增商品");
    form.button("§c返回");

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showShopForm(player); return; }

        const idx = res.selection;
        if (idx === items.length) {
            showAddShopItemModal(player, "vending");
        } else if (idx === items.length + 1) {
            showShopForm(player);
        } else {
            showEditShopItemModal(player, "vending", idx);
        }
    });
}


// 主界面/商店配置/杀手商店（贩卖机）/编辑
function showEditShopItemModal(player, shopType, index) {
    const config = getWorldConfig();
    const list = shopType === "killer" ? config.killerStoreItems : config.vendingMachineItems;
    const item = list[index];
    const form = new ModalFormData();
    const backForm = () => shopType === "killer" ? showkillerStoreForm(player) : showVendingMachineForm(player);

    form.title(`编辑 ${item.displayName}`);
    form.textField("商品显示名称", "请输入名称", { defaultValue: String(item.displayName) });
    form.textField("物品标识符", "如 minecraft:apple", { defaultValue: String(item.id) });
    form.textField("价格", "请输入正整数", { defaultValue: String(item.price) });
    form.toggle("§c删除此项", { defaultValue: false });

    form.show(player).then(res => {
        if (res.canceled) return backForm();
        const vals = res.formValues.filter(v => v !== null && v !== undefined);
        if (vals[3] === true) {
            list.splice(index, 1);
            saveWorldConfig(config);
            return backForm();
        }
        const [newName, newId, priceStr] = vals;
        const newPrice = parseInt(String(priceStr));

        if (String(newName).trim() && String(newId).trim() && !isNaN(newPrice) && newPrice > 0) {
            list[index].displayName = String(newName).trim();
            list[index].id = String(newId).trim();
            list[index].price = newPrice;
            saveWorldConfig(config);
        }

        backForm();
    });
}


// 主界面/商店配置/杀手商店（贩卖机）/单项操作/新增
function showAddShopItemModal(player, shopType) {
    const config = getWorldConfig();
    const list = shopType === "killer" ? config.killerStoreItems : config.vendingMachineItems;
    const backForm = () => shopType === "killer" ? showkillerStoreForm(player) : showVendingMachineForm(player);
    const form = new ModalFormData();

    form.title("新增商品");
    form.textField("商品显示名称", "请输入名称", { defaultValue: "" });
    form.textField("物品标识符", "如 minecraft:apple", { defaultValue: "" });
    form.textField("价格", "请输入正整数", { defaultValue: "" });

    form.show(player).then(res => {
        if (res.canceled) return backForm();
        const vals = res.formValues.filter(v => v !== null && v !== undefined);
        const [name, id, priceStr] = vals;
        const price = parseInt(String(priceStr));

        if (String(name).trim() && String(id).trim() && !isNaN(price) && price > 0) {
            list.push({
                id: String(id).trim(),
                displayName: String(name).trim(),
                price: price
            });
            saveWorldConfig(config);
        }
        backForm();
    });
}


// // 主界面/商店配置/初始金币
function showInitialCoinsForm(player) {
    if (!player.isValid) return;
    const s1 = getScoreboardSlider("lw_p1:杀手初始金币");
    const s2 = getScoreboardSlider("lw_p1:平民初始金币");
    const s3 = getScoreboardSlider("lw_p1:杀手金币增速");
    const s4 = getScoreboardSlider("lw_p1:平民金币增速");
    new ModalFormData()
        .title("初始金币设置")
        .header("杀手初始金币")
        .slider(`游戏开始后，杀手玩家持有的初始金币数。\n默认 ${s1.defaultValue}\n杀手初始金币`, s1.min, s1.max, { valueStep: s1.step, defaultValue: getSco("lw_p1:杀手初始金币") })
        .header("\n平民初始金币")
        .slider(`游戏开始后，非杀手玩家持有的初始金币数。\n默认 ${s2.defaultValue}\n平民初始金币`, s2.min, s2.max, { valueStep: s2.step, defaultValue: getSco("lw_p1:平民初始金币") })
        .header("\n杀手金币成长")
        .slider(`游戏开始后，杀手玩家每 10 秒自然获得的金币数。\n默认 ${s3.defaultValue}\n每10秒金币`, s3.min, s3.max, { valueStep: s3.step, defaultValue: getSco("lw_p1:杀手金币增速") })
        .header("\n平民金币成长")
        .slider(`游戏开始后，非杀手玩家每 10 秒自然获得的金币数。\n默认 ${s4.defaultValue}\n每10秒金币`, s4.min, s4.max, { valueStep: s4.step, defaultValue: getSco("lw_p1:平民金币增速") })
        .show(player).then(res => {
            if (res.canceled) { showShopForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                mc.world.scoreboard.getObjective("lw_p1:杀手初始金币").setScore("lw_p1:全局", Number(vals[0]));
                mc.world.scoreboard.getObjective("lw_p1:平民初始金币").setScore("lw_p1:全局", Number(vals[1]));
                mc.world.scoreboard.getObjective("lw_p1:杀手金币增速").setScore("lw_p1:全局", Number(vals[2]));
                mc.world.scoreboard.getObjective("lw_p1:平民金币增速").setScore("lw_p1:全局", Number(vals[3]));
            } catch (e) {
                player.sendMessage("§c初始金币保存失败: " + e);
            }
            showShopForm(player);
        }).catch(() => { });
}



// 主界面/其他
function showOtherMenu(player) {
    if (!player.isValid) return;
    const otherForm = new ActionFormData()
        .title("其他功能")
        .body("一些预留功能和关于信息")
        .button("设置地图信息")
        .button("修改更多当前不可用配置")
        .button("关于本Addon")
        .button("赞助&加入我们")
        .button("§c返回");
    otherForm.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: mc.system.run(() => showMapInfoForm(player)); break;
            case 1: showUnusedConfigUI(player); break;
            case 2: showDeveloperAboutUI(player); break;
            case 3: showSponsorJoinUI(player); break;
            case 4: showMainForm(player); break;
        }
    }).catch(() => { });
}


// 主界面/其他/设置地图信息
function showMapInfoForm(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const wi = cfg.worldInformation || {};
    new ModalFormData()
        .title("地图信息设置")
        .textField("地图名称", "请输入地图名称", { defaultValue: String(wi.mapName ?? "") })
        .textField("地图作者", "请输入作者名称", { defaultValue: String(wi.mapAuthor ?? "") })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showOtherMenu(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            cfg.worldInformation = {
                mapName: String(vals[0] ?? "").trim(),
                mapAuthor: String(vals[1] ?? "").trim(),
            };
            saveWorldConfig(cfg);
            player.sendMessage("§a地图信息已保存");
            showOtherMenu(player);
        }).catch(() => { });
}


// 主界面/其他/修改更多当前不可用配置
function showUnusedConfigUI(player) {
    if (!player.isValid) return;
    new ActionFormData().title("功能预留配置").body("若您想要增加更多任务、预设游戏数据或状态，修改底层数据，可访问以下网址查看项目源代码\n" +
        "https://github.com/xiaopa-baka/train-werewolf-addon\n" +
        "您可以访问项目仓库后查看行为包源代码，进行学习、修改、创建分支二次开发\n\n" +
        "注意：\n" +
        "进行二次开发后，请注明原作者和修改内容，禁止恶意篡改后传播！\n" +
        "二次开发不得用于商业用途，禁止私自售卖原版或修改后的版本！\n" +
        "二次开发后不得修改或删除整个“其他”板块的内容，包括开发者信息和赞助信息等\n" +
        "二次开发过程中如有任何问题欢迎联系开发者\n\n" +
        "§6敬请期待后续版本更新！").button("§c返回")
        .show(player).then(r => r.selection === 0 && showOtherMenu(player));
}


// 主界面/其他/关于Addon开发者
function showDeveloperAboutUI(player) {
    if (!player.isValid) return;
    new ActionFormData().title("关于本Addon").body("§b列车狼人杀Addon\n" +
        "§f版本：正式版 1.0\n" +
        "§f适配：我的世界基岩版 1.21.120+\n" +
        "§f开发模式：原生Script API\n\n" +
        "§a开发者简介：\n" +
        "工作室：LW.狮狼传奇工作室\n" +
        "项目策划：狮狼传奇_小怕\n" +
        "Addon作者：狮狼传奇_小怕\n" +
        "工作室交流群：180568043").button("§c返回")
        .show(player).then(r => r.selection === 0 && showOtherMenu(player));
}


// 主界面/其他/赞助&加入我们
function showSponsorJoinUI(player) {
    if (!player.isValid) return;
    new ActionFormData().title("赞助 & 团队招募").body("§b欢迎支持本项目开发！\n\n" +
        "§f【赞助说明】\n" +
        "如果您喜欢本Addon，愿意支持我们，可以通过以下方式赞助：\n" +
        "• 在社交媒体上宣传此Addon\n" +
        "• 为此Addon制作玩法地图并发布\n\n" +
        "工作室正在积极招新中，欢迎热爱MC的你加入我们！\n" +
        "§f【招募岗位】\n" +
        "• 地图建筑\n" +
        "• 项目策划\n" +
        "• 运营及宣传\n" +
        "• 指令设计、模组与插件开发\n" +
        "• 贴图与建模制作\n" +
        "• 皮肤设计\n\n\n" +
        "工作室交流群：180568043\n" +
        "§a欢迎热爱MC的小伙伴加入！\n" +
        "加入我们，一起创造更精彩的MC冒险体验！").button("§c返回")
        .show(player).then(r => r.selection === 0 && showOtherMenu(player));
}